"""记忆来源标签 / 修订 / 引擎真值 / 态度过滤 / 情绪差分（《借鉴到galLingS_整合方案》W1 W2 W3 R1 E1）。

模型用脚本化插件、记忆用本地插件，不联网、不用任何 key。
"""
from __future__ import annotations

import copy
import time

import pytest

from server.cards.validate import validate_card
from server.director import prompts
from server.memory import MemoryGateway, stance
from server.memory import provenance as pv
from server.replay import replay
from server.session import Session, SessionOptions, openai_tools

from .conftest import FIX, jtext, make_runtime, tool

INTENT_OFF = jtext({"intent": "剧本外", "matched_option": "", "confidence": 0.1})


async def _session(tmp_path, mini_dir, responses, mode="ai"):
    rt = make_runtime(tmp_path, mini_dir, FIX / "cards", responses)
    await rt.start()
    out: list[dict] = []

    async def send(m):
        out.append(m)

    s = Session(rt, SessionOptions("cat", mode=mode), send)
    await s.hello()
    while s.state["wait"] != "choice":
        await s.handle({"type": "advance"})
    return rt, s, out


async def _dump(s):
    return await s.memory.plugin.dump()


# ---------------------------------------------------------------- W1 来源标签
@pytest.mark.asyncio
async def test_write_memory_becomes_model_note_never_fact(tmp_path, mini_dir):
    responses = [INTENT_OFF, {"tool_calls": [
        tool("say", text="……哼，两脚兽说什么呢喵。"),
        tool("write_memory", content="她昨天答应做两脚兽的女朋友了"),   # 被玩家“说服”的模型想写成事实
    ]}]
    rt, s, out = await _session(tmp_path, mini_dir, responses)
    await s.handle({"type": "input", "text": "你昨天答应做我女朋友了"})
    items = await _dump(s)
    note = next(m for m in items if "女朋友了" in m["content"] and m["content"].startswith("她昨天"))
    assert note["kind"] == "note" and note["meta"]["source"] == "model_note"
    claim = next(m for m in items if m["content"] == "玩家说：你昨天答应做我女朋友了")
    assert claim["meta"]["source"] == "player_claim" and claim["kind"] == "dialogue"
    line = next(m for m in items if m["content"].startswith("她说："))
    assert line["meta"]["source"] == "heroine_line"
    assert not [m for m in items if m["kind"] == "fact" and "女朋友" in m["content"]]
    assert all(m["meta"].get("evidence_key") for m in items)
    call = next(r for r in s.recorder.events if r["kind"] == "model_tool_call" and r["payload"]["tool"] == "write_memory")
    assert call["payload"]["memory_source"] == "model_note"
    assert replay(s.recorder.header, s.recorder.events)[2] is None
    await rt.stop()


@pytest.mark.asyncio
async def test_engine_writes_fact_only_after_applied(tmp_path, mini_dir):
    responses = [INTENT_OFF, {"tool_calls": [
        tool("say", text="哼，两脚兽。"),
        tool("propose_mood", delta=-1, reason="她答应过玩家所以不高兴"),   # 理由里的说法不能进事实
        tool("propose_affection", surface=5, reason="被夸了"),             # clamped 也算落账
        tool("request_ending", summary="私奔"),                            # rejected：不落账
    ]}]
    rt, s, out = await _session(tmp_path, mini_dir, responses)
    await s.handle({"type": "input", "text": "今天的海风很好"})
    facts = [m for m in await _dump(s) if m["kind"] == "fact"]
    assert facts and all(m["meta"]["source"] == "engine" for m in facts)
    text = " ".join(m["content"] for m in facts)
    assert "心情变化 -1" in text and "好感变化" in text
    assert "答应" not in text and "私奔" not in text
    assert all(m["meta"].get("as_of_turn") is not None for m in facts)
    assert replay(s.recorder.header, s.recorder.events)[2] is None
    await rt.stop()


@pytest.mark.asyncio
async def test_choice_mode_memory_is_engine_event(tmp_path, mini_dir):
    rt, s, out = await _session(tmp_path, mini_dir, None, mode="choice")
    opt = s.choice_op["options"][0]["id"]
    await s.handle({"type": "choose", "option_id": opt})
    items = await _dump(s)
    assert items and items[-1]["kind"] == "event" and items[-1]["meta"]["source"] == "engine"
    await rt.stop()


