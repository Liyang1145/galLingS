"""保留角色卡、插件与独立聊天消息的契约测试；旧 OP/日志/剧情回放测试已退役。本轮未执行。"""
from __future__ import annotations

import json
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from . import harness as H

SCHEMAS = H.ROOT / "schemas"
NAMES = ["card", "plugin", "ws"]


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


def _check_messages(msgs: list[dict[str, Any]], v: Draft202012Validator, what: str) -> set[str]:
    seen = set()
    for m in msgs:
        if m.get("type") in BAD_TYPES:
            assert_invalid(v, m, f"{what} 故意发的未知消息 {m['type']}")
            continue
        assert_valid(v, m, f"{what} {m.get('type')}")
        seen.add(m["type"])
    return seen



@pytest.fixture(scope="module")
def ws_log(tmp_path_factory) -> dict[str, Any]:
    log: list[tuple[str, str, Any]] = []
    H.ws_soul(tmp_path_factory.mktemp("ws_soul"), log)
    H.ws_post_ending(tmp_path_factory.mktemp("ws_pe"), log)
    return {"log": log}


def _by(ws_log, path: str, direction: str) -> list[dict[str, Any]]:
    return [m for p, d, m in ws_log["log"] if p == path and d == direction]



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



def test_ws_schema_rejects_bad_messages():
    soul = validator("ws", "soul_s2c")
    assert_invalid(soul, {"type": "whisper", "id": 1, "fallback": True, "reason": "tired"}, "whisper.reason 越界")
    assert_invalid(soul, {"type": "whisper", "id": 1, "text": "x", "lines": ["x"], "emotion": "", "source": "llm",
                          "recall": 0, "fallback": True}, "whisper 两种结果混用")
    pe = validator("ws", "post_ending_s2c")
    assert_invalid(pe, {"type": "tool_end", "turn": 1, "step": "s1", "call_id": "c", "name": "x", "ok": True}, "tool_end 缺字段")
