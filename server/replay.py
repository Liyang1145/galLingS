"""回放：从事件日志重建引擎，逐条比对 state_hash（PLAN §4.1 第 5 条、§19.1）；以及"录制回放演示模式"（PLAN §2.1、§20）。

    python -m server.replay <events.jsonl>                 # 逐条校验
    python -m server.replay --list                          # 列出 data_dir 里录下的局
    python -m server.replay <events.jsonl|会话id> --serve   # 现场断网：直接起服务重播这一局

回放不调用模型、不查记忆；召回结果、模型输出、AI 即兴台词都直接取日志里的事件。
重播（``ReplayPlayer``）按录制时的节奏把同一局重新下发给前端：消息格式与实时局的 ``/ws`` 相同
（hello / timeline / ops / screen / notice），另加 ``{"type": "replay", ...}`` 进度与控制回执。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any, Awaitable, Callable, Iterable

import galcore

from .content import load_chapter_file
from .recorder import read_log, read_log_full

Send = Callable[[dict[str, Any]], Awaitable[None]]

#: 命令行 --serve 额外登记的日志（id → 路径），列表与 /ws/replay 都认
EXTRA_REPLAYS: dict[str, Path] = {}
LOG_ID = re.compile(r"^[A-Za-z0-9_.-]{1,80}$")


# ---------------------------------------------------------------- 逐条校验
def chapter_from_header(h: dict[str, Any], fallbacks: Iterable[Path] = ()) -> dict[str, Any]:
    """按日志头找剧本：先用记录的路径；不在了（换了机器）再试 fallbacks 里 content_hash 相同的。"""
    tried = []
    for p in [Path(h["chapter_path"]), *[Path(x) for x in fallbacks]]:
        if not p.is_file():
            continue
        chapter = load_chapter_file(p)
        if chapter["content_hash"] == h["content_hash"]:
            return chapter
        tried.append(chapter["content_hash"])
    if tried:
        raise ValueError(f"剧本已变（日志 {h['content_hash']}，现在 {tried[0]}），拒绝回放")
    raise ValueError(f"找不到日志用的剧本：{h['chapter_path']}")


def engine_from_header(h: dict[str, Any], fallbacks: Iterable[Path] = (), chapter: dict[str, Any] | None = None) -> Any:
    chapter = chapter or chapter_from_header(h, fallbacks)
    return galcore.Engine(json.dumps(chapter, ensure_ascii=False), json.dumps(h["card"], ensure_ascii=False),
                          json.dumps(h["engine_config"], ensure_ascii=False), int(h["seed"]))


def replay(header: dict[str, Any], events: list[dict[str, Any]], upto: int | None = None
           ) -> tuple[Any, list[dict[str, Any]], int | None]:
    """返回 (engine, 所有 ops, 第一处不一致的 seq 或 None)。"""
    eng = engine_from_header(header)
    ops: list[dict[str, Any]] = []
    mismatch = None
    for row in events:
        if upto is not None and row["seq"] > upto:
            break
        res = json.loads(eng.step(json.dumps({"kind": row["kind"], "payload": row["payload"]}, ensure_ascii=False)))
        ops.extend(res["ops"])
        if res["state_hash"] != row["state_hash"] and mismatch is None:
            mismatch = row["seq"]
    return eng, ops, mismatch


def screen_from_ops(ops: list[dict[str, Any]]) -> dict[str, Any]:
    """把一串 ops 折叠成"那一刻的画面"，供调试时间轴拖动后显示（PLAN §14）。"""
    sc: dict[str, Any] = {"scene": None, "bgm": None, "sprite": None, "say": None, "choice": None, "state": None, "tail": None}
    for op in ops:
        k = op.get("op")
        if k == "SCENE":
            sc["scene"] = op
        elif k == "BGM":
            sc["bgm"] = op
        elif k == "SPRITE":
            sc["sprite"] = op
        elif k == "SAY":
            sc["say"], sc["choice"] = op, None
        elif k == "CHOICE":
            sc["choice"] = op
        elif k == "STATE":
            sc["state"] = op
        elif k == "TAIL":
            sc["tail"] = op
        elif k == "END":
            sc["choice"] = None
    return sc


# ---------------------------------------------------------------- 时间轴行 / 画面状态（实时局与重播共用）
def display_state(st: dict[str, Any]) -> dict[str, Any]:
    return {"op": "STATE", "affection": st["affection"] + st["deferred"], "tails": st["tails_script"] + st["tails_ai"],
            "mood": st["mood"], "mode": st["mode"], "lineage": st["lineage"], "turn": st["turn"],
            "input_open": st["wait"] == "choice" and st["mode"] == "ai" and not st["input_closed"] and not st["forced_choice_scene"],
            "address_stage": st["address_stage"], "wound": st["wound"], "wait": st["wait"]}


def timeline_view(row: dict[str, Any], ops: list[dict[str, Any]] | None, st: dict[str, Any] | None,
                  choice_op: dict[str, Any] | None) -> dict[str, Any]:
    """给调试时间轴看的一行：事件本身 + 这一步引擎吐出的指令摘要和状态（只显示，不进日志、不参与回放）。"""
    p = dict(row["payload"])
    if row["kind"] == "load":
        p = {"slot": p.get("slot"), "new_lineage": p.get("new_lineage")}
    view: dict[str, Any] = {**row, "payload": p}
    if row["kind"] == "choice" and choice_op:
        opt = next((o for o in choice_op.get("options", []) if o.get("id") == p.get("option_id")), None)
        if opt:
            view["option_text"] = opt.get("text") or opt.get("label") or ""
    if ops is not None and st is not None:
        out = []
        for op in ops:
            k = op.get("op")
            if k == "SAY":
                out.append({"op": k, "speaker": op.get("speaker"), "text": str(op.get("text", ""))[:60],
                            "src": op.get("src"), "origin": op.get("origin")})
            elif k in ("CHOICE", "SCENE", "BGM", "END", "TAIL", "INPUT"):
                out.append({"op": k, **{x: op[x] for x in ("id", "bg", "track", "ending", "ending_id", "kind", "src") if x in op},
                            **({"n": len(op.get("options", []))} if k == "CHOICE" else {})})
        view["out"] = out[:12]
        view["state"] = {"affection": st["affection"] + st["deferred"], "tails": st["tails_script"] + st["tails_ai"],
                         "lineage": st["lineage"], "turn": st["turn"], "wait": st["wait"], "mode": st["mode"],
                         "vars": st.get("vars", {})}
    return view


# ---------------------------------------------------------------- 旧日志：没有 sent 行时按会话的规则重建画面消息
_NO_RENDER = {"perform", "memory_write", "text_verdict", "turn_begin", "save", "load", "diary_view", "player_input",
              "memory_recall"}


def _rendered(row: dict[str, Any], tool_names: set[str]) -> bool:
    """这个事件在实时局里有没有上屏（对应 server/session.py 里 step(render=...) 的调用处）。"""
    k, p = row["kind"], row.get("payload") or {}
    if k == "fallback":
        return p.get("level") == 4
    if k in _NO_RENDER:
        return False
    if k == "intent" and row.get("source") == "guard":
        return False
    if k == "model_tool_call" and row.get("source") == "model" and (p.get("tool") == "write_memory" or p.get("tool") not in tool_names):
        return False
    return True


def _sync(coro: Any) -> Any:
    """跑一个不会真的挂起的协程（演绎层 render 在没有后台任务时就是这样）。"""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value
    coro.close()
    raise RuntimeError("意外挂起")


def reconstruct_sent(header: dict[str, Any], events: list[dict[str, Any]], chapter: dict[str, Any]) -> list[dict[str, Any]]:
    """给没录 sent 行的旧日志重建"发给前端的画面消息"。模型相关的内容全部取自事件（perform / model_tool_call / fallback）。"""
    from .director.perform import Performer
    from .guard import TextGuard
    from .session import TOOLS
    card = header["card"]
    names = {t["name"] for t in TOOLS}
    perf = Performer(chapter, card, header.get("card_hash", ""), [], Path("."))
    for r in events:
        if r["kind"] == "perform":
            perf.lines[r["payload"]["src"]] = {"text": r["payload"]["text"], "origin": r["payload"]["origin"]}
    guard = TextGuard(card)
    eng = engine_from_header(header, chapter=chapter)
    out: list[dict[str, Any]] = []
    shown: list[dict[str, Any]] = []
    choice_op: dict[str, Any] | None = None
    slots: dict[str, dict[str, Any]] = {}

    def emit(seq: int, msg: dict[str, Any]) -> None:
        out.append({"kind": "sent", "after_seq": seq, "msg": msg})

    for row in events:
        res = json.loads(eng.step(json.dumps({"kind": row["kind"], "payload": row["payload"]}, ensure_ascii=False)))
        st = json.loads(eng.state_json())
        k, p, seq = row["kind"], row.get("payload") or {}, row["seq"]
        if _rendered(row, names):
            ops = []
            for op in res["ops"]:
                if op.get("op") == "SAY" and op.get("origin") == "locked" and not guard.check_locked(op):
                    continue
                new, _ = _sync(perf.render(op))
                if new.get("op") == "CHOICE":
                    choice_op = new
                ops.append(new)
            if ops:
                shown.extend(ops)
                emit(seq, {"type": "ops", "ops": ops})
        if k == "fallback" and p.get("level") == 3:
            say = {"op": "SAY", "speaker": "heroine", "text": p.get("line") or "……", "layer": "line", "origin": "fallback"}
            shown.append(say)
            emit(seq, {"type": "ops", "ops": [say]})
        elif k == "fallback" and p.get("level") == 4:
            emit(seq, {"type": "notice", "message": "模型连续出问题，本场先切回纯选项，下一场再试 AI。"})
        elif k == "mode_switch" and choice_op and st["wait"] == "choice":
            emit(seq, {"type": "ops", "ops": [choice_op]})
        elif k == "turn_commit" and any(v.get("rule") == "steer_back" for v in res.get("verdicts", [])):
            emit(seq, {"type": "notice", "message": "她把话题收回来了：请从选项里选一个。"})
        elif k == "save":
            slots[str(p.get("slot"))] = {"screen": screen_from_ops(shown), "choice_op": choice_op}
        elif k == "load":
            s = slots.get(str(p.get("slot")), {"screen": {}, "choice_op": None})
            choice_op = s["choice_op"]
            emit(seq, {"type": "screen", "screen": s["screen"], "live": True, "state": display_state(st)})
    return out


# ---------------------------------------------------------------- 已录制的局
def _log_summary(log_id: str, path: Path) -> dict[str, Any] | None:
    try:
        h, events, sent = read_log_full(path)
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    if not events:
        return None
    walls = [r.get("wall_ms") or 0 for r in events]
    return {"id": log_id, "path": str(path), "events": len(events),
            "choices": sum(1 for r in events if r["kind"] == "choice"),
            "ai_turns": sum(1 for r in events if r["kind"] == "turn_commit"),
            "inputs": sum(1 for r in events if r["kind"] == "player_input"),
            "started_ms": walls[0], "ended_ms": walls[-1], "duration_ms": max(0, walls[-1] - walls[0]),
            "card_id": h.get("card_id"), "card_name": ((h.get("card") or {}).get("identity") or {}).get("name"),
            "mode": (h.get("engine_config") or {}).get("mode"), "content_hash": h.get("content_hash"),
            "chapter_path": h.get("chapter_path"), "recorded_screen": bool(sent)}


def list_logs(data_dir: Path, limit: int = 200) -> list[dict[str, Any]]:
    """data_dir/sessions/<id>/events.jsonl（加上命令行登记的），新的在前；没有事件的空局不列。"""
    found: list[tuple[float, str, Path]] = []
    d = Path(data_dir) / "sessions"
    if d.is_dir():
        for p in d.glob("*/events.jsonl"):
            try:
                found.append((p.stat().st_mtime, p.parent.name, p))
            except OSError:
                pass
    for i, p in EXTRA_REPLAYS.items():
        if p.is_file() and all(x[1] != i for x in found):
            found.append((p.stat().st_mtime, i, p))
    out = []
    for _, i, p in sorted(found, reverse=True):
        s = _log_summary(i, p)
        if s:
            out.append(s)
        if len(out) >= limit:
            break
    return out


def find_log(data_dir: Path, log_id: str) -> Path | None:
    if not LOG_ID.match(log_id or ""):
        return None
    if log_id in EXTRA_REPLAYS:
        return EXTRA_REPLAYS[log_id]
    p = Path(data_dir) / "sessions" / log_id / "events.jsonl"
    return p if p.is_file() else None


# ---------------------------------------------------------------- 重播
class ReplayPlayer:
    """把一局按录制节奏重新下发。绝不调用模型：引擎只吃日志里的事件；每步比对 state_hash，不一致立即停下。

    客户端可发：``pause`` / ``resume`` / ``step``（暂停时走一步）/ ``speed{speed}`` / ``jump{step}``（跳到第 N 步之后）/ ``stop``。
    """

    MAX_SPEED = 1000.0
    HIGHLIGHT = 0.8  # 选项自动选中前的高亮时长（秒，不随倍速缩短，但不超过原间隔）

    def __init__(self, header: dict[str, Any], events: list[dict[str, Any]], sent: list[dict[str, Any]], send: Send, *,
                 log_id: str = "", speed: float = 1.0, max_gap: float = 8.0, paused: bool = False,
                 chapters: Iterable[Path] = ()) -> None:
        self.header, self.events, self.send, self.log_id = header, events, send, log_id
        self.chapter = chapter_from_header(header, chapters)
        self.recorded_screen = bool(sent)
        if not sent:
            sent = reconstruct_sent(header, events, self.chapter)
        self.sent: dict[int, list[dict[str, Any]]] = {}
        for s in sent:
            self.sent.setdefault(int(s.get("after_seq", 0)), []).append(s["msg"])
        self.speed = self._clamp(speed)
        self.max_gap = max(0.0, float(max_gap))
        self.paused = paused
        self.engine = engine_from_header(header, chapter=self.chapter)
        self.i = 0                    # 下一个要走的事件下标；= 已走的步数
        self.choice_op: dict[str, Any] | None = None
        self.shown: list[dict[str, Any]] = []
        self.diverged: dict[str, Any] | None = None
        self.stopped = False
        self._single = False
        self._epoch = 0
        self._announced = -1
        self._wake = asyncio.Event()

    @classmethod
    def _clamp(cls, v: Any) -> float:
        try:
            x = float(v)
        except (TypeError, ValueError):
            return 1.0
        return 1.0 if x != x or x <= 0 else min(cls.MAX_SPEED, max(0.1, x))

    @property
    def n(self) -> int:
        return len(self.events)

    def _info(self) -> dict[str, Any]:
        return {"id": self.log_id, "steps": self.n, "at": self.i, "speed": self.speed, "paused": self.paused,
                "recorded_screen": self.recorded_screen}

    async def hello(self) -> None:
        h = self.header
        card = h.get("card") or {}
        await self.send({"type": "hello", "session": f"replay-{self.log_id}", "replay": self._info(),
                         "card": {"id": card.get("id"), "name": (card.get("identity") or {}).get("name")},
                         "mode": (h.get("engine_config") or {}).get("mode", "choice"), "llm": False, "memory": False,
                         "chapter": {"id": self.chapter["chapter_id"], "title": self.chapter["title"]},
                         "seed": h.get("seed"), "header": {k: v for k, v in h.items() if k != "card"}})
        for m in self.sent.get(0, []):
            await self._show(m)

    async def _show(self, m: dict[str, Any]) -> None:
        if m.get("type") == "ops":
            for op in m.get("ops", []):
                if op.get("op") == "CHOICE":
                    self.choice_op = op
            self.shown.extend(m.get("ops", []))
        await self.send(m)

    def _gap(self, i: int) -> float:
        if i <= 0:
            return 0.0
        a, b = self.events[i - 1].get("wall_ms") or 0, self.events[i].get("wall_ms") or 0
        return min(self.max_gap, max(0.0, (b - a) / 1000.0)) / self.speed

    def _poke(self) -> None:
        self._epoch += 1
        self._wake.set()

    async def _sleep(self, secs: float) -> bool:
        """睡 secs 秒；被控制消息打断返回 False。"""
        ep = self._epoch
        loop = asyncio.get_running_loop()
        end = loop.time() + secs
        while True:
            left = end - loop.time()
            if self._epoch != ep or self.stopped:
                return False
            if left <= 0:
                return True
            self._wake.clear()
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=left)
            except asyncio.TimeoutError:
                pass

    async def _idle(self) -> None:
        self._wake.clear()
        await self._wake.wait()

    def _apply(self, row: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
        try:
            res = json.loads(self.engine.step(json.dumps({"kind": row["kind"], "payload": row["payload"]}, ensure_ascii=False)))
        except Exception as e:  # noqa: BLE001  引擎拒绝了日志里的事件：一定是日志被改过或引擎变了
            return None, f"引擎拒绝了这条事件：{e}"
        if res["state_hash"] != row.get("state_hash"):
            return res, None
        return res, ""

    async def _diverge(self, row: dict[str, Any], res: dict[str, Any] | None, err: str | None) -> None:
        self.diverged = {"seq": row.get("seq"), "step": self.i + 1, "kind": row.get("kind"),
                         "expected": row.get("state_hash"), "got": (res or {}).get("state_hash"),
                         "message": err or f"第 {self.i + 1} 步（seq={row.get('seq')}，{row.get('kind')}）state_hash 与录制不一致"}
        await self.send({"type": "replay", "event": "diverged", **self.diverged})

    async def _play_one(self) -> None:
        row = self.events[self.i]
        res, err = self._apply(row)
        if res is None or err is None:
            await self._diverge(row, res, err)
            return
        st = json.loads(self.engine.state_json())
        await self.send({"type": "timeline", "row": timeline_view(row, res["ops"], st, self.choice_op)})
        for m in self.sent.get(int(row["seq"]), []):
            await self._show(m)
        self.i += 1
        await self.send({"type": "replay", "event": "step", "at": self.i, "steps": self.n, "seq": row["seq"], "kind": row["kind"]})

    async def run(self) -> None:
        done_sent = False
        while not self.stopped:
            if self.diverged:
                await self._idle()
                continue
            if self.i >= self.n:
                if not done_sent:
                    done_sent = True
                    await self.send({"type": "replay", "event": "done", "steps": self.n, "ok": True})
                await self._idle()
                continue
            done_sent = False
            if self.paused and not self._single:
                await self._idle()
                continue
            row = self.events[self.i]
            gap = 0.0 if self._single else self._gap(self.i)
            if row["kind"] == "choice" and row.get("source") == "player" and self._announced != self.i:
                hl = min(gap, self.HIGHLIGHT) if not self._single else 0.3
                if not await self._sleep(gap - hl if not self._single else 0):
                    continue
                self._announced = self.i
                opt = next((o for o in (self.choice_op or {}).get("options", []) if o.get("id") == row["payload"].get("option_id")), None)
                await self.send({"type": "replay", "event": "choose", "option_id": row["payload"].get("option_id"),
                                 "label": (opt or {}).get("label") or (opt or {}).get("text") or "", "seq": row["seq"]})
                gap = hl
            elif row["kind"] == "player_input" and self._announced != self.i:
                if not await self._sleep(gap):
                    continue
                self._announced = self.i
                await self.send({"type": "replay", "event": "input", "text": row["payload"].get("text", ""), "seq": row["seq"]})
                gap = 0.0
            if not await self._sleep(gap):
                continue
            self._single = False
            await self._play_one()

    async def jump(self, step: int) -> None:
        """跳到"已走 step 步"那一刻：从头静默重放（照样逐条校验），把那一刻的画面发一个 screen。"""
        step = max(0, min(self.n, int(step)))
        self.engine = engine_from_header(self.header, chapter=self.chapter)
        self.i, self.diverged, self.choice_op, self.shown = 0, None, None, []
        for m in self.sent.get(0, []):
            self.shown.extend(m.get("ops", []) if m.get("type") == "ops" else [])
        st = json.loads(self.engine.state_json())
        last_seq = 0
        while self.i < step:
            row = self.events[self.i]
            res, err = self._apply(row)
            if res is None or err is None:
                await self._diverge(row, res, err)
                return
            last_seq = int(row["seq"])
            for m in self.sent.get(last_seq, []):
                if m.get("type") == "ops":
                    self.shown.extend(m["ops"])
                    for op in m["ops"]:
                        if op.get("op") == "CHOICE":
                            self.choice_op = op
                elif m.get("type") == "screen" and m.get("screen"):
                    self.shown = [x for x in (m["screen"] or {}).values() if isinstance(x, dict)]
            self.i += 1
        st = json.loads(self.engine.state_json())
        sc = screen_from_ops(self.shown)
        src = str((sc.get("say") or {}).get("src") or "")
        await self.send({"type": "screen", "replay": True, "live": True, "seq": last_seq, "at": self.i, "screen": sc,
                         "state": display_state(st), "line_id": src[3:] if src.startswith("vn:") else None})
        self._announced = -1

    async def control(self, msg: dict[str, Any]) -> None:
        t = msg.get("type")
        if t == "pause":
            self.paused = True
        elif t in ("resume", "play"):
            self.paused = False
        elif t == "step":
            self.paused, self._single = True, True
        elif t == "speed":
            self.speed = self._clamp(msg.get("speed"))
        elif t in ("jump", "seek"):
            await self.jump(int(msg.get("step", msg.get("at", 0)) or 0))
        elif t == "stop":
            self.stopped = True
        elif t in ("advance", "choose", "input", "mode", "save", "load", "restore", "snapshot"):
            await self.send({"type": "replay", "event": "ignored", "message": "重播中：玩家操作不生效", "of": t})
            self._poke()
            return
        else:
            await self.send({"type": "error", "message": f"重播不认识这条消息：{t}"})
            return
        self._poke()
        await self.send({"type": "replay", "event": "control", **self._info()})


# ---------------------------------------------------------------- 命令行
def _serve(path: Path, args: argparse.Namespace) -> int:
    import uvicorn

    from .api.app import create_app
    from .runtime import Runtime, load_config
    log_id = path.parent.name if path.name == "events.jsonl" else path.stem
    log_id = re.sub(r"[^A-Za-z0-9_.-]", "_", log_id)[:80] or "cli"
    from . import replay as this  # python -m 跑的是 __main__，服务端用的是 server.replay：登记到后者
    this.EXTRA_REPLAYS[log_id] = path
    EXTRA_REPLAYS[log_id] = path
    h, _ = read_log(path)
    cfg = load_config(Path(args.config) if args.config else None)
    game = None
    cp = Path(h.get("chapter_path", ""))
    if cp.name.endswith(".chapter.json"):  # VN Studio 作品导入的剧本：让服务器当前作品就是这一部
        game = cp.name[: -len(".chapter.json")]
        cfg = {**cfg, "game": {**(cfg.get("game") or {}), "source": "vnstudio", "vn_game": game}}
    cfg = {**cfg, "server": {**(cfg.get("server") or {}), "host": args.host}}
    rt = Runtime(cfg)
    q = f"replay={log_id}&speed={args.speed:g}" + (f"&game={game}" if game else "")
    print(f"重播服务：http://{args.host}:{args.port}/vn.html?{q}")
    print(f"（也可以直接连 ws://{args.host}:{args.port}/ws/replay?log={log_id}&speed={args.speed:g}）", flush=True)
    uvicorn.run(create_app(rt), host=args.host, port=args.port, log_level="warning")
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(prog="python -m server.replay", description="事件日志：逐条校验 / 列出 / 起服务重播")
    ap.add_argument("log", nargs="?", help="events.jsonl 路径，或 data_dir/sessions 下的会话 id")
    ap.add_argument("--list", action="store_true", help="列出 data_dir 里录下的局")
    ap.add_argument("--serve", action="store_true", help="起本机服务，在作品页重播这一局（不调用模型）")
    ap.add_argument("--speed", type=float, default=1.0, help="倍速（--serve 时写进链接）")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--config", help="config.yaml 路径（默认同服务）")
    if not argv:
        print("用法：python -m server.replay <events.jsonl|会话id> [--serve [--speed 1] [--port 8765]] | --list")
        return 2
    args = ap.parse_args(argv)
    if args.list or (args.log and not Path(args.log).is_file()):
        import os

        from .runtime import load_config
        srv = (load_config(Path(args.config) if args.config else None).get("server") or {})
        data_dir = Path(os.path.expanduser(str(srv.get("data_dir", "~/.gallings"))))
        if args.list:
            for s in list_logs(data_dir):
                print(f"{s['id']}  {s['events']:>4} 步  选项 {s['choices']}  AI 回合 {s['ai_turns']}  {s['card_name'] or s['card_id']}"
                      f"  {s['duration_ms'] // 1000}s{'' if s['recorded_screen'] else '  (旧日志：画面按事件重建)'}")
            return 0
        found = find_log(data_dir, args.log)
        if not found:
            print(f"找不到日志：{args.log}")
            return 2
        args.log = str(found)
    path = Path(args.log)
    h, evs = read_log(path)
    try:
        _, _, bad = replay(h, evs)
    except ValueError as e:
        print(f"不能回放：{e}")
        return 1
    if bad is not None:
        print(f"回放不一致：第一处分歧在 seq={bad}")
        return 1
    print(f"回放一致：{len(evs)} 个事件，state_hash 逐条相同。")
    if args.serve:
        return _serve(path.resolve(), args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
