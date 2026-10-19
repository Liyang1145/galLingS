"""契约测试（PLAN §18 M0a）：schemas/ 里的 Schema 必须放行真实代码产出的全部数据，并且足够严格。

- (a) tests/fixtures/mini 编译出的章节（以及仓库里那份 chapter.json）
- (b) VN Studio 导入：迷你作品，以及《海风与布丁》正式作品（文件存在时才跑）
- (c) 跑几局（脚本化模型）写出的事件日志，每一行
- (d) TestClient 在 /ws、/ws/replay、/ws/soul、/ws/post_ending 上收发的每一条消息

另外断言覆盖面（每种 OP / 事件 / 消息都真的出现过），以及几条“该拒绝的必须拒绝”。
"""
from __future__ import annotations

import asyncio
import copy
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from . import harness as H

SCHEMAS = H.ROOT / "schemas"
NAMES = ["card", "plugin", "op", "event", "ws"]


def _load(name: str) -> dict[str, Any]:
    return json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8"))


RAW = {n: _load(n) for n in NAMES}
REGISTRY = Registry().with_resources(
    [(f"{n}.schema.json", Resource.from_contents(s)) for n, s in RAW.items()]
    + [(s["$id"], Resource.from_contents(s)) for s in RAW.values()])


def validator(name: str, ref: str | None = None) -> Draft202012Validator:
    base = RAW[name]
    schema = {"$schema": base["$schema"], "$ref": f"{base['$id']}#/$defs/{ref}"} if ref else base
    return Draft202012Validator(schema, registry=REGISTRY, format_checker=Draft202012Validator.FORMAT_CHECKER)


def errors(v: Draft202012Validator, obj: Any, limit: int = 5) -> list[str]:
    out = []
    for e in v.iter_errors(obj):
        out.append(f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message[:200]}")
        if len(out) >= limit:
            break
    return out


def assert_valid(v: Draft202012Validator, obj: Any, what: str) -> None:
    errs = errors(v, obj)
    assert not errs, f"{what} 不符合 Schema：\n" + "\n".join(errs) + "\n" + json.dumps(obj, ensure_ascii=False)[:800]


def assert_invalid(v: Draft202012Validator, obj: Any, what: str) -> None:
    assert not v.is_valid(obj), f"{what} 应当被 Schema 拒绝"


#: 测试里故意发的未知消息类型（服务端回 error）：Schema 必须拒绝它们
BAD_TYPES = {"bogus", "what", "huh", "dance", "rewind"}


@pytest.mark.parametrize("name", NAMES)
def test_schemas_are_valid_draft_2020_12(name):
    Draft202012Validator.check_schema(RAW[name])


# ---------------------------------------------------------------- (a)(b) 章节
def _check_chapter(name: str, ch: dict[str, Any]) -> set[str]:
    assert_valid(validator("op"), ch, f"章节 {name}")
    n = len(ch["program"])
    for pc, op in enumerate(ch["program"]):  # JSON Schema 表达不了的：跳转目标在程序范围内
        targets = [op["target"]] if op["op"] in ("JUMP", "JUMP_IF") else \
            [o["target"] for o in op.get("options", [])] if op["op"] == "CHOICE" else []
        assert all(0 <= t < n for t in targets), f"{name} pc={pc} 跳转越界"
    assert all(0 <= int(k) < n for k in ch["analysis"]["rem"])
    return {op["op"] for op in ch["program"]}


def test_markdown_chapter():
    chs = H.compiled_chapters(include_real=False)
    seen = _check_chapter("mini.md", chs["mini.md"])
    _check_chapter("fixtures/mini/chapter.json", chs["fixtures/mini/chapter.json"])
    assert {"SCENE", "BGM", "SPRITE", "SAY", "BEAT", "CHOICE", "AFFECT", "TAIL", "JUMP", "MERGE", "SAVEPOINT", "END"} <= seen


def test_vnstudio_mini_chapter():
    seen = _check_chapter("vnstudio/mini", H.compiled_chapters(include_real=False)["vnstudio/mini"])
    assert {"CHAPTER", "SCENE", "BGM", "SET", "SAY", "CHOICE", "JUMP", "JUMP_IF", "END"} <= seen


@pytest.mark.skipif(not (H.REAL_GAME / "game.js").is_file(), reason="没有《海风与布丁》作品")
def test_vnstudio_real_game_chapter():
    from compiler.vnstudio import import_dir
    ch, _ = import_dir(H.REAL_GAME)
    seen = _check_chapter("海风与布丁", ch)
    assert ch["source"]["lines"] > 1000 and {"CHAPTER", "CHOICE", "SET", "END"} <= seen


