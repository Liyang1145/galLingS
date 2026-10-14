"""GalAgent 会话：一个聊天窗口 = 一个会话。负责“模型 ⇄ 工具”循环，并把过程按 galagent/1 事件推给前端。

一轮对话（turn）里可能有多次模型往返（round）。每次往返：
  模型流式输出 → 拆成 思考(think) / 台词(say) / 表情(emotion) → 若有工具调用就逐个执行 → 结果喂回模型 → 下一次往返
没有工具调用的那次往返，台词就是这轮的最终回复。

前端的“分步折叠”对应这里的 step（think 步骤、tool 步骤），“总折叠”对应整个 turn。
协议见 docs/design/galagent.md。
"""
from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Protocol

from server.director.llm import stream_events
from server.plugins import ChatMessage, ChatRequest, TextDelta, ToolCallDone, ToolResult, ToolSpec, Usage

from .prompts import system_prompt
from .stream_split import StreamSplitter

PROTOCOL = "galagent/1"
Send = Callable[[dict[str, Any]], Awaitable[None]]
_CLIENT_TOOL_NAME = re.compile(r"^[a-z][a-z0-9_]{0,47}$")


@dataclass
class ToolEntry:
    spec: ToolSpec
    source: str           # 插件 id，或 "client"（前端提供的工具）
    policy: str = "auto"  # auto | ask | deny


class ToolRegistry(Protocol):
    async def entries(self) -> list[ToolEntry]: ...
    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult: ...


def _preview(v: Any, n: int = 4000) -> Any:
    """发给前端的结果预览：太长的字符串截断，结构保留。"""
    if isinstance(v, str):
        return v if len(v) <= n else v[:n] + f"…（共 {len(v)} 字）"
    if isinstance(v, dict):
        return {k: _preview(x, n) for k, x in v.items()}
    if isinstance(v, list):
        return [_preview(x, n) for x in v[:200]]
    return v


@dataclass
class _Turn:
    id: int
    t0: float
    step_n: int = 0
    tool_calls: int = 0
    rounds: int = 0
    reply: str = ""
    msgs: list[ChatMessage] = field(default_factory=list)
    pending_calls: list[str] = field(default_factory=list)  # 已发出 tool_calls 但还没回结果的 call_id

    def next_step(self) -> str:
        self.step_n += 1
        return f"s{self.step_n}"