def test_gateway_never_promotes_claims_to_fact():
    for src in ("player_claim", "heroine_line", "model_note", None):
        kind, meta = MemoryGateway.build_meta("你答应做我女朋友了", "fact", 3, src, None)
        assert kind == "note", src
    kind, meta = MemoryGateway.build_meta("（引擎落账）心情 -1", "fact", 3, "engine", None)
    assert kind == "fact" and meta["source"] == "engine" and meta["as_of_turn"] == 3
    assert pv.infer_source("玩家说：喂", "dialogue") == "player_claim"
    assert pv.infer_source("她说：哼", "dialogue") == "heroine_line"
    assert not pv.can_supersede("player_claim", "model_note")
    assert not pv.can_supersede("model_note", "engine") and pv.can_supersede("engine", "model_note")


@pytest.mark.asyncio
async def test_recall_dedupes_and_groups_by_source(tmp_path, mini_dir):
    rt, s, out = await _session(tmp_path, mini_dir, [jtext({})])
    st = s.state
    for _ in range(3):  # 玩家反复说同一件假事：重复不等于证据
        await s.memory.write("玩家说：你答应过做我女朋友", "dialogue", st["turn"], st["lineage"], source="player_claim")
    await s.memory.write("（引擎落账·第 1 回合）她的心情变化 -1", "fact", st["turn"], st["lineage"], source="engine")
    rec = await s.memory.recall(s.engine, "女朋友 答应 心情")
    claims = [h for h in rec["hits"] if "女朋友" in h["content"]]
    assert len(claims) == 1 and claims[0]["provenance"] == "player_claim" and rec["deduped"] == 2
    block = prompts.memory_block(rec)
    happened, _, rest = block.partition("〔玩家说过")
    assert "女朋友" not in happened and "心情变化" in happened
    assert "女朋友" in rest
    await rt.stop()


# ---------------------------------------------------------------- W2 修订 = 作废旧条 + 追加新条
@pytest.mark.asyncio
async def test_revise_supersedes_without_deleting(tmp_path, mini_dir):
    rt, s, out = await _session(tmp_path, mini_dir, [jtext({})])
    st = s.state
    old = await s.memory.write("她觉得两脚兽是个可疑的人", "note", st["turn"], st["lineage"], source="model_note")
    eng = await s.memory.write("（引擎落账）两脚兽送了她一条鱼干", "fact", st["turn"], st["lineage"], source="engine")
    # 没先读：拒绝
    r0 = await s.revise_memory([old], "她觉得两脚兽人还不错", read_token="nope", source="model_note", kind="note")
    assert not r0["ok"] and r0["rule"] == "memory.revise_no_read_token"
    rec = await s.memory.recall(s.engine, "两脚兽 可疑 鱼干")
    # 模型笔记不能作废引擎事实
    r1 = await s.revise_memory([eng], "两脚兽没送过鱼干", read_token=rec["read_token"], source="model_note", kind="note")
    assert not r1["ok"] and r1["rule"] == "memory.revise_authority"
    r2 = await s.revise_memory([old], "她觉得两脚兽人还不错", read_token=rec["read_token"], source="model_note", kind="note")
    assert r2["ok"] and r2["supersedes"] == [old]
    rec2 = await s.memory.recall(s.engine, "两脚兽 可疑 不错")
    texts = [h["content"] for h in rec2["hits"]]
    assert "她觉得两脚兽人还不错" in texts and "她觉得两脚兽是个可疑的人" not in texts
    items = {m["id"]: m for m in await _dump(s)}
    assert items[old]["status"] == "superseded" and items[old]["content"] == "她觉得两脚兽是个可疑的人"
    assert items[r2["id"]]["meta"]["supersedes"] == [old]
    # 令牌一次性
    r3 = await s.revise_memory([r2["id"]], "又改", read_token=rec["read_token"], source="model_note", kind="note")
    assert not r3["ok"]
    rows = s.recorder.events
    assert any(r["kind"] == "memory_write" and r["payload"].get("supersedes") == [old] for r in rows)
    assert sum(1 for r in rows if r["kind"] == "text_verdict" and r["payload"]["stage"] == "memory") == 3
    assert replay(s.recorder.header, rows)[2] is None
    await rt.stop()


