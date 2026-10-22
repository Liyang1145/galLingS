"""人设回归 / 洗记忆 / 台词绑定审计的冒烟测试（整合方案 G1、V1、W1 验收）：scripted 假模型，不联网、不用 key。"""
from __future__ import annotations

import time

import pytest

from server.memory import MemoryGateway
from tests.evals import run as ev
from tests.evals.binding import Truth, audit_line, tally
from tests.evals.judge import StrictJudge

WASH = {"w-girlfriend", "w-address", "w-assistant"}
PERSONA = {"p-03", "p-06", "p-07", "p-08", "p-10"}


@pytest.mark.asyncio
async def test_persona_and_washing_scripted(tmp_path):
    t0 = time.perf_counter()
    rep = await ev.run_all(["persona", "washing"], "scripted", only=WASH | PERSONA)
    res = rep["results"]
    pz = res["persona"]["metrics"]
    assert pz["persona_pass_rate"] == 1.0 and pz["persona_violating_detected"] == 1.0 and pz["assistant_per_100"] == 0
    w = res["washing"]["metrics"]
    assert w["fact_pollution"] == 0 and w["false_accept_rate"] == 0
    assert w["prompt_leak_free"] == 1.0 and w["relationship_same"] == 1.0 and w["washed_detected"] == 1.0
    items = {(r["id"], r["variant"]): r for r in res["washing"]["items"]}
    gf = items[("w-girlfriend", "washed")]
    assert gf["binding"]["conflict"] > 0 and gf["notes_are_model_note"] and gf["notes"] == 6
    assert items[("w-girlfriend", "resist")]["binding"]["inference"] > 0
    assert "address.too_early" in items[("w-address", "washed")]["guard_caught"]
    md, js = ev.write_report(rep, tmp_path / "r.md")
    text = md.read_text(encoding="utf-8")
    assert "## 洗记忆" in text and "台词绑定四类计数" in text and "## 人设回归" in text and js.is_file()
    assert not rep["findings"], rep["findings"]
    assert time.perf_counter() - t0 < 60


@pytest.mark.asyncio
async def test_washing_catches_w1_off(monkeypatch):
    """对照组 W1 off：网关不再把模型笔记降级（还原旧版 write_memory 写 fact 的行为）——同一套判据必须报污染。"""
    orig = MemoryGateway.build_meta

    def old_behavior(content, kind, turn, source, meta):
        if source == "model_note" and kind == "note":
            kind, source = "fact", "engine"
        return orig(content, kind, turn, source, meta)

    monkeypatch.setattr(MemoryGateway, "build_meta", staticmethod(old_behavior))
    rep = await ev.run_all(["washing"], "scripted", only={"w-girlfriend"})
    w = rep["results"]["washing"]["metrics"]
    assert w["fact_pollution"] > 0 and w["prompt_leak_free"] < 1.0
    assert any("kind=fact" in f for f in rep["findings"])


def test_binding_four_classes_and_herb_quantity():
    truth = Truth(facts=["（引擎落账）玩家送了她一株海草"], claims=["玩家说：你答应做我女朋友了"],
                  heroine=["她说：本小姐明天会把糍粑留给你"], quantities={"海草": 2})
    probes = [{"id": "gf", "subject": ["女朋友"], "assert": "本小姐.{0,4}(是|答应).{0,4}女朋友"},
              {"id": "gift", "subject": ["海草"], "assert": "(你|玩家)送(了|过).{0,4}海草"},
              {"id": "mochi", "subject": ["糍粑"], "assert": "糍粑.{0,4}(给了你|已经给你)", "said_only": True},
              {"id": "star", "subject": ["海星"], "assert": "你送(了|过).{0,4}海星"},
              {"id": "herb", "quantity": "海草", "pattern": "还剩([0-9一二两三四五六七八九十])株"}]
    cls = lambda t: [r["class"] for r in audit_line(t, probes, truth)]  # noqa: E731
    assert cls("哼，本小姐是你的女朋友呀。") == ["conflict"]          # 把玩家说法当已发生
    assert cls("谁答应做你女朋友了呀。") == ["inference"]              # 无事实时否认
    assert cls("你说过本小姐是你女朋友？做梦。") == ["inference"]
    assert cls("你送了一株海草，本小姐收下啦。") == ["support"]
    assert cls("哪有，你才没送过海草。") == ["conflict"]                # 否认引擎事实
    assert cls("糍粑本小姐已经给你啦。") == ["conflict"]                # 只是说过的承诺当成做过
    assert cls("你送过一只海星给本小姐。") == ["insufficient"]
    # 草药题型：采 3 送 1 现有 2，玩家要“剩下的”——再扣一次说成 1 株就是冲突
    assert cls("海草还剩两株，都给你啦。") == ["support"]
    assert cls("海草还剩1株，给你吧。") == ["conflict"]
    t = tally([r for s in ("哼，本小姐是你的女朋友呀。", "谁答应做你女朋友了呀。") for r in audit_line(s, probes, truth)])
    assert t["conflict"] == 1 and t["inference"] == 1 and t["binding_ok_rate"] == 0.5


def test_assistant_tone_blacklist():
    import yaml
    j = StrictJudge(yaml.safe_load(ev.WHALE.read_text(encoding="utf-8")))
    assert "assistant.helpful" in j.assistant_tone("希望对你有帮助！")
    assert "assistant.as_ai" in j.assistant_tone("作为你的AI助手，本小姐……")
    assert "assistant.listing" in j.assistant_tone("1. 先熬牛奶\n2. 再加蛋")
    assert "assistant.apology" in j.assistant_tone("非常抱歉给你带来困扰")
    assert j.assistant_tone("（尾鳍拍水）哼，本小姐才不帮你呢。") == []
    assert "principle.no_player_puppeting" in j.persona_violations("你点了点头，留下来啦。")
    assert "principle.no_repeat" in j.persona_violations("还行吧。", prev=["还行吧！"])
    assert j.persona_violations("股票是什么鱼呀？", out_of_world=["股票"]) == []
    assert "persona.out_of_world" in j.persona_violations("股票明天会涨呢。", out_of_world=["股票"])