def test_chapter_schema_rejects_bad_programs():
    v = validator("op")
    good = H.compiled_chapters(include_real=False)["mini.md"]
    assert_valid(v, good, "迷你章节")

    def mutated(fn) -> dict[str, Any]:
        ch = copy.deepcopy(good)
        fn(ch)
        return ch

    def first(ch, k):
        return next(o for o in ch["program"] if o["op"] == k)

    assert_invalid(v, mutated(lambda c: c["program"].append({"op": "TELEPORT", "src": "x:1"})), "未知 op")
    assert_invalid(v, mutated(lambda c: first(c, "SAY").pop("text")), "SAY 缺 text")
    assert_invalid(v, mutated(lambda c: first(c, "SAY").update(origin="ai")), "SAY origin 越界")
    assert_invalid(v, mutated(lambda c: first(c, "SAY").update(color="red")), "SAY 多余字段")
    assert_invalid(v, mutated(lambda c: first(c, "SAY").pop("src")), "program 里的 OP 缺 src")
    assert_invalid(v, mutated(lambda c: first(c, "CHOICE")["options"][0].pop("target")), "选项缺 target")
    assert_invalid(v, mutated(lambda c: c["program"].insert(0, {"op": "STATE", "src": "x:1"})), "program 里出现 STATE")
    assert_invalid(v, mutated(lambda c: c.update(format="gallings.chapter/1")), "两种章节格式混用")
    assert_invalid(v, mutated(lambda c: c.update(content_hash="xyz")), "content_hash 格式")


# ---------------------------------------------------------------- (c) 事件日志 + 会话消息（直接驱动 Session）
@pytest.fixture(scope="module")
def sessions(tmp_path_factory) -> dict[str, Any]:
    """跑几局，收集：事件日志每一行、服务端→客户端消息、客户端→服务端消息。"""
    out: dict[str, Any] = {"lines": [], "s2c": [], "c2s": []}

    async def run() -> None:
        for name, fn in (("ai", H.drive_ai_session), ("choice", H.drive_choice_session),
                         ("perform", H.drive_perform_session), ("vn", H.drive_vn_sessions)):
            tmp = tmp_path_factory.mktemp(name)
            rt, s, s2c, c2s = await fn(tmp)
            for x in (s if isinstance(s, list) else [s]):
                await x.close()
            await rt.stop()
            out["s2c"] += s2c
            out["c2s"] += c2s
            for p in H.event_logs(tmp):
                out["lines"] += [(f"{name}:{p.parent.name}:{i + 1}", json.loads(x))
                                 for i, x in enumerate(p.read_text(encoding="utf-8").splitlines())]

    asyncio.run(run())
    return out


def test_event_log_lines(sessions):
    v = validator("event")
    kinds, rules = set(), set()
    for where, row in sessions["lines"]:
        assert_valid(v, row, f"事件日志 {where}")
        kinds.add(row["kind"])
        rules |= {x["rule"] for x in row.get("verdicts", [])}
    assert {"header", "sent", "start", "advance", "choice", "player_input", "intent", "text_verdict", "memory_recall",
            "memory_write", "turn_begin", "model_tool_call", "turn_commit", "turn_abort", "fallback", "mode_switch",
            "save", "load", "perform", "diary_view"} <= kinds, kinds
    assert {"", "chapter_budget", "director_only", "mood_clamp", "unknown_tool", "off_script", "intent_matched",
            "input_closed"} <= rules, rules


def test_event_log_structure(sessions):
    """每个日志第 1 行是 header；事件 seq 从 1 严格递增；sent 行挂在已出现的 seq 上。"""
    logs: dict[str, list[dict[str, Any]]] = {}
    for where, row in sessions["lines"]:
        logs.setdefault(where.rsplit(":", 1)[0], []).append(row)
    for name, rows in logs.items():
        assert rows[0]["kind"] == "header", name
        seqs = [r["seq"] for r in rows[1:] if r["kind"] != "sent"]
        assert seqs == list(range(1, len(seqs) + 1)), name
        last = 0
        for r in rows[1:]:
            if r["kind"] == "sent":
                assert r["after_seq"] == last, name
            else:
                last = r["seq"]