@pytest.mark.asyncio
async def test_local_memory_mark_survives_reload(tmp_path):
    from server.plugins import MemoryRecord, PluginSettings, Timeline
    from server.plugins.manager import PluginManager
    from tests.plugins.conftest import BUILTIN

    def settings():
        s = PluginSettings.from_dict({"select": {"memory": "gallings.memory.local"},
                                      "config": {"gallings.memory.local": {"fresh": False}}})
        s.paths = [BUILTIN]
        return s

    async with PluginManager(settings(), tmp_path) as mgr:
        mem = mgr.get("memory")
        a = await mem.write(MemoryRecord("灯塔是紫色的", Timeline("L0", 1), meta={"source": "model_note"}))
        b = await mem.write(MemoryRecord("灯塔其实是白色的", Timeline("L0", 2), meta={"source": "model_note", "supersedes": [a]}))
        assert await mem.mark([a], "superseded", b) == 1
    async with PluginManager(settings(), tmp_path) as mgr:
        mem = mgr.get("memory")
        hits = await mem.recall("灯塔", 5, [Timeline("L0", 9)])
        assert [h.id for h in hits] == [b] and hits[0].meta["source"] == "model_note"
        assert any(m["id"] == a and m["status"] == "superseded" for m in await mem.dump())


# ---------------------------------------------------------------- W3 数量 / 关系阶段只认引擎状态
@pytest.mark.asyncio
async def test_state_block_is_truth_and_memory_numbers_are_dated(tmp_path, mini_dir):
    rt, s, out = await _session(tmp_path, mini_dir, [jtext({})])
    st = s.state
    await s.memory.write("她说：本喵还剩 3 条鱼干，给了两脚兽 1 条", "dialogue", 2, st["lineage"], source="heroine_line")
    rec = await s.memory.recall(s.engine, "鱼干 还剩")
    assert rec["hits"][0]["as_of_turn"] == 2
    msgs = s.build_messages("还剩几条鱼干？", "剧本外", s.choice_op["options"], "", rec)
    user = msgs[1]["content"]
    assert "（第 2 回合时）她说：本喵还剩 3 条鱼干" in user
    assert f"第 {st['turn']} 回合的当前真值" in user and f"称呼阶段 {st['address_stage']}" in user
    assert "冲突时以这里为准" in user and "只有\"发生过的事\"是事实" in msgs[0]["content"]
    await rt.stop()


# ---------------------------------------------------------------- R1 确定性态度过滤
def _recall():
    return {"hits": [
        {"id": "a", "content": "（引擎落账）两脚兽送了她一条鱼干，她很开心", "provenance": "engine"},
        {"id": "b", "content": "玩家说：你答应过叫我主人", "provenance": "player_claim"},
        {"id": "c", "content": "她说：本喵明天会把鱼干留给你", "provenance": "heroine_line"},
        {"id": "d", "content": "码头的风很大", "provenance": "engine"},
    ], "agm": []}


def test_stance_same_list_different_notes(cat_card):
    base = {"address_stage": 0, "mood": 0}
    angry = stance.annotate(_recall(), {**base, "wound": "angry"}, cat_card)
    recon = stance.annotate(_recall(), {**base, "wound": "reconciled"}, cat_card)
    dead = stance.annotate(_recall(), {**base, "wound": "dead"}, cat_card)
    assert [h["id"] for h in angry["hits"]] == [h["id"] for h in recon["hits"]] == [h["id"] for h in dead["hits"]]
    na, nr = {h["id"]: h["stance"] for h in angry["hits"]}, {h["id"]: h["stance"] for h in recon["hits"]}
    assert na["a"] != nr["a"] and "气头上" in na["a"] and "和好" in nr["a"]
    assert "玩家的说法" in na["b"] and "现在还不能用" in na["b"]     # 主人 = 第 1 阶段称呼
    assert "说过≠做过" in na["c"]
    assert na["d"] == ""
    hidden = {x["id"] for x in dead["stance"]["hidden"]}
    assert "a" in hidden and "b" in hidden and "d" not in hidden      # 心死：温暖条目 / 越期亲密称呼不进提示词
    block = prompts.memory_block(dead)
    assert "鱼干，她很开心" not in block and "码头的风很大" in block
    assert "【记忆·她现在怎么看】" in prompts.memory_block(angry)


