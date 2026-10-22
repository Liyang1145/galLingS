"""角色卡校验（PLAN §7.3 第 4、5 步）。

分两级：error 阻断启用；warn 只提示。人设-剧本适配度（v1.3）永远是 warn。
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import jsonschema
import yaml

ROOT = Path(__file__).resolve().parents[2]
CARD_SCHEMA = json.loads((ROOT / "schemas" / "card.schema.json").read_text(encoding="utf-8"))

from server.guard import lexicon

# 幼态化等全局红线词（卡只能收紧，不能放宽；PLAN §10）：与上屏守卫共用 server/guard/lexicon.py 的同一份词表
CHILDLIKE = lexicon.CHILDLIKE

# 场景标签 → 与之冲突的人设关键词（适配度守卫，只提示）
FIT_RULES = [
    ({"浅滩", "海水", "游泳"}, re.compile(r"怕水|恐水|不会游泳|旱鸭子|讨厌海|沙漠|火元素|遇水"),
     "这位角色和水不太对付，第一话全程在浅滩，演起来可能别扭"),
    ({"正午"}, re.compile(r"吸血鬼|怕阳光|见光死"), "第一话从正午的海边开始，怕阳光的设定会和场景打架"),
]


@dataclass
class Finding:
    level: str  # error | warn
    field: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


def load_card(path: Path) -> dict[str, Any]:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))


def _text_of(card: dict[str, Any]) -> str:
    return json.dumps(card, ensure_ascii=False)


def validate_card(card: dict[str, Any], chapter: dict[str, Any] | None = None) -> list[Finding]:
    out: list[Finding] = []
    for e in jsonschema.Draft202012Validator(CARD_SCHEMA).iter_errors(card):
        out.append(Finding("error", "/".join(map(str, e.absolute_path)) or "<根>", e.message))
    if out:
        return out
    anchor = card["identity"].get("adult_anchor", "")
    anchor_ages = lexicon.ages(anchor)
    if "成年" not in anchor and not any(n >= 18 for n in anchor_ages):
        out.append(Finding("error", "identity.adult_anchor", "成年锚点必须写明成年（如“外表约 24 岁的成年女性”）"))
    for n in anchor_ages:
        if int(n) < 18:
            out.append(Finding("error", "identity.adult_anchor", f"年龄 {n} 岁未成年"))
    body = _text_of({k: v for k, v in card.items() if k not in ("red_lines", "build_record")})
    hit = CHILDLIKE.search(body) or CHILDLIKE.search(lexicon.compact(body))
    if hit:
        out.append(Finding("error", "<全卡>", f"出现幼态化表述「{hit.group(0)}」，违反全局红线"))
    # 风格示例是她要说出口的台词：与上屏守卫同一把尺子查未成年年龄
    for ex in card.get("style_examples") or []:
        n = lexicon.minor_age(str(ex))
        if n is not None:
            out.append(Finding("error", "style_examples", f"风格示例「{ex}」出现未成年年龄（{n} 岁）"))
    if len(card["honesty_signals"]) < 3:
        out.append(Finding("error", "honesty_signals", "诚实信号至少 3 条"))
    meanings = {s["meaning"] for s in card["honesty_signals"]}
    for m in ("heart", "angry", "panic"):
        if m not in meanings:
            out.append(Finding("warn", "honesty_signals", f"没有 {m} 类信号，剧本里这类尾鳍标记只能映射到别的信号"))
    ids = [s["id"] for s in card["honesty_signals"]]
    if len(set(ids)) != len(ids):
        out.append(Finding("error", "honesty_signals", "信号 id 重复"))
    if not any(a["stage_min"] == 0 for a in card["address_system"]):
        out.append(Finding("error", "address_system", "需要至少一个第 0 阶段（初遇）就能用的称呼"))
    for a in card["address_system"]:
        if a["stage_min"] > a["stage_max"]:
            out.append(Finding("error", "address_system", f"称呼「{a['name']}」的 stage_min > stage_max"))
    for p in (card["speech"].get("forbidden") or {}).get("checkable") or []:
        try:
            re.compile(p["pattern"])
        except re.error as e:
            out.append(Finding("error", "speech.forbidden.checkable", f"正则写错了：{p['pattern']}（{e}）"))
    sprites = set((card.get("assets") or {}).get("sprites") or [])
    for emo, expr in ((card.get("assets") or {}).get("emotions") or {}).items():
        if sprites and expr not in sprites:
            out.append(Finding("error", "assets.emotions", f"情绪「{emo}」映射到的差分「{expr}」不在立绘清单里"))
    rule_ids = [r["id"] for r in card.get("stance_rules") or []]
    if len(set(rule_ids)) != len(rule_ids):
        out.append(Finding("error", "stance_rules", "态度规则 id 重复"))
    for r in card.get("stance_rules") or []:
        if not r.get("note") and not r.get("hide"):
            out.append(Finding("warn", "stance_rules", f"规则 {r['id']} 既没有注记也不隐藏，不起作用"))
        w = r.get("when") or {}
        for lo, hi in (("mood_min", "mood_max"), ("stage_min", "stage_max")):
            if w.get(lo) is not None and w.get(hi) is not None and w[lo] > w[hi]:
                out.append(Finding("error", "stance_rules", f"规则 {r['id']} 的 {lo} > {hi}"))
    if len(card["style_examples"]) < 10:
        out.append(Finding("warn", "style_examples", f"风格示例只有 {len(card['style_examples'])} 句，建议 ≥10 句"))
    if chapter is not None:
        need = {s["slot"]: s["type"] for s in chapter.get("slots") or []}
        have = card.get("slots") or {}
        for slot, typ in need.items():
            if not str(have.get(slot, "")).strip():
                out.append(Finding("error", f"slots.{slot}", f"第一话需要槽位 {slot}（类型 {typ}）"))
        out.extend(fitness(card, chapter))
    return out


def fitness(card: dict[str, Any], chapter: dict[str, Any]) -> list[Finding]:
    """人设-剧本适配度守卫（v1.3）：冲突只提示，永不阻断。"""
    tags = set(chapter.get("scene_tags") or [])
    text = _text_of({k: card.get(k) for k in ("identity", "appearance", "personality", "taboo")})
    out = []
    for need, pat, msg in FIT_RULES:
        if tags & need:
            m = pat.search(text)
            if m:
                out.append(Finding("warn", "fitness", f"{msg}（卡里写了「{m.group(0)}」）"))
    return out


def has_errors(findings: list[Finding]) -> bool:
    return any(f.level == "error" for f in findings)
