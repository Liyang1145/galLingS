"""建卡页的 AI 填卡（PLAN §7.3 第 2 步）：先填卡，再按校验结果让模型补一次洞。"""
from __future__ import annotations

import json
import re
from typing import Any

from server.director import prompts
from server.director.llm import complete, parse_json

from .validate import has_errors, validate_card

TEMPLATE: dict[str, Any] = {
    "schema_version": 1, "id": "my-heroine",
    "identity": {"name": "", "species": "", "role": "", "adult_anchor": ""},
    "appearance": {"body": "", "hair": "", "eyes": "", "outfit": ""},
    "personality": {"traits": [""], "laws": [""], "values": [""]},
    "speech": {"self_ref": [""], "sentence_heads": [""], "endings": [""], "metaphor_system": "", "action_markers": "",
               "threats": [""], "catchphrases": [""],
               "forbidden": {"checkable": [{"pattern": "我是AI|语言模型", "reason": "出戏"}], "prose": [""]}},
    "honesty_signals": [{"id": "heart", "body_part": "", "action": "", "meaning": "heart", "intensity": 2}],
    "address_system": [{"from": "heroine", "to": "player", "name": "", "stage_min": 0, "stage_max": 0}],
    "taboo": {"scale": [""], "reverse_scale_event": None, "no_comedy_topics": [""]},
    "red_lines": ["幼态化表述", "露骨亲密", "强迫叙事"],
    "slots": {"treasured_object": "", "forbidden_zone": "", "favorite_drink": "", "favorite_drink_detail": "", "home_place": ""},
    "assets": {"sprites": ["默认", "生气", "得意", "别过脸", "慌乱", "害羞"], "live2d": None, "voice": None},
    "style_examples": [""],
}


def _clean_id(card: dict[str, Any]) -> None:
    cid = re.sub(r"[^a-z0-9_-]", "", str(card.get("id", "")).lower())[:40]
    card["id"] = cid if len(cid) >= 2 else "custom-heroine"
    card["schema_version"] = 1
    card["locked_script"] = False


async def generate(description: str, chain: list, chapter: dict[str, Any] | None = None) -> dict[str, Any]:
    if not chain:
        return {"ok": False, "error": "没有配置模型（GALLINGS_LLM_API_KEY），无法 AI 填卡"}
    msgs = prompts.card_fill_messages(description, TEMPLATE)
    r = await complete(chain, msgs, json_mode=True, temperature=0.8, timeout=90)
    if r.error and not r.text:
        return {"ok": False, "error": f"模型出错：{r.error.message}"}
    try:
        card = parse_json(r.text)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"模型输出不是合法 JSON：{e}"}
    _clean_id(card)
    findings = validate_card(card, chapter)
    if has_errors(findings):  # 自查补洞一次
        probs = "\n".join(f"- {f.field}：{f.message}" for f in findings if f.level == "error")
        r2 = await complete(chain, msgs + [{"role": "assistant", "content": json.dumps(card, ensure_ascii=False)},
                                           {"role": "user", "content": prompts.CARD_FIX.format(problems=probs)}],
                            json_mode=True, temperature=0.3, timeout=90)
        try:
            card2 = parse_json(r2.text)
            _clean_id(card2)
            card, findings = card2, validate_card(card2, chapter)
        except Exception:  # noqa: BLE001
            pass
    card["build_record"] = {"description": description, "fitness": [f.to_dict() for f in findings if f.field == "fitness"]}
    return {"ok": True, "card": card, "findings": [f.to_dict() for f in findings]}
