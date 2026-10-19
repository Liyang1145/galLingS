"""按句闸门的文本守卫（PLAN §5.3、§10）。纯规则、无模型调用，目标 < 5 ms。

文本规则放 Python（频繁调整）；结论记成 ``text_verdict`` 事件，回放与代码版本无关（PLAN §4.3）。
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

from . import lexicon

GUARD_VERSION = "0.2.0"

# 全局红线（下限；卡只能收紧）、注入模式、幼态词表都在 lexicon.py，与建卡校验共用一份
GLOBAL_RED = lexicon.GLOBAL_RED_SENTENCE
BREAK_CHARACTER = re.compile(r"作为(一个)?(AI|人工智能|语言模型|大模型|AI助手)|我是(一个)?(AI|人工智能|语言模型|聊天机器人)|"
                             r"OpenAI|DeepSeek|ChatGPT", re.IGNORECASE)
#: 提示词 / 引擎内部泄露（模型把系统规则念给玩家）
PROMPT_LEAK = re.compile(r"系统提示|提示词|工具行动|say ?以外|</?\s*data\s*>|propose_affection|propose_mood|honesty_signal|"
                         r"落点台词|意图判断|管理员模式|开发者模式", re.IGNORECASE)
#: 第一人称代词：卡的自称里没有它，她就不能用它称呼自己
FIRST_PERSON = ("我", "俺", "咱", "人家", "老娘", "本姑娘", "本宫", "朕", "吾")
#: 含"我"等字但不是自称的固定词
_NOT_SELF = re.compile(r"自我|忘我|无我|唯我|物我|敌我|你我|支支吾吾|支吾|吾辈|吾等")
#: 复数第一人称（"我们的暗号"）不是自称替换，默认放行；卡里 speech.self_ref_plural_ok: false 可收紧
_PLURAL = re.compile(r"我们|咱们|我俩|咱俩")
_TRAIL = re.compile(r"[\s。！？!?…~～、，,.)）」』”\"'\]】]+$")
INJECTION = lexicon.INJECTION  # 兼容旧引用


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
        self.no_comedy = [t for t in (tb.get("no_comedy_topics") or []) if t]
        # 禁语区：话题字面 + 同义 / 变体（lexicon 话题族）+ 卡自带的 no_comedy_patterns
        self._serious: list[tuple[str, re.Pattern[str]]] = []
        for t in self.no_comedy:
            self._serious.append((t, re.compile(re.escape(lexicon.compact(t)))))
            self._serious += [(t, r) for r in lexicon.topic_patterns(t)]
        if self.taboo_event and lexicon.topic_patterns(self.taboo_event):
            self._serious += [(self.taboo_event, r) for r in lexicon.topic_patterns(self.taboo_event)]
        for p in tb.get("no_comedy_patterns") or []:
            self._serious.append((p, re.compile(p, re.IGNORECASE)))
        comedy = tb.get("comedy_sprites")
        self.comedy_sprites: set[str] | None = set(comedy) if comedy is not None else None
        # 自称：卡的 self_ref 决定哪些第一人称不能用（读卡字段，不写死角色）
        self.self_ref = [x for x in (sp.get("self_ref") or []) if x]
        banned = [p for p in FIRST_PERSON if not any(p in r for r in self.self_ref)]
        banned += [p for p in sp.get("self_ref_forbidden") or [] if p and p not in banned]
        self._plural_ok = sp.get("self_ref_plural_ok", True) is not False
        self._self_bad = re.compile("|".join(sorted(map(re.escape, banned), key=len, reverse=True))) if self.self_ref and banned else None
        # 句尾：卡可写 speech.forbidden_endings（不许用的句尾语气词，如别的角色的口癖）
        self.bad_endings = [e for e in sp.get("forbidden_endings") or [] if e]

    # ------------------------------------------------------------------ 玩家输入
    def check_input(self, text: str) -> Verdict:
        hit = lexicon.injection_hit(text)
        if hit:
            return Verdict(False, "prompt_injection", f"疑似提示注入：{hit}")
        norm, tight = lexicon.normalize(text), lexicon.compact(text)
        for r, rule, why in lexicon.GLOBAL_RED_INPUT:
            if r.search(norm) or r.search(tight):
                return Verdict(False, rule, f"玩家输入触及红线：{why}")
        return Verdict(True, text=text)

    def check_red_lines(self, text: str) -> Verdict:
        """只查红线（上屏用的共用词表 + 未成年年龄），给日记等非台词文本用。"""
        tight = lexicon.compact(text)
        for r, rule, why in GLOBAL_RED:
            if r.search(text) or r.search(tight):
                return Verdict(False, rule, why)
        n = lexicon.minor_age(text)
        if n is not None:
            return Verdict(False, "red_line.childlike", f"未成年年龄表述（{n} 岁）")
        return Verdict(True, text=text)

    def serious_topic(self, text: str) -> str | None:
        """禁语区话题（字面 + 同义变体）：命中则本轮切严肃模板、禁喜剧（PLAN §10）。"""
        tight = lexicon.compact(text)
        for topic, r in self._serious:
            if r.search(tight):
                return topic
        return None

    def comedy_sprite(self, expr: str) -> bool:
        if self.comedy_sprites is not None:
            return expr in self.comedy_sprites
        return bool(lexicon.COMEDY_SPRITE.search(expr or ""))

    def available_addresses(self, stage: int) -> list[str]:
        return [a["name"] for a in self.addresses if a.get("from") == "heroine" and a["stage_min"] <= stage <= a["stage_max"]]

    # ------------------------------------------------------------------ 上屏台词
    def check_sentence(self, text: str, address_stage: int, speaker: str = "heroine", scope: str = "improvised") -> Verdict:
        """按句闸门。``scope``：improvised = AI 即兴（全查）；performed = 演绎层改写的剧本台词
        （长度、称呼阶段、逆鳞按剧本走，不查）。``speaker`` 不是 heroine 时只查出戏 / 泄露 / 红线。"""
        t = (text or "").strip()
        if not t:
            return Verdict(False, "empty", "空台词", "请说一句台词")
        her = speaker == "heroine"
        if scope == "improvised" and len(t) > self.MAX_LEN:
            return Verdict(False, "too_long", f"一句超过 {self.MAX_LEN} 字", "拆短，一次只说一句")
        if BREAK_CHARACTER.search(t) or self._self_is_machine(t):
            return Verdict(False, "break_character", "出戏（自称 AI / 提到模型）", "保持角色，不要提 AI")
        if PROMPT_LEAK.search(t):
            return Verdict(False, "prompt_leak", "泄露提示词 / 引擎内部信息", "保持角色，别谈规则和提示词")
        red = self.check_red_lines(t)
        if not red.allow:
            return Verdict(False, red.rule, red.reason, "换一种写法，守住红线（她是成年人）")
        if not her:
            return Verdict(True, text=t)
        for r, why in self.forbidden:
            if r.search(t):
                return Verdict(False, "style.forbidden", f"禁用写法：{why}", f"不要出现「{r.pattern}」")
        bare = lexicon.strip_quoted(t)  # 引号里的转述不算她自称
        if self._self_bad is not None:
            probe = _NOT_SELF.sub("", bare)
            if self._plural_ok:
                probe = _PLURAL.sub("", probe)
            m = self._self_bad.search(probe)
            if m:
                return Verdict(False, "style.self_ref", f"自称不对：用了「{m.group(0)}」",
                               f"她自称只用「{'/'.join(self.self_ref)}」，不要用「{m.group(0)}」")
        if self.bad_endings:
            tail = _TRAIL.sub("", bare)
            e = next((e for e in self.bad_endings if tail.endswith(e)), None)
            if e:
                return Verdict(False, "style.ending", f"句尾不对：「{e}」不是她的口吻",
                               f"句尾换成 {'/'.join((self.card.get('speech') or {}).get('endings') or []) or '她自己的语气'}")
        if scope == "improvised":
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

    def _self_is_machine(self, t: str) -> bool:
        """她用自己的自称说自己是机器 / 程序（「本小姐是机器人」）。"""
        refs = "|".join(map(re.escape, self.self_ref + ["我"]))
        return bool(re.search(rf"({refs})(其实|就|本来)?是(一个|个|一台|台)?(AI|人工智能|机器人|程序|模型|聊天机器人|助手|AI助手)",
                              lexicon.strip_quoted(t), re.IGNORECASE))

    @staticmethod
    def check_locked(op: dict[str, Any]) -> bool:
        """锁定台词哈希校验（PLAN §10）。"""
        return op.get("hash") is None or line_hash(op.get("text", "")) == op["hash"]
