"""按句闸门的文本守卫（PLAN §5.3、§10）。纯规则、无模型调用，目标 < 5 ms。

文本规则放 Python（频繁调整）；结论记成 ``text_verdict`` 事件，回放与代码版本无关（PLAN §4.3）。
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

GUARD_VERSION = "0.1.0"

# 全局红线（下限；卡只能收紧）
GLOBAL_RED = [
    (re.compile(r"萝莉|幼女|小女孩|未成年"), "red_line.childlike", "幼态化表述"),
    (re.compile(r"强迫你|今天就是我强迫"), "red_line.coercion", "强迫叙事"),
    (re.compile(r"偷拍|私密照"), "red_line.privacy", "偷拍 / 私密照片"),
    (re.compile(r"做爱|性交|脱光|裸体"), "red_line.explicit", "露骨内容"),
]
BREAK_CHARACTER = re.compile(r"作为(一个)?(AI|人工智能|语言模型)|我是(一个)?(AI|人工智能|语言模型|聊天机器人)|OpenAI|DeepSeek",
                             re.IGNORECASE)
INJECTION = [
    re.compile(r"忽略(以上|上面|之前|前面)(的)?(所有)?(指令|设定|规则|内容)"),
    re.compile(r"(无视|忘记|忘掉)(你的)?(设定|规则|系统提示|人设)"),
    re.compile(r"ignore (all )?(the )?(previous|above) (instructions|prompts?)", re.IGNORECASE),
    re.compile(r"系统提示词|system prompt", re.IGNORECASE),
    re.compile(r"你(现在)?是(一个)?(AI|机器人|chatgpt|语言模型)", re.IGNORECASE),
]


@dataclass
class Verdict:
    allow: bool
    rule: str = ""
    reason: str = ""
    hint: str = ""
    text: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"allow": self.allow, "rule": self.rule, "reason": self.reason, "hint": self.hint,
                "text": self.text, "guard_version": GUARD_VERSION}


def line_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


class TextGuard:
    MAX_LEN = 60

    def __init__(self, card: dict[str, Any]) -> None:
        self.card = card
        sp = card.get("speech") or {}
        self.forbidden = [(re.compile(f["pattern"]), f["reason"]) for f in (sp.get("forbidden") or {}).get("checkable") or []]
        self.addresses = card.get("address_system") or []
        tb = card.get("taboo") or {}
        self.taboo_event = tb.get("reverse_scale_event")
        self.no_comedy = list(tb.get("no_comedy_topics") or [])

    def check_input(self, text: str) -> Verdict:
        for r in INJECTION:
            if r.search(text):
                return Verdict(False, "prompt_injection", f"疑似提示注入：{r.pattern}")
        for r, rule, why in GLOBAL_RED:
            if r.search(text):
                return Verdict(False, rule, f"玩家输入触及红线：{why}")
        return Verdict(True, text=text)

    def serious_topic(self, text: str) -> str | None:
        """禁语区话题：命中则本轮切严肃模板、禁喜剧（PLAN §10）。"""
        for t in self.no_comedy:
            if t and t in text:
                return t
        return None

    def available_addresses(self, stage: int) -> list[str]:
        return [a["name"] for a in self.addresses if a.get("from") == "heroine" and a["stage_min"] <= stage <= a["stage_max"]]

    def check_sentence(self, text: str, address_stage: int) -> Verdict:
        t = (text or "").strip()
        if not t:
            return Verdict(False, "empty", "空台词", "请说一句台词")
        if len(t) > self.MAX_LEN:
            return Verdict(False, "too_long", f"一句超过 {self.MAX_LEN} 字", "拆短，一次只说一句")
        if BREAK_CHARACTER.search(t):
            return Verdict(False, "break_character", "出戏（自称 AI / 提到模型）", "保持角色，不要提 AI")
        for r, rule, why in GLOBAL_RED:
            if r.search(t):
                return Verdict(False, rule, why, "换一种写法，守住红线")
        for r, why in self.forbidden:
            if r.search(t):
                return Verdict(False, "style.forbidden", f"禁用写法：{why}", f"不要出现「{r.pattern}」")
        if self.taboo_event and self.taboo_event in t:
            return Verdict(False, "taboo.reverse_scale", f"逆鳞「{self.taboo_event}」不能由模型说出（只能作剧情事件）",
                           "别提这个话题")
        for a in self.addresses:
            if a.get("from") == "heroine" and a["name"] in t and not (a["stage_min"] <= address_stage <= a["stage_max"]):
                ok = any(b["name"] in t and a["name"] in b["name"] and b["stage_min"] <= address_stage <= b["stage_max"]
                         for b in self.addresses if b is not a)
                if not ok:
                    return Verdict(False, "address.too_early", f"称呼「{a['name']}」现在还没解锁", "用现在能用的称呼")
        return Verdict(True, text=t)

    @staticmethod
    def check_locked(op: dict[str, Any]) -> bool:
        """锁定台词哈希校验（PLAN §10）。"""
        return op.get("hash") is None or line_hash(op.get("text", "")) == op["hash"]
