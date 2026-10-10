"""编译器 + Rust 核心（galcore）：确定性、预算、事务、时间线、AGM。PLAN §18 M0/M1 验收的自动化部分。"""
from __future__ import annotations

import json
import random

import galcore
import pytest

from .conftest import CH01


def eng(ch, card, seed=7, **cfg):
    return galcore.Engine(json.dumps(ch, ensure_ascii=False), json.dumps(card, ensure_ascii=False), json.dumps(cfg), seed)


def step(e, kind, **payload):
    return json.loads(e.step(json.dumps({"kind": kind, "payload": payload}, ensure_ascii=False)))


def run_path(e, rng):
    for _ in range(2000):
        st = json.loads(e.state_json())
        if st["wait"] == "end":
            return st
        if st["wait"] == "choice":
            op = e_choice(e)
            step(e, "choice", option_id=rng.choice([o["id"] for o in op["options"]]))
        else:
            step(e, "advance")
    raise AssertionError("走不完")


def e_choice(e):
    snap = json.loads(e.snapshot())
    return None if snap is None else _CH["program"][snap["state"]["pc"]]


_CH: dict = {}


def test_compile_deterministic(mini_dir):
    from compiler.compile import canonical, compile_chapter
    a, _ = compile_chapter(mini_dir / "mini.md", mini_dir / "beats.yaml")
    b, _ = compile_chapter(mini_dir / "mini.md", mini_dir / "beats.yaml")
    assert canonical(a) == canonical(b)
    assert a["analysis"]["affection"] == [-4, 5]
    assert a["analysis"]["dead_ends"] == [] and a["analysis"]["unreachable"] == []
    kinds = [o["op"] for o in a["program"]]
    assert kinds.count("CHOICE") == 2 and kinds.count("SAVEPOINT") == 1 and kinds[-1] == "END"


def test_random_paths_end_in_range(mini_chapter, cat_card):
    _CH.clear()
    _CH.update(mini_chapter)
    rng = random.Random(1)
    lo, hi = mini_chapter["rules"]["affection_range"]
    for i in range(300):
        st = run_path(eng(mini_chapter, cat_card, seed=i), rng)
        assert lo <= st["affection"] + st["deferred"] <= hi


@pytest.mark.skipif(not (CH01 / "ch01.md").exists(), reason="正式剧本不在仓库里（内容授权未定）")
def test_ch01_1000_paths():
    from compiler.compile import compile_chapter
    from server.content import load_card_any
    ch, _ = compile_chapter(CH01 / "ch01.md", CH01 / "beats.yaml", CH01.parent / "appendix_e.md")
    card = load_card_any(CH01.parents[1] / "cards" / "whale.yaml")
    _CH.clear()
    _CH.update(ch)
    rng = random.Random(2)
    seen = set()
    for i in range(1000):
        st = run_path(eng(ch, card, seed=i), rng)
        assert -17 <= st["affection"] <= 23
        assert st["tails_script"] <= 4
        seen.add(st["affection"])
    assert min(seen) == -17 and max(seen) == 20


def to_choice(e, ch):
    _CH.clear()
    _CH.update(ch)
    while json.loads(e.state_json())["wait"] != "choice":
        step(e, "advance")


def test_ai_turn_budget_and_rules(mini_chapter, cat_card):
    e = eng(mini_chapter, cat_card, mode="ai")
    to_choice(e, mini_chapter)
    b = json.loads(e.budget_json())
    assert b["room_up"] <= 3 and b["room_down"] <= 3  # 插曲净额 ±3
    step(e, "player_input", text="你好")
    step(e, "turn_begin")
    r = step(e, "model_tool_call", tool="propose_affection", args={"surface": 5, "reason": "x"})
    v = r["verdicts"][0]
    assert v["result"] == "clamped" and v["applied"]["surface"] <= 3
    assert step(e, "model_tool_call", tool="honesty_signal", args={"signal_id": "nope", "action": "x"})["verdicts"][0]["rule"] == "unknown_signal"
    assert step(e, "model_tool_call", tool="honesty_signal", args={"signal_id": "heart", "action": "勾"})["verdicts"][0]["result"] == "applied"
    assert step(e, "model_tool_call", tool="honesty_signal", args={"signal_id": "heart", "action": "勾"})["verdicts"][0]["rule"] == "ai_tail_max"
    assert step(e, "model_tool_call", tool="request_ending", args={"summary": "x"})["verdicts"][0]["rule"] == "director_only"
    assert step(e, "model_tool_call", tool="taboo_event", args={})["verdicts"][0]["result"] == "rejected"
    with pytest.raises(ValueError):
        step(e, "advance")  # 回合中不能推进剧本
    step(e, "turn_commit")
    st = json.loads(e.state_json())
    assert st["tails_ai"] == 1 and st["affection"] + st["deferred"] == v["applied"]["surface"]