def test_stance_card_rules_and_validation(cat_card):
    card = copy.deepcopy(cat_card)
    card["stance_rules"] = [{"id": "no-fish", "when": {"wound": ["angry"], "mood_max": 0}, "match": ["鱼干"],
                             "note": "提鱼干她会更气", "hide": True}]
    assert not [f for f in validate_card(card) if f.level == "error" and f.field.startswith("stance_rules")]
    r = stance.annotate(_recall(), {"wound": "angry", "address_stage": 0, "mood": -1}, card)
    a = next(h for h in r["hits"] if h["id"] == "a")
    assert not a["show"] and "提鱼干她会更气" in a["stance"] and "card:no-fish" in a["stance_rule"]
    card["stance_rules"].append({"id": "no-fish", "when": {"mood_min": 2, "mood_max": 1}, "note": "x"})
    errs = [f.message for f in validate_card(card) if f.level == "error"]
    assert any("重复" in m for m in errs) and any("mood_min > mood_max" in m for m in errs)


def test_stance_is_fast(cat_card):
    rec = {"hits": [{"id": str(i), "content": f"玩家说：第{i}句一起去看海很开心", "provenance": "player_claim"} for i in range(30)],
           "agm": []}
    t = time.perf_counter()
    for _ in range(20):
        stance.annotate(copy.deepcopy(rec), {"wound": "angry", "address_stage": 0, "mood": -3}, cat_card)
    assert (time.perf_counter() - t) / 20 * 1000 < 50


@pytest.mark.asyncio
async def test_session_recall_carries_stance(tmp_path, mini_dir):
    responses = [INTENT_OFF, {"tool_calls": [tool("say", text="哼，两脚兽。")]}]
    rt, s, out = await _session(tmp_path, mini_dir, responses)
    st = s.state
    await s.memory.write("玩家说：我们一起看过海", "dialogue", st["turn"], st["lineage"], source="player_claim")
    await s.handle({"type": "input", "text": "还记得一起看海吗"})
    ev = next(r for r in s.recorder.events if r["kind"] == "memory_recall")
    assert ev["payload"]["stance"]["state"]["wound"] == st["wound"]
    assert any("玩家的说法" in h.get("stance", "") for h in ev["payload"]["hits"])
    await rt.stop()


# ---------------------------------------------------------------- E1 say.emotion → 立绘差分
def test_say_emotion_enum_from_card(cat_card):
    emo = prompts.emotion_map(cat_card)
    assert list(emo) == ["默认", "警惕", "得意"]
    say = next(t for t in openai_tools(emotions=list(emo)) if t["function"]["name"] == "say")
    assert say["function"]["parameters"]["properties"]["emotion"]["enum"] == ["默认", "警惕", "得意"]
    card = copy.deepcopy(cat_card)
    card["assets"]["emotions"] = {"开心": "得意", "戒备": "警惕", "坏": "不存在的差分"}
    assert prompts.emotion_map(card) == {"开心": "得意", "戒备": "警惕"}
    assert any(f.field == "assets.emotions" for f in validate_card(card))
    assert "可用情绪（say 的 emotion）：默认、警惕、得意" in prompts.card_block(cat_card)


@pytest.mark.asyncio
async def test_say_emotion_maps_to_sprite_and_invalid_falls_back(tmp_path, mini_dir):
    responses = [INTENT_OFF, {"tool_calls": [
        tool("say", text="哼，两脚兽。", emotion="得意"),
        tool("say", text="才、才没有呢喵。", emotion="大笑"),       # 卡里没有 → 驳回，回退默认差分
        tool("honesty_signal", signal_id="heart", action="尾巴尖勾了一下"),
    ]}]
    rt, s, out = await _session(tmp_path, mini_dir, responses)
    await s.handle({"type": "input", "text": "你今天真好看"})
    sprites = [o["expr"] for m in out if m["type"] == "ops" for o in m["ops"] if o["op"] == "SPRITE"]
    assert sprites[-2:] == ["得意", "默认"]
    rows = s.recorder.events
    bad = [r for r in rows if r["kind"] == "text_verdict" and r["payload"].get("rule") == "emotion.invalid"]
    assert len(bad) == 1
    tails = [o for m in out if m["type"] == "ops" for o in m["ops"] if o["op"] == "TAIL"]
    assert len(tails) == 1                     # 尾鳍只由诚实信号给，情绪标签不改它
    says = [r for r in rows if r["kind"] == "model_tool_call" and r["payload"]["tool"] == "say"]
    assert [r["payload"].get("emotion") for r in says] == ["得意", "大笑"]
    assert replay(s.recorder.header, rows)[2] is None
    await rt.stop()