class GalAgentSession:
    def __init__(self, *, llm_chain: list[Any], registry: ToolRegistry, send: Send, config: dict[str, Any],
                 workspace: str = "", log: Any = None, emit: Callable[[str, dict[str, Any]], None] | None = None) -> None:
        self.chain = llm_chain
        self.registry = registry
        self._send = send
        self.cfg = config
        self.workspace = workspace
        self.log = log
        self.emit = emit or (lambda _t, _p: None)
        self.id = uuid.uuid4().hex[:12]
        self.character: dict[str, Any] = {"name": "她", "persona": "", "expressions": []}
        self.context: dict[str, Any] = {}
        self.client_tools: dict[str, ToolEntry] = {}
        self.history: list[ChatMessage] = []
        self.always_allow: set[str] = set()
        self.turn_n = 0
        self.task: asyncio.Task[None] | None = None
        self.waiters: dict[str, asyncio.Future[Any]] = {}
        self.ready = False
        self.closed = False
        self.server_tools = True  # hello.server_tools=false 时只用前端工具（纯陪伴 / 只允许游戏内操作）

    async def send(self, m: dict[str, Any]) -> None:
        if self.closed:
            return
        try:
            await self._send(m)
        except Exception:  # 前端断开时不让工具循环崩掉
            self.closed = True

    # ------------------------------------------------------------------ 入口
    async def handle(self, msg: dict[str, Any]) -> None:
        t = msg.get("type")
        if t == "hello":
            await self.on_hello(msg)
        elif not self.ready:
            await self.send({"type": "error", "message": "请先发送 hello"})
        elif t == "user":
            await self.on_user(str(msg.get("text", "")))
        elif t == "approve":
            self._resolve(str(msg.get("call_id")), ("approve", bool(msg.get("allow")), bool(msg.get("remember"))))
        elif t == "client_result":
            self._resolve(str(msg.get("call_id")), ("client", msg))
        elif t == "stop":
            await self.stop()
        elif t == "reset":
            await self.stop()
            self.history.clear()
            await self.send({"type": "reset_done"})
        elif t == "ping":
            await self.send({"type": "pong"})
        else:
            await self.send({"type": "error", "message": f"未知消息：{t}"})

    def _resolve(self, call_id: str, value: Any) -> None:
        fut = self.waiters.get(call_id)
        if fut and not fut.done():
            fut.set_result(value)

    async def on_hello(self, msg: dict[str, Any]) -> None:
        ch = msg.get("character") or {}
        self.character = {"name": str(ch.get("name") or "她")[:40], "persona": str(ch.get("persona") or "")[:6000],
                          "expressions": [str(x)[:40] for x in (ch.get("expressions") or [])][:40]}
        ctx = msg.get("context") or {}
        self.context = {k: ctx[k] for k in ("ending", "story", "vars", "goal") if k in ctx}
        self.client_tools.clear()
        self.server_tools = msg.get("server_tools", True) is not False
        server_names = {e.spec.name for e in await self.registry.entries()}
        for t in (msg.get("client_tools") or [])[:32]:
            name = str(t.get("name", ""))
            if not _CLIENT_TOOL_NAME.match(name) or name in server_names:
                continue
            params = t.get("parameters") if isinstance(t.get("parameters"), dict) else {"type": "object", "properties": {}}
            effect = t.get("effect") if t.get("effect") in ("read", "perform") else "perform"
            self.client_tools[name] = ToolEntry(ToolSpec(name, str(t.get("description", ""))[:800], params, effect),
                                                "client", "auto")
        # 可选：前端带来之前的聊天记录（只取台词，不含工具过程）
        for h in (msg.get("history") or [])[-int(self.cfg.get("history_limit", 60)):]:
            role = "user" if h.get("role") in ("player", "user") else "assistant"
            text = str(h.get("text", ""))[:2000]
            if text:
                self.history.append(ChatMessage(role, text))
        self.ready = True
        await self.send({"type": "ready", "protocol": PROTOCOL, "session": self.id,
                         "character": {"name": self.character["name"]},
                         "llm": bool(self.chain),
                         "tools": [{"name": e.spec.name, "description": e.spec.description, "effect": e.spec.effect,
                                    "policy": e.policy, "source": e.source} for e in await self._entries()]})

    async def _entries(self) -> list[ToolEntry]:
        server = await self.registry.entries() if self.server_tools else []
        return [*server, *self.client_tools.values()]

    async def on_user(self, text: str) -> None:
        text = text.strip()[:4000]
        if not text:
            return
        if self.task and not self.task.done():
            await self.send({"type": "error", "message": "上一条还没处理完，可以先点停止"})
            return
        if not self.chain:
            message = "尚未配置可用模型，请在作品页设置中填写模型地址、名称与密钥。"
            self.turn_n += 1
            await self.send({"type": "turn_start", "turn": self.turn_n, "input": text})
            await self.send({"type": "turn_end", "turn": self.turn_n, "reply": message,
                             "error": message, "ms": 0, "rounds": 0, "steps": 0,
                             "tool_calls": 0, "stopped": False})
            return
        self.turn_n += 1
        turn = _Turn(self.turn_n, time.perf_counter())
        self.task = asyncio.get_running_loop().create_task(self._run_turn(turn, text))

    async def stop(self) -> None:
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except (asyncio.CancelledError, Exception):
                pass

    async def close(self) -> None:
        await self.stop()
        self.closed = True

    # ------------------------------------------------------------------ 一轮
    async def _run_turn(self, turn: _Turn, text: str) -> None:
        await self.send({"type": "turn_start", "turn": turn.id, "input": text})
        turn.msgs.append(ChatMessage("user", text))
        stopped, error = False, None
        try:
            await asyncio.wait_for(self._rounds(turn), timeout=float(self.cfg.get("turn_timeout_s", 300)))
        except asyncio.CancelledError:
            stopped = True
        except asyncio.TimeoutError:
            error = "这一轮超时了"
        except Exception as e:  # noqa: BLE001
            error = f"{type(e).__name__}: {e}"
            if self.log:
                self.log.exception("galagent turn 出错")
        finally:
            for w in list(self.waiters.values()):
                if not w.done():
                    w.cancel()
            self.waiters.clear()
            # 保证历史里每个 tool_call 都有回应，否则下一轮模型接口会报错
            for cid in turn.pending_calls:
                turn.msgs.append(ChatMessage("tool", json.dumps({"ok": False, "error": "玩家中止了操作"}, ensure_ascii=False),
                                             tool_call_id=cid))
            turn.pending_calls.clear()
            if stopped and not turn.reply:
                turn.msgs.append(ChatMessage("assistant", "（被玩家打断了）"))
            self.history.extend(turn.msgs)
            self._trim()
            ms = round((time.perf_counter() - turn.t0) * 1000)
            self.emit("turn", {"session": self.id, "turn": turn.id, "ms": ms, "rounds": turn.rounds,
                               "tool_calls": turn.tool_calls, "stopped": stopped, "error": error})
            await self.send({"type": "turn_end", "turn": turn.id, "ms": ms, "rounds": turn.rounds,
                             "steps": turn.step_n, "tool_calls": turn.tool_calls, "reply": turn.reply,
                             "stopped": stopped, "error": error})

    def _trim(self) -> None:
        lim = int(self.cfg.get("history_limit", 60))
        if len(self.history) <= lim:
            return
        h = self.history[-lim:]
        while h and h[0].role != "user":  # 不能从 tool / assistant(tool_calls) 中间切
            h = h[1:]
        self.history = h

    async def _rounds(self, turn: _Turn) -> None:
        entries = {e.spec.name: e for e in await self._entries() if e.policy != "deny"}
        max_rounds = int(self.cfg.get("max_rounds", 8))
        max_calls = int(self.cfg.get("max_tool_calls", 16))
        sys_text = system_prompt(self.character, self.context, list(entries), think=bool(self.cfg.get("think", True)),
                                 workspace=self.workspace, extra=str(self.cfg.get("extra_prompt") or ""))
        for r in range(1, max_rounds + 1):
            turn.rounds = r
            last = r == max_rounds or turn.tool_calls >= max_calls
            tools = [] if last else [{"type": "function", "function": {
                "name": e.spec.name, "description": e.spec.description, "parameters": e.spec.parameters}}
                for e in entries.values()]
            msgs = [ChatMessage("system", sys_text), *self.history, *turn.msgs]
            if last and turn.tool_calls:
                msgs.append(ChatMessage("system", "工具次数已用完。不要再调用工具，直接用角色口吻向玩家汇报目前的结果。"))
            say, calls = await self._one_round(turn, r, msgs, tools)
            if calls is None:  # 模型出错
                return
            turn.msgs.append(ChatMessage("assistant", say, tool_calls=[
                {"id": c.id, "type": "function",
                 "function": {"name": c.name, "arguments": json.dumps(c.arguments, ensure_ascii=False)}}
                for c in calls] or None))
            await self.send({"type": "round_end", "turn": turn.id, "round": r, "tool_calls": len(calls)})
            if not calls:
                turn.reply = say.strip()
                return
            turn.pending_calls = [c.id for c in calls]
            for c in calls:
                res = await self._exec(turn, c, entries)
                turn.msgs.append(ChatMessage("tool", self._for_model(res), tool_call_id=c.id))
                turn.pending_calls.remove(c.id)

    async def _one_round(self, turn: _Turn, r: int, msgs: list[ChatMessage], tools: list[dict[str, Any]]
                         ) -> tuple[str, list[ToolCallDone] | None]:
        await self.send({"type": "round_start", "turn": turn.id, "round": r})
        req = ChatRequest(msgs, tools=tools, temperature=float(self.cfg.get("temperature", 0.7)))
        split = StreamSplitter()
        think_step: list[Any] = [None, 0.0]  # [step_id, t0]
        say = ""
        calls: list[ToolCallDone] = []

        async def piece(kind: str, s: str) -> None:
            nonlocal say
            if kind == "think":
                if think_step[0] is None:
                    think_step[0], think_step[1] = turn.next_step(), time.perf_counter()
                    await self.send({"type": "step_start", "turn": turn.id, "step": think_step[0], "kind": "think"})
                await self.send({"type": "think_delta", "turn": turn.id, "step": think_step[0], "text": s})
                return
            await close_think()
            if kind == "emotion":
                await self.send({"type": "emotion", "turn": turn.id, "name": s})
            elif kind == "say":
                if not say and not s.strip():
                    return
                say += s
                await self.send({"type": "say_delta", "turn": turn.id, "round": r, "text": s})

        async def close_think() -> None:
            if think_step[0] is not None:
                await self.send({"type": "step_end", "turn": turn.id, "step": think_step[0], "ok": True,
                                 "ms": round((time.perf_counter() - think_step[1]) * 1000)})
                think_step[0] = None

        async for kind, ev in stream_events(self.chain, req, first_token_timeout=45.0,
                                            total_timeout=float(self.cfg.get("turn_timeout_s", 300))):
            if kind == "event":
                if isinstance(ev, TextDelta):
                    for k, s in split.feed(ev.text):
                        await piece(k, s)
                elif isinstance(ev, ToolCallDone):
                    calls.append(ev)
                elif isinstance(ev, Usage):
                    await self.send({"type": "usage", "turn": turn.id, "round": r,
                                     "prompt_tokens": ev.prompt_tokens, "completion_tokens": ev.completion_tokens})
            elif kind == "error":
                for k, s in split.finish():
                    await piece(k, s)
                await close_think()
                await self.send({"type": "error", "turn": turn.id, "message": f"模型出错：{ev.message}"})
                return say, None
        for k, s in split.finish():
            await piece(k, s)
        await close_think()
        return say, calls

    # ------------------------------------------------------------------ 执行一个工具
    async def _exec(self, turn: _Turn, c: ToolCallDone, entries: dict[str, ToolEntry]) -> ToolResult:
        step = turn.next_step()
        t0 = time.perf_counter()
        e = entries.get(c.name)
        turn.tool_calls += 1
        await self.send({"type": "tool_start", "turn": turn.id, "step": step, "call_id": c.id, "name": c.name,
                         "args": _preview(c.arguments, 2000), "source": e.source if e else "?",
                         "policy": e.policy if e else "deny"})
        if e is None:
            res = ToolResult(False, error=f"没有这个工具：{c.name}")
        else:
            res = await self._approved_call(turn, step, c, e)
        await self.send({"type": "tool_end", "turn": turn.id, "step": step, "call_id": c.id, "name": c.name,
                         "ok": res.ok, "result": _preview(res.content), "error": res.error,
                         "ms": round((time.perf_counter() - t0) * 1000)})
        return res

    async def _approved_call(self, turn: _Turn, step: str, c: ToolCallDone, e: ToolEntry) -> ToolResult:
        if e.policy == "ask" and c.name not in self.always_allow:
            fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
            self.waiters[c.id] = fut
            await self.send({"type": "approval_required", "turn": turn.id, "step": step, "call_id": c.id,
                             "name": c.name, "args": _preview(c.arguments, 4000), "effect": e.spec.effect})
            try:
                _, allow, remember = await asyncio.wait_for(fut, timeout=float(self.cfg.get("approval_timeout_s", 180)))
            except asyncio.TimeoutError:
                allow, remember = False, False
            finally:
                self.waiters.pop(c.id, None)
            await self.send({"type": "approval_resolved", "turn": turn.id, "step": step, "call_id": c.id, "allow": allow})
            if not allow:
                return ToolResult(False, error="玩家没有同意这次操作")
            if remember:
                self.always_allow.add(c.name)
        if e.source == "client":
            return await self._client_call(turn, step, c)
        return await self.registry.call(c.name, c.arguments, {"session": self.id, "turn": turn.id, "mode": "post_ending"})

    async def _client_call(self, turn: _Turn, step: str, c: ToolCallDone) -> ToolResult:
        fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self.waiters[c.id] = fut
        await self.send({"type": "client_call", "turn": turn.id, "step": step, "call_id": c.id, "name": c.name,
                         "args": c.arguments})
        try:
            _, m = await asyncio.wait_for(fut, timeout=float(self.cfg.get("client_call_timeout_s", 30)))
        except asyncio.TimeoutError:
            return ToolResult(False, error="前端工具没有响应")
        finally:
            self.waiters.pop(c.id, None)
        return ToolResult(bool(m.get("ok", True)), content=m.get("result"), error=m.get("error"))

    @staticmethod
    def _for_model(res: ToolResult) -> str:
        body = {"ok": res.ok, "result": res.content, "error": res.error}
        if res.proposals:
            body["proposals"] = res.proposals
        s = json.dumps(body, ensure_ascii=False, default=str)
        return s if len(s) <= 12000 else s[:12000] + "…（已截断）"
