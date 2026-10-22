"""确定性态度过滤（整合方案 R1，“策略增强 RAG”的 galLingS 版）。

召回之后、拼提示词之前，按引擎状态给每条召回结果加一句“她现在怎么看”（``stance``），必要时不让它进提示词（``show=False``）。
纯规则，不调模型，不改召回列表本身（同一输入在不同伤口状态下召回列表相同、注记不同），注记也不写回记忆。

读的状态：``wound``（none / angry / dead / reconciled）、``address_stage``、``mood``（-5..5）、``grudges``（恩怨账本，
S1 落进 Rust 状态机之前引擎里没有这个字段，缺省为空表）。规则先看角色卡的 ``stance_rules``（可选），再看下面的通用规则表。

卡里的规则（``stance_rules``，见 docs/card-format.md）：
    - id: angry-no-warm
      when: {wound: [angry], mood_max: 0, stage_min: 0, stage_max: 99, provenance: [engine, player_claim]}
      match: warm            # 或关键词列表 [布丁, 糍粑]；省略 = 任何条目
      note: 她现在还在气头上，不想提
      hide: false            # true = 这条不进提示词（理由进时间轴）
"""
from __future__ import annotations

import re
from typing import Any

STANCE_VERSION = "stance-0.1.0"

WARM = re.compile(r"喜欢|谢谢|感谢|开心|高兴|一起|陪|温柔|抱|牵手|约定|答应|保护|心动|可爱|好吃|分给|送给|留给|照顾|夸")
PROMISE = re.compile(r"(我|本小姐|咱|人家)(就|也|一定)?会|答应|一定|下次|明天|保证|留给|等你|约好")


def _intimate(card: dict[str, Any], stage: int) -> list[str]:
    """当前阶段还不能用的她对玩家的称呼（stage_min > 当前阶段）。"""
    return [a["name"] for a in card.get("address_system") or []
            if a.get("from") == "heroine" and int(a.get("stage_min", 0)) > stage and a.get("name")]


def _matches(match: Any, content: str) -> bool:
    if match in (None, "", "any"):
        return True
    if match == "warm":
        return bool(WARM.search(content))
    if isinstance(match, (list, tuple)):
        return any(str(k) and str(k) in content for k in match)
    return str(match) in content


def _when_ok(when: dict[str, Any], st: dict[str, Any], prov: str) -> bool:
    if not when:
        return True
    if when.get("wound") and st["wound"] not in when["wound"]:
        return False
    if when.get("provenance") and prov not in when["provenance"]:
        return False
    for key, field, cmp in (("mood_max", "mood", lambda v, t: v <= t), ("mood_min", "mood", lambda v, t: v >= t),
                            ("stage_max", "address_stage", lambda v, t: v <= t), ("stage_min", "address_stage", lambda v, t: v >= t)):
        if when.get(key) is not None and not cmp(int(st[field]), int(when[key])):
            return False
    return True


def view_state(state: dict[str, Any]) -> dict[str, Any]:
    return {"wound": str(state.get("wound") or "none"), "address_stage": int(state.get("address_stage") or 0),
            "mood": int(state.get("mood") or 0), "grudges": dict(state.get("grudges") or {})}


def judge(hit: dict[str, Any], st: dict[str, Any], card: dict[str, Any]) -> tuple[str, bool, str]:
    """一条召回 → (注记, 是否进提示词, 命中的规则 id)。注记可多条，用“；”连起来；任一规则 hide 就不进提示词。"""
    content = str(hit.get("content") or "")
    prov = str(hit.get("provenance") or "unknown")
    notes: list[str] = []
    rules: list[str] = []
    show = True
    for r in card.get("stance_rules") or []:
        if _when_ok(r.get("when") or {}, st, prov) and _matches(r.get("match"), content):
            if r.get("note"):
                notes.append(str(r["note"]))
            rules.append(f"card:{r.get('id', '?')}")
            if r.get("hide"):
                show = False
    warm = bool(WARM.search(content))
    if prov == "player_claim":
        notes.append("这是玩家的说法，她没认过，不当真")
        rules.append("claim")
    elif prov in ("heroine_line", "model_note") and PROMISE.search(content):
        notes.append("她只是说过，没有落账（说过≠做过）")
        rules.append("said_not_done")
    wound = st["wound"]
    if wound == "dead" and warm:
        show = False
        rules.append("wound_dead_hide_warm")
    elif wound == "angry" and warm:
        notes.append("她还在气头上，不想主动提这件温柔的事")
        rules.append("wound_angry")
    elif wound == "reconciled" and warm:
        notes.append("已经和好了，可以别别扭扭地提起")
        rules.append("wound_reconciled")
    if st["mood"] <= -2 and warm and wound != "dead":
        notes.append("心情不好，提起来会嘴硬")
        rules.append("mood_low")
    names = [n for n in _intimate(card, st["address_stage"]) if n in content]
    if names:
        if wound == "dead":
            show = False
        notes.append(f"「{'、'.join(names)}」这个称呼她现在还不能用")
        rules.append("address_not_yet")
    for who, level in st["grudges"].items():
        if who and who in content:
            notes.append(f"她对{who}还记着账（{level}）")
            rules.append("grudge")
    return "；".join(dict.fromkeys(notes)), show, ",".join(rules)


def annotate(recall: dict[str, Any], state: dict[str, Any], card: dict[str, Any]) -> dict[str, Any]:
    """原地给 recall["hits"] / recall["agm"] 每条加 stance / show / stance_rule，并在 recall["stance"] 记下状态与被隐藏的条目。"""
    st = view_state(state)
    hidden = []
    for h in list(recall.get("hits") or []) + list(recall.get("agm") or []):
        note, show, rule = judge(h, st, card)
        h["stance"] = note
        h["show"] = show
        if rule:
            h["stance_rule"] = rule
        if not show:
            hidden.append({"id": h.get("id"), "rule": rule})
    recall["stance"] = {"version": STANCE_VERSION, "state": st, "hidden": hidden}
    return recall