def test_abort_discards_draft(mini_chapter, cat_card):
    e = eng(mini_chapter, cat_card, mode="ai")
    to_choice(e, mini_chapter)
    before = json.loads(e.state_json())
    step(e, "turn_begin")
    step(e, "model_tool_call", tool="propose_affection", args={"surface": 2, "reason": "x"})
    step(e, "turn_abort")
    after = json.loads(e.state_json())
    assert after["affection"] == before["affection"] and after["ai_rounds"] == 1


def test_steer_back_after_three_rounds(mini_chapter, cat_card):
    e = eng(mini_chapter, cat_card, mode="ai")
    to_choice(e, mini_chapter)
    for _ in range(3):
        step(e, "turn_begin")
        r = step(e, "turn_commit")
    assert any(v["rule"] == "steer_back" for v in r["verdicts"])
    with pytest.raises(ValueError):
        step(e, "turn_begin")
    r = step(e, "player_input", text="还想说")
    assert r["verdicts"][0]["rule"] == "input_closed"


def test_intent_match_takes_option(mini_chapter, cat_card):
    e = eng(mini_chapter, cat_card, mode="ai")
    to_choice(e, mini_chapter)
    r = step(e, "intent", intent="顺毛", matched_option="mini.choice.1.A", confidence_milli=900)
    assert any(o["op"] == "SAY" for o in r["ops"])
    assert json.loads(e.state_json())["history"] == ["mini.choice.1.A"]


def test_snapshot_load_new_lineage_and_agm_visibility(mini_chapter, cat_card):
    e = eng(mini_chapter, cat_card, mode="ai")
    to_choice(e, mini_chapter)
    snap = json.loads(e.snapshot())
    step(e, "player_input", text="a")
    step(e, "memory_write", cooccur=["m1", "m2"])
    step(e, "load", snapshot=snap, new_lineage="L0.1")
    vis = json.loads(e.visible_json())
    assert vis[0]["lineage"] == "L0.1" and vis[1] == {"lineage": "L0", "max_turn": snap["state"]["turn"]}
    # 被放弃时间线（L0 回合 1）的共现边对新线不可见
    assert json.loads(e.agm_recall(json.dumps([{"id": "m1", "score": 1000}]), "[]", 3)) == []
    step(e, "memory_write", cooccur=["m1", "m3"])
    got = json.loads(e.agm_recall(json.dumps([{"id": "m1", "score": 1000}]), "[]", 3))
    assert [g["id"] for g in got] == ["m3"]


def test_replay_hash_identical(mini_chapter, cat_card):
    rng = random.Random(5)
    _CH.clear()
    _CH.update(mini_chapter)
    a, b = eng(mini_chapter, cat_card, seed=3), eng(mini_chapter, cat_card, seed=3)
    events = []
    for _ in range(200):
        st = json.loads(a.state_json())
        if st["wait"] == "end":
            break
        if st["wait"] == "choice":
            ev = {"kind": "choice", "payload": {"option_id": rng.choice([o["id"] for o in _CH["program"][st["pc"]]["options"]])}}
        else:
            ev = {"kind": "advance", "payload": {}}
        events.append((ev, json.loads(a.step(json.dumps(ev)))["state_hash"]))
    for ev, h in events:
        assert json.loads(b.step(json.dumps(ev)))["state_hash"] == h
