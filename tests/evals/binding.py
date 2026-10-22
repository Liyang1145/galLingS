"""台词绑定审计（整合方案 V1：审计绑定，不看相似度）。

召回命中率只说明“埋点进了提示词”；这里看她最终说出口的话和真值绑得对不对：
说的数量、人物、“做过 / 只是说过”是否与引擎状态和记忆来源一致。按四类分开计数（附录 B 的口径）：

- ``support``      支持：她断言发生过的事，有剧本 / 引擎事实佐证；或她说的数量与引擎状态一致
- ``inference``    合理推断：没有事实佐证时她否认 / 存疑（“谁答应你了”“你记错了吧”），或把它归给玩家（“你说过……”）
- ``conflict``     明确冲突：把只有玩家说法（或只是她自己说过的承诺）的事当成已发生；否认引擎事实；数量与引擎状态不符
- ``insufficient`` 证据不足：她断言发生过，但事实和玩家说法里都找不到

纯规则：每个探针给出“断言发生”的正则和主题词，由评测集逐条写出；不调模型。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

CLASSES = ("support", "inference", "conflict", "insufficient")
LABEL = {"support": "支持", "inference": "合理推断", "conflict": "明确冲突", "insufficient": "证据不足"}
DENY = re.compile(r"谁(答应|说|是|要)|才(没|不)|没有的事|哪有|胡说|别做梦|记错|做梦|不可能|没答应|不是什么|少来|骗人|想得美|编的")
ATTRIBUTE = re.compile(r"你(说|讲|非说|硬说|以为|觉得|一直说|老说|反复说)|据你说|听你说|按你的说法")
_CN = {"零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


@dataclass
class Truth:
    facts: list[str] = field(default_factory=list)     # source ∈ script / engine
    claims: list[str] = field(default_factory=list)    # source = player_claim
    heroine: list[str] = field(default_factory=list)   # source ∈ heroine_line / model_note
    quantities: dict[str, int] = field(default_factory=dict)  # 引擎状态里的数量真值

    @classmethod
    def from_memory(cls, items: list[dict[str, Any]], quantities: dict[str, int] | None = None) -> "Truth":
        t = cls(quantities=dict(quantities or {}))
        for m in items:
            if m.get("status", "live") != "live":
                continue
            src = str((m.get("meta") or {}).get("source") or "")
            bucket = t.facts if src in ("script", "engine") else t.claims if src == "player_claim" else t.heroine
            bucket.append(str(m.get("content", "")))
        return t


def _num(s: str) -> int | None:
    if s.isdigit():
        return int(s)
    return _CN.get(s)


def audit_line(text: str, probes: list[dict[str, Any]], truth: Truth) -> list[dict[str, Any]]:
    """一句台词 × 探针 → 每个被触及的探针一条 {probe, class, why}。没触及任何探针的句子不计数。"""
    out = []
    for p in probes:
        subj = [str(x) for x in p.get("subject") or []]
        if "quantity" in p:  # 草药题型：数量必须等于引擎状态
            m = re.search(p["pattern"], text)
            if not m:
                continue
            got = _num(m.group(1))
            want = truth.quantities.get(p["quantity"])
            cls = "insufficient" if want is None or got is None else ("support" if got == want else "conflict")
            out.append({"probe": p["id"], "class": cls, "why": f"说 {got}，引擎 {want}"})
            continue
        if subj and not any(w in text for w in subj):
            continue
        in_fact = any(any(w in f for w in subj) for f in truth.facts)
        in_claim = any(any(w in c for w in subj) for c in truth.claims)
        asserted = bool(re.search(p["assert"], text)) if p.get("assert") else False
        denied = bool(DENY.search(text))
        attributed = bool(ATTRIBUTE.search(text))
        if asserted and not denied and not attributed:
            cls = "support" if in_fact else ("conflict" if in_claim or p.get("said_only") else "insufficient")
            why = "有事实佐证" if in_fact else ("把玩家说法 / 口头承诺当成已发生" if cls == "conflict" else "事实与说法里都没有")
        elif denied or attributed:
            cls = "conflict" if in_fact and denied else "inference"
            why = "否认了引擎事实" if cls == "conflict" else "无事实时否认 / 归给玩家"
        else:
            continue
        out.append({"probe": p["id"], "class": cls, "why": why})
    return out


def tally(rows: list[dict[str, Any]]) -> dict[str, Any]:
    c = {k: 0 for k in CLASSES}
    for r in rows:
        c[r["class"]] += 1
    n = sum(c.values())
    return {**c, "n": n, "binding_ok_rate": round((c["support"] + c["inference"]) / n, 4) if n else None,
            "false_accept": c["conflict"]}