def test_event_schema_rejects_bad_rows(sessions):
    v = validator("event")
    rows = [r for _, r in sessions["lines"]]
    mtc = next(r for r in rows if r["kind"] == "model_tool_call" and r["verdicts"])
    bad = [
        ({**mtc, "kind": "telepathy"}, "未知 kind"),
        ({k: x for k, x in mtc.items() if k != "state_hash"}, "缺 state_hash"),
        ({**mtc, "verdicts": [{**mtc["verdicts"][0], "result": "maybe"}]}, "verdict.result 越界"),
        ({**mtc, "verdicts": [{**mtc["verdicts"][0], "rule": "made_up"}]}, "verdict.rule 越界"),
        ({**mtc, "payload": {"args": {}}}, "model_tool_call 缺 tool"),
        ({**next(r for r in rows if r["kind"] == "advance"), "payload": {"x": 1}}, "advance 带 payload"),
        ({**next(r for r in rows if r["kind"] == "mode_switch"), "payload": {"mode": "auto"}}, "mode 越界"),
        ({**next(r for r in rows if r["kind"] == "header"), "seed": "abc"}, "header.seed 类型"),
        ({"kind": "sent", "after_seq": 0, "msg": {"type": "busy", "on": True}}, "sent 只录画面消息"),
    ]
    for obj, what in bad:
        assert_invalid(v, obj, what)


def _check_messages(msgs: list[dict[str, Any]], v: Draft202012Validator, what: str) -> set[str]:
    seen = set()
    for m in msgs:
        if m.get("type") in BAD_TYPES:
            assert_invalid(v, m, f"{what} 故意发的未知消息 {m['type']}")
            continue
        assert_valid(v, m, f"{what} {m.get('type')}")
        seen.add(m["type"])
    return seen


def test_session_messages(sessions):
    s2c = _check_messages(sessions["s2c"], validator("ws", "main_s2c"), "/ws 服务端→客户端")
    c2s = _check_messages(sessions["c2s"], validator("ws", "main_c2s"), "/ws 客户端→服务端")
    assert s2c == {"hello", "ops", "timeline", "busy", "error", "notice", "saved", "snapshot", "screen", "diary"}, s2c
    assert c2s == {"start", "advance", "choose", "input", "mode", "snapshot", "restore", "save", "load", "seek", "diary"}, c2s
    ops = {o["op"] for m in sessions["s2c"] if m["type"] == "ops" for o in m["ops"]}
    assert {"SAY", "CHOICE", "SCENE", "BGM", "SPRITE", "TAIL", "AFFECT", "SAVEPOINT", "END", "STATE", "CHAPTER", "SET"} <= ops, ops
    origins = {o["origin"] for m in sessions["s2c"] if m["type"] == "ops" for o in m["ops"] if o["op"] == "SAY"}
    assert {"locked", "script", "improvised", "fallback", "performed"} <= origins, origins


# ---------------------------------------------------------------- (d) 真 WebSocket
@pytest.fixture(scope="module")
def ws_log(tmp_path_factory) -> dict[str, Any]:
    log: list[tuple[str, str, Any]] = []
    md = tmp_path_factory.mktemp("ws_md")
    H.ws_main_md(md, log)
    H.ws_replay(md, log)
    H.ws_main_vn(tmp_path_factory.mktemp("ws_vn"), log)
    H.ws_soul(tmp_path_factory.mktemp("ws_soul"), log)
    H.ws_post_ending(tmp_path_factory.mktemp("ws_pe"), log)
    lines = [(f"{p.parent.name}:{i + 1}", json.loads(x)) for p in H.event_logs(md)
             for i, x in enumerate(p.read_text(encoding="utf-8").splitlines())]
    return {"log": log, "lines": lines}


def _by(ws_log, path: str, direction: str) -> list[dict[str, Any]]:
    return [m for p, d, m in ws_log["log"] if p == path and d == direction]


def test_ws_main(ws_log):
    s2c = _check_messages(_by(ws_log, "/ws", "s2c"), validator("ws", "main_s2c"), "/ws 服务端→客户端")
    c2s = _check_messages(_by(ws_log, "/ws", "c2s"), validator("ws", "main_c2s"), "/ws 客户端→服务端")
    assert {"hello", "ops", "timeline", "busy", "error", "saved", "snapshot", "screen", "diary"} <= s2c, s2c
    assert {"advance", "save", "input", "mode", "seek", "snapshot", "load", "diary", "choose", "restore"} <= c2s, c2s


def test_ws_event_logs(ws_log):
    """经 /ws 跑出来的局写在磁盘上的日志（含篡改 / 去掉 sent 行的副本）也逐行合规。"""
    v = validator("event")
    for where, row in ws_log["lines"]:
        assert_valid(v, row, f"事件日志 {where}")
    assert any(r["kind"] == "sent" for _, r in ws_log["lines"])


