"""会话：一个浏览器标签 = 一个会话 = 一个 Rust 引擎 + 一个事件日志（PLAN §3.2）。

这里是导演（PLAN §9）：把玩家点击 / 输入变成事件喂给引擎，在 AI 回合里调模型、过守卫、记账。
所有改状态的东西都走 ``self.step()``，它是唯一调用引擎并写日志的地方。
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable

import galcore

from .content import sha16
from .director import prompts
from .director.llm import complete, parse_json, stream_events, to_messages
from .director.perform import Performer
from .guard import TextGuard
from .memory import MemoryGateway
from .plugins import ChatRequest, ToolCallDone
from .recorder import Recorder
from .replay import replay, screen_from_ops

log = logging.getLogger("gallings.session")
Send = Callable[[dict[str, Any]], Awaitable[None]]

TOOLS = json.loads((Path(__file__).resolve().parents[1] / "schemas" / "tools.json").read_text(encoding="utf-8"))["tools"]
MODEL_TOOLS = [t for t in TOOLS if t["effect"] != "reserved"]


def openai_tools(names: set[str] | None = None) -> list[dict[str, Any]]:
    return [{"type": "function", "function": {"name": t["name"], "description": t["description"],
                                              "parameters": t["parameters"]}}
            for t in MODEL_TOOLS if names is None or t["name"] in names]


def _norm(s: str) -> str:
    return re.sub(r"[\s，。！？、…「」『』（）()—\-~～：:;；,.!?\"']+", "", s)


@dataclass
class SessionOptions:
    card_id: str
    mode: str = "choice"  # choice | ai
    seed: int | None = None
    agm_fill: bool = True
    honesty_gap_rule: bool = False
    #: 本机已收集的结局数（导入剧本里的只读变量 `结局数`，由播放器从本机记录传入）
    endings_seen: int = 0


@dataclass
class Session:
    rt: Any  # Runtime（server/runtime.py）
    opts: SessionOptions
    send: Send
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def __post_init__(self) -> None:
        rt = self.rt
        self.chapter = rt.chapter
        self.card, self.card_path = rt.cards.get(self.opts.card_id)
        self.card_hash = sha16(self.card)
        self.seed = self.opts.seed if self.opts.seed is not None else random.SystemRandom().randrange(1, 2**31)
        self.engine_config: dict[str, Any] = {"mode": self.opts.mode, "honesty_gap_rule": self.opts.honesty_gap_rule}
        if self.chapter.get("vars"):  # 导入的 VN Studio 剧本：通用变量初值 + 只读的周目变量
            vi = {v["var"]: int(v["init"]) for v in self.chapter["vars"] if v["var"] not in ("affection", "tails")}
            vi["结局数"] = max(0, int(self.opts.endings_seen))
            self.engine_config["vars_init"] = vi
        self.engine = galcore.Engine(json.dumps(self.chapter, ensure_ascii=False), json.dumps(self.card, ensure_ascii=False),
                                     json.dumps(self.engine_config), self.seed)
        self.guard = TextGuard(self.card)
        self.memory = MemoryGateway(rt.plugins.get("memory"), agm_fill=self.opts.agm_fill)
        self.llm_chain = rt.llm_chain()
        self.performer = Performer(self.chapter, self.card, self.card_hash, self.llm_chain, rt.data_dir / "perform")
        self.dir = rt.data_dir / "sessions" / self.id
        self.recorder = Recorder(self.dir / "events.jsonl", {
            "engine_version": galcore.ENGINE_VERSION, "content_hash": self.chapter["content_hash"],
            "chapter_path": str(rt.chapter_path), "card_id": self.card["id"], "card_hash": self.card_hash,
            "card": self.card, "engine_config": self.engine_config, "seed": self.seed, "lineage": "L0",
            "prompt_version": prompts.PROMPT_VERSION, "plugins": rt.plugins.lock(),
            "config_hash": sha16(self.engine_config)})
        self.saves: dict[str, dict[str, Any]] = {}
        self.recent: list[str] = []
        self.lineage_n = 0
        self.l3_streak = 0
        self.lock = asyncio.Lock()
        self.ops_log: list[dict[str, Any]] = []  # 已上屏的 op（重连 / 时间轴用）
        self.choice_op: dict[str, Any] | None = None
        self.diary: list[dict[str, Any]] = []

    # ------------------------------------------------------------------ 基础
    @property
    def state(self) -> dict[str, Any]:
        return json.loads(self.engine.state_json())

    @property
    def budget(self) -> dict[str, Any]:
        return json.loads(self.engine.budget_json())

    def llm_available(self) -> bool:
        return bool(self.llm_chain)

    async def step(self, kind: str, payload: dict[str, Any] | None = None, source: str = "engine",
                   display: dict[str, Any] | None = None, render: bool = True) -> dict[str, Any]:
        ev = {"kind": kind, "payload": payload or {}, "source": source}
        res = json.loads(self.engine.step(json.dumps(ev, ensure_ascii=False)))
        row = self.recorder.record(ev, res, display)
        await self.send({"type": "timeline", "row": self._timeline_view(row)})
        if render:
            await self.render(res["ops"])
        return res

    def _timeline_view(self, row: dict[str, Any]) -> dict[str, Any]:
        p = dict(row["payload"])
        if row["kind"] == "load":
            p = {"slot": p.get("slot"), "new_lineage": p.get("new_lineage")}
        return {**row, "payload": p}

    async def render(self, ops: list[dict[str, Any]]) -> None:
        out = []
        for op in ops:
            k = op.get("op")
            if k == "SAY" and op.get("origin") == "locked" and not self.guard.check_locked(op):
                # 锁定台词哈希不符：不上屏，记降级（PLAN §10）
                await self.step("fallback", {"level": 2, "reason": "locked_hash_mismatch", "src": op.get("src")}, render=False)
                continue
            new, perf = await self.performer.render(op)
            if perf:
                await self.step("perform", perf, source="model", render=False)
            if k == "SAY":
                who = {"heroine": "她", "player": "我", "narrator": "旁白"}.get(new["speaker"], new["speaker"])
                self.recent.append(f"{who}：{new['text']}")
            if k == "CHOICE":
                self.choice_op = new
            out.append(new)
        if out:
            self.ops_log.extend(out)
            await self.send({"type": "ops", "ops": out})

    async def hello(self) -> None:
        await self.send({"type": "hello", "session": self.id, "card": {"id": self.card["id"], "name": self.card["identity"]["name"]},
                         "mode": self.opts.mode, "llm": self.llm_available(), "memory": self.memory.enabled,
                         "chapter": {"id": self.chapter["chapter_id"], "title": self.chapter["title"]},
                         "seed": self.seed, "header": {k: v for k, v in self.recorder.header.items() if k != "card"}})
        await self.performer.start()

    # ------------------------------------------------------------------ 玩家动作
    async def handle(self, msg: dict[str, Any]) -> None:
        t = msg.get("type")
        async with self.lock:
            try:
                if t == "start":  # 从某章开头开局（导入的 VN Studio 作品：章节入口句 ID）
                    src = f"vn:{msg.get('line_id', '')}"
                    pc = next((k for k, o in enumerate(self.chapter["program"]) if o.get("op") == "CHAPTER" and o.get("src") == src), None)
                    if pc is None:
                        await self.send({"type": "error", "message": f"没有这个章节入口：{msg.get('line_id')}"})
                        return
                    await self.step("start", {"pc": pc}, source="player")
                elif t == "advance":
                    await self.step("advance", source="player")
                elif t == "choose":
                    await self.on_choose(msg["option_id"])
                elif t == "input":
                    await self.on_input(str(msg.get("text", ""))[:200])
                elif t == "mode":
                    if msg["mode"] == "ai" and not self.llm_available():
                        await self.send({"type": "error", "message": "没有配置模型（GALLINGS_LLM_API_KEY），AI 模式不可用"})
                        return
                    await self.step("mode_switch", {"mode": msg["mode"]}, source="player")
                    if self.choice_op and self.state["wait"] == "choice":
                        await self.send({"type": "ops", "ops": [self.choice_op]})
                elif t == "snapshot":  # 播放器自己存档时带走的引擎快照（只读，不改状态、不记事件）
                    await self.send({"type": "snapshot", "save": self.export_save()})
                elif t == "restore":  # 新会话从播放器存档里的引擎快照接着跑（读档 = 新时间线，PLAN §13.3）
                    await self.on_restore(msg.get("save") or {})
                elif t == "save":
                    await self.on_save(str(msg.get("slot", "1")))
                elif t == "load":
                    await self.on_load(str(msg.get("slot", "1")))
                elif t == "seek":
                    await self.on_seek(int(msg["seq"]))
                elif t == "diary":
                    await self.step("diary_view", {}, source="player", render=False)
                    await self.send({"type": "diary", "entries": self.diary})
                else:
                    await self.send({"type": "error", "message": f"未知消息：{t}"})
            except ValueError as e:  # 引擎拒绝（例如在选项点点了"继续"）
                await self.send({"type": "error", "message": str(e)})

    async def on_choose(self, option_id: str) -> None:
        label = next((o["label"] for o in (self.choice_op or {}).get("options", []) if o["id"] == option_id), option_id)
        st = self.state
        self.recent.append(f"我（选择）：{label}")
        await self.step("choice", {"option_id": option_id}, source="player")
        mid = await self.memory.write(f"玩家在「{st['beat_id']}」选择了：{label}", "event", st["turn"] + 1, st["lineage"])
        if mid:
            await self.step("memory_write", {"cooccur": [mid], "ids": [mid]}, render=False)
        await self.maybe_end()

    async def maybe_end(self) -> None:
        st = self.state
        if st["wait"] == "end" and self.llm_available() and st["mode"] == "ai" and not self.diary:
            asyncio.get_running_loop().create_task(self.write_diary())

    # ------------------------------------------------------------------ AI 模式：打字
    async def on_input(self, text: str) -> None:
        st = self.state
        if st["wait"] != "choice":
            await self.send({"type": "error", "message": "现在不能输入（输入框只在选项点开放）"})
            return
        res = await self.step("player_input", {"text": text}, source="player", render=False)
        if res["verdicts"] and res["verdicts"][0]["result"] == "rejected":
            await self.send({"type": "error", "message": res["verdicts"][0]["reason"]})
            return
        self.recent.append(f"我：{text}")
        await self.send({"type": "busy", "on": True})
        try:
            await self._on_input(text)
        finally:
            await self.send({"type": "busy", "on": False})
            await self.maybe_end()

    async def _on_input(self, text: str) -> None:
        options = (self.choice_op or {}).get("options", [])
        default_line = (self.choice_op or {}).get("default_line", "")
        gv = self.guard.check_input(text)
        await self.step("text_verdict", {"stage": "input", **gv.to_dict()}, source="guard", render=False)
        if not gv.allow:
            await self.step("intent", {"intent": "越界", "matched_option": "", "confidence_milli": 1000}, source="guard", render=False)
            await self.ai_turn("[越界输入已拦截]", "越界", options, default_line, recall={"hits": [], "agm": []})
            return
        intent_task = asyncio.create_task(self.classify(text, options, default_line))
        st = self.state
        recall_task = asyncio.create_task(self.memory.recall(self.engine, f"{text} {st['beat_id']}"))
        intent, recall = await asyncio.gather(intent_task, recall_task)
        await self.step("memory_recall", recall, source="memory", render=False)
        await self.step("intent", intent, source="model")
        if self.state["wait"] != "choice":  # 命中原选项：引擎已按原选项走了
            self.recent.append(f"（判定为选项：{intent.get('matched_option')}）")
            st = self.state
            mid = await self.memory.write(f"玩家说：{text}", "dialogue", st["turn"], st["lineage"])
            if mid:
                await self.step("memory_write", {"cooccur": [mid] + [h["id"] for h in recall["hits"]], "ids": [mid]}, render=False)
            return
        await self.ai_turn(text, intent.get("intent", "剧本外"), options, default_line, recall)

    async def classify(self, text: str, options: list[dict[str, Any]], context_line: str) -> dict[str, Any]:
        # 先做便宜的字面匹配（玩家照抄选项）
        nt = _norm(text)
        for o in options:
            nl = _norm(o["label"])
            if nl and (nt == nl or (len(nl) >= 3 and nl in nt and len(nt) <= len(nl) + 4)):
                return {"intent": o["nature"], "matched_option": o["id"], "confidence_milli": 950, "by": "literal"}
        if not self.llm_available():
            return {"intent": "剧本外", "matched_option": "", "confidence_milli": 0, "by": "offline"}
        r = await complete(self.llm_chain, prompts.intent_messages(text, options, context_line), json_mode=True,
                           temperature=0.0, timeout=10)
        try:
            d = parse_json(r.text)
            conf = int(round(float(d.get("confidence", 0)) * 1000))
            mo = str(d.get("matched_option") or "")
            if mo and mo not in {o["id"] for o in options}:
                mo = ""
            return {"intent": str(d.get("intent", "剧本外")), "matched_option": mo, "confidence_milli": conf, "by": "model"}
        except Exception:  # noqa: BLE001
            return {"intent": "剧本外", "matched_option": "", "confidence_milli": 0, "by": "fallback",
                    "error": (r.error.message if r.error else "解析失败")}

    def build_messages(self, text: str, intent: str, options: list[dict[str, Any]], landing: str,
                       recall: dict[str, Any]) -> list[dict[str, str]]:
        st, b = self.state, self.budget
        beat = next((op for op in self.chapter["program"] if op.get("op") == "BEAT" and op.get("beat_id") == st["beat_id"]), {})
        last_round = b["ai_rounds"] + 1 >= b["ai_rounds_max"]
        system = prompts.SYSTEM + "\n\n" + prompts.card_block(self.card)
        if intent == "越界":
            system += prompts.OUT_OF_BOUNDS
        if self.guard.serious_topic(text):
            system += prompts.SERIOUS
        user = "\n\n".join([
            prompts.beat_block(beat, landing, last_round),
            prompts.state_block(b, self.guard.available_addresses(st["address_stage"]), st["scene"]),
            prompts.memory_block(recall),
            prompts.recent_block(self.recent[:-1]),
            prompts.turn_block(text, intent, options),
        ])
        return [{"role": "system", "content": system}, {"role": "user", "content": user}]

    async def ai_turn(self, text: str, intent: str, options: list[dict[str, Any]], landing: str, recall: dict[str, Any]) -> None:
        """一个 AI 回合 = 一个事务（PLAN §5.2）：turn_begin → 工具调用逐个裁决 → turn_commit / turn_abort。"""
        if not self.llm_available():
            await self.fallback_line(3, "no_llm", landing)
            return
        await self.step("turn_begin", source="director", render=False)
        msgs = self.build_messages(text, intent, options, landing, recall)
        req = ChatRequest(to_messages(msgs), tools=openai_tools(), temperature=None)
        said: list[str] = []
        calls = 0
        bad_calls = 0
        error = None
        async for kind, ev in stream_events(self.llm_chain, req, first_token_timeout=8.0, total_timeout=20.0):
            if kind == "error":
                error = ev
                break
            if kind != "event" or not isinstance(ev, ToolCallDone):
                continue  # say 以外的自由文本一律丢弃（PLAN §9.3）
            calls += 1
            if calls > 8:
                break
            ok = await self.handle_tool(ev, said, msgs)
            if not ok:
                bad_calls += 1
                if bad_calls > 2:
                    error = "too_many_bad_calls"
                    break
        if error is not None and not said:
            await self.step("turn_abort", source="director", render=False)
            await self.fallback_line(3, getattr(error, "code", str(error)), landing)
            return
        if not said:  # 模型一句没说：用默认台词衔接（L2）
            await self.step("fallback", {"level": 2, "reason": "no_say", "line": landing}, source="director", render=False)
            await self.step("model_tool_call", {"tool": "say", "args": {"text": landing, "origin": "fallback"}}, source="director")
            said.append(landing)
        res = await self.step("turn_commit", source="director")
        self.l3_streak = 0
        st = self.state
        # 记忆：玩家原话 + 她这轮说的话；AGM 共现 = 本轮召回的条目 + 新写入的条目
        new_ids = []
        if intent != "越界":
            new_ids.append(await self.memory.write(f"玩家说：{text}", "dialogue", st["turn"], st["lineage"]))
        for s in said:
            new_ids.append(await self.memory.write(f"她说：{s}", "dialogue", st["turn"], st["lineage"]))
        new_ids = [x for x in new_ids if x]
        if new_ids:
            co = new_ids + [h["id"] for h in recall.get("hits", [])] + [h["id"] for h in recall.get("agm", [])]
            await self.step("memory_write", {"cooccur": co, "ids": new_ids}, render=False)
        if any(v.get("rule") == "steer_back" for v in res["verdicts"]):
            await self.send({"type": "notice", "message": "她把话题收回来了：请从选项里选一个。"})

    async def handle_tool(self, call: ToolCallDone, said: list[str], msgs: list[dict[str, str]]) -> bool:
        name, args = call.name, dict(call.arguments or {})
        if name not in {t["name"] for t in TOOLS}:
            await self.step("model_tool_call", {"tool": name, "args": args}, source="model", render=False)
            return False
        if name == "say":
            text = await self.gate_sentence(str(args.get("text", "")), msgs)
            await self.step("model_tool_call", {"tool": "say", "args": {"text": text["text"], "origin": text["origin"]}}, source="model")
            said.append(text["text"])
            self.recent.append(f"她：{text['text']}")
            return True
        if name == "write_memory":
            st = self.state
            mid = await self.memory.write(str(args.get("content", ""))[:120], "fact", st["turn"], st["lineage"])
            await self.step("model_tool_call", {"tool": name, "args": args, "memory_id": mid}, source="model", render=False)
            return True
        res = await self.step("model_tool_call", {"tool": name, "args": args}, source="model")
        return not (res["verdicts"] and res["verdicts"][0]["rule"] == "unknown_tool")

    async def gate_sentence(self, text: str, msgs: list[dict[str, str]]) -> dict[str, str]:
        """按句闸门：守卫通过才上屏；不合格带原因重写 ≤2 次（L1），仍失败换默认台词（L2）。PLAN §5.3–5.4。"""
        stage = self.state["address_stage"]
        cur = text
        for attempt in range(3):
            v = self.guard.check_sentence(cur, stage)
            await self.step("text_verdict", {"stage": "sentence", "attempt": attempt, **v.to_dict(), "text": cur},
                            source="guard", render=False)
            if v.allow:
                return {"text": v.text, "origin": "improvised"}
            if attempt == 2:
                break
            r = await complete(self.llm_chain, msgs + [{"role": "user", "content": prompts.REWRITE.format(
                text=cur, reason=v.reason, hint=v.hint)}], tools=openai_tools({"say"}), timeout=10)
            nxt = next((c.arguments.get("text") for c in r.tool_calls if c.name == "say"), None)
            if not nxt:
                break
            cur = str(nxt)
        line = (self.choice_op or {}).get("default_line") or "……"
        await self.step("fallback", {"level": 2, "reason": "guard_failed", "line": line}, source="director", render=False)
        return {"text": line, "origin": "fallback"}

    async def fallback_line(self, level: int, reason: str, line: str) -> None:
        self.l3_streak += 1
        await self.step("fallback", {"level": level, "reason": reason, "line": line}, source="director", render=False)
        await self.render([{"op": "SAY", "speaker": "heroine", "text": line or "……", "layer": "line", "origin": "fallback"}])
        if self.l3_streak >= 2:
            await self.step("fallback", {"level": 4, "reason": "l3_twice"}, source="director")
            await self.send({"type": "notice", "message": "模型连续出问题，本场先切回纯选项，下一场再试 AI。"})

    async def write_diary(self) -> None:
        name = self.card["identity"]["name"]
        msgs = [{"role": "system", "content": prompts.DIARY.format(name=name) + "\n\n" + prompts.card_block(self.card)},
                {"role": "user", "content": "<data>\n" + "\n".join(self.recent[-60:]) + "\n</data>"}]
        r = await complete(self.llm_chain, msgs, temperature=0.9, timeout=40)
        text = r.text.strip()[:300]
        if not text:
            return
        v = self.guard.check_input(text)  # 红线检查
        if not v.allow:
            return
        st = self.state
        mid = await self.memory.write(text, "diary", st["turn"], st["lineage"], tags=("diary",))
        async with self.lock:
            await self.step("memory_write", {"cooccur": [mid] if mid else [], "ids": [mid] if mid else [], "diary": True}, render=False)
        self.diary.append({"text": text, "turn": st["turn"], "lineage": st["lineage"]})
        await self.send({"type": "notice", "message": f"{name}写了一篇日记。"})

    # ------------------------------------------------------------------ 存读档 / 调试回放
    async def on_save(self, slot: str) -> None:
        snap = self.engine.snapshot()
        st = self.state
        self.saves[slot] = {"snapshot": snap, "seq": st["seq"], "screen": screen_from_ops(self.ops_log),
                            "recent": list(self.recent), "choice_op": self.choice_op}
        await self.step("save", {"slot": slot}, source="player", render=False)
        await self.send({"type": "saved", "slot": slot, "turn": st["turn"]})

    def export_save(self) -> dict[str, Any]:
        st = self.state
        return {"snapshot": self.engine.snapshot(), "content_hash": self.chapter["content_hash"], "seq": st["seq"],
                "recent": list(self.recent[-40:]), "choice_op": self.choice_op}

    async def on_restore(self, save: dict[str, Any]) -> None:
        if save.get("content_hash") != self.chapter["content_hash"] or not isinstance(save.get("snapshot"), str):
            await self.send({"type": "error", "message": "存档里的引擎快照与当前剧本不一致，这一局改由作品自身运行"})
            return
        self.saves["_restore"] = {"snapshot": save["snapshot"], "seq": int(save.get("seq") or 0), "screen": {},
                                  "recent": [str(x) for x in save.get("recent") or []][-40:], "choice_op": save.get("choice_op")}
        await self.on_load("_restore")

    async def on_load(self, slot: str) -> None:
        s = self.saves.get(slot)
        if not s:
            await self.send({"type": "error", "message": f"槽位 {slot} 是空的"})
            return
        self.lineage_n += 1
        new_lin = f"{json.loads(s['snapshot'])['state']['lineage']}.{self.lineage_n}"
        await self.step("load", {"slot": slot, "snapshot": json.loads(s["snapshot"]), "new_lineage": new_lin},
                        source="player", render=False)
        self.recent = list(s["recent"])
        self.choice_op = s["choice_op"]
        await self.send({"type": "screen", "screen": s["screen"], "live": True, "state": self._display_state()})

    def _display_state(self) -> dict[str, Any]:
        st = self.state
        return {"op": "STATE", "affection": st["affection"] + st["deferred"], "tails": st["tails_script"] + st["tails_ai"],
                "mood": st["mood"], "mode": st["mode"], "lineage": st["lineage"], "turn": st["turn"],
                "input_open": st["wait"] == "choice" and st["mode"] == "ai" and not st["input_closed"] and not st["forced_choice_scene"],
                "address_stage": st["address_stage"], "wound": st["wound"], "wait": st["wait"]}

    async def on_seek(self, seq: int) -> None:
        """调试时间轴拖动：从头回放到 seq，显示那一刻的画面（只看，不改当前进度）。"""
        _, ops, bad = replay(self.recorder.header, self.recorder.events, upto=seq)
        await self.send({"type": "screen", "screen": screen_from_ops(ops), "live": False, "seq": seq, "replay_ok": bad is None})

    async def close(self) -> None:
        self.recorder.close()