def test_ws_replay(ws_log):
    s2c = _by(ws_log, "/ws/replay", "s2c")
    seen = _check_messages(s2c, validator("ws", "replay_s2c"), "/ws/replay 服务端→客户端")
    _check_messages(_by(ws_log, "/ws/replay", "c2s"), validator("ws", "replay_c2s"), "/ws/replay 客户端→服务端")
    assert {"hello", "timeline", "ops", "screen", "replay", "error"} <= seen, seen
    events = {m["event"] for m in s2c if m["type"] == "replay"}
    assert {"step", "choose", "input", "done", "diverged", "control", "ignored"} <= events, events
    assert any(m["type"] == "hello" and not m["replay"]["recorded_screen"] for m in s2c)  # 旧日志


def test_ws_soul(ws_log):
    s2c = _check_messages(_by(ws_log, "/ws/soul", "s2c"), validator("ws", "soul_s2c"), "/ws/soul 服务端→客户端")
    c2s = _check_messages(_by(ws_log, "/ws/soul", "c2s"), validator("ws", "soul_c2s"), "/ws/soul 客户端→服务端")
    assert s2c == {"hello", "remembered", "whisper", "error"} and c2s == {"hello", "remember", "whisper"}
    ws = [m for m in _by(ws_log, "/ws/soul", "s2c") if m["type"] == "whisper"]
    assert any(m.get("source") == "llm" for m in ws) and any(m.get("blocked") for m in ws)
    assert {m.get("reason") for m in ws if m.get("fallback")} == {"empty", "no_llm", "model_failed"}


def test_ws_post_ending(ws_log):
    s2c = _check_messages(_by(ws_log, "/ws/post_ending", "s2c"), validator("ws", "post_ending_s2c"), "/ws/post_ending 服务端→客户端")
    c2s = _check_messages(_by(ws_log, "/ws/post_ending", "c2s"), validator("ws", "post_ending_c2s"), "/ws/post_ending 客户端→服务端")
    assert s2c == {"ready", "turn_start", "turn_end", "round_start", "round_end", "step_start", "think_delta", "step_end",
                   "say_delta", "emotion", "tool_start", "tool_end", "approval_required", "approval_resolved",
                   "client_call", "usage", "error", "reset_done", "pong"}, s2c
    assert c2s == {"hello", "user", "approve", "client_result", "stop", "reset", "ping"}, c2s


def test_ws_schema_rejects_bad_messages(ws_log):
    main_s2c, main_c2s = validator("ws", "main_s2c"), validator("ws", "main_c2s")
    ops = next(m for m in _by(ws_log, "/ws", "s2c") if m["type"] == "ops")
    say = next(o for m in _by(ws_log, "/ws", "s2c") if m["type"] == "ops" for o in m["ops"] if o["op"] == "SAY")
    choice = next(o for m in _by(ws_log, "/ws", "s2c") if m["type"] == "ops" for o in m["ops"] if o["op"] == "CHOICE")
    bad_choice = {**choice, "options": [{**choice["options"][0], "target": 3}]}
    for obj, what in [
        ({"type": "choose"}, "choose 缺 option_id"),
        ({"type": "mode", "mode": "auto"}, "mode 越界"),
        ({"type": "seek", "seq": "3"}, "seek.seq 类型"),
        ({"type": "advance", "force": True}, "advance 多余字段"),
    ]:
        assert_invalid(main_c2s, obj, what)
    for obj, what in [
        ({"type": "ops", "ops": []}, "空 ops"),
        ({"type": "ops", "ops": [{"op": "JUMP", "target": 1}]}, "控制流 OP 下发给前端"),
        ({"type": "ops", "ops": [bad_choice]}, "下发的选项带 target"),
        ({"type": "ops", "ops": [{**say, "layer": "shout"}]}, "SAY.layer 越界"),
        ({**ops, "seq": 1}, "ops 多余字段"),
        ({"type": "busy"}, "busy 缺 on"),
        ({"type": "screen", "screen": {}, "live": False}, "预览 screen 缺 seq / replay_ok"),
    ]:
        assert_invalid(main_s2c, obj, what)
    soul = validator("ws", "soul_s2c")
    assert_invalid(soul, {"type": "whisper", "id": 1, "fallback": True, "reason": "tired"}, "whisper.reason 越界")
    assert_invalid(soul, {"type": "whisper", "id": 1, "text": "x", "lines": ["x"], "emotion": "", "source": "llm",
                          "recall": 0, "fallback": True}, "whisper 两种结果混用")
    pe = validator("ws", "post_ending_s2c")
    assert_invalid(pe, {"type": "tool_end", "turn": 1, "step": "s1", "call_id": "c", "name": "x", "ok": True}, "tool_end 缺字段")
