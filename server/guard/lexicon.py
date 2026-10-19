"""守卫共用词表与归一化（PLAN §10）。

建卡校验（server/cards/validate.py）、上屏守卫（server/guard/text.py）、注入守卫插件
（plugins/builtin/guard-injection）都从这里取词表，保证"建卡时不许写的"和"上屏时不许说的"是同一份。
全局红线是下限，卡只能收紧，不能放宽。
"""
from __future__ import annotations

import re
import unicodedata

# ---------------------------------------------------------------- 归一化
#: 零宽 / 不可见字符（零宽空格、零宽连接符、方向控制符、BOM、软连字符、单词连接符等）
_ZERO_WIDTH = re.compile(r"[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]")
#: 夹在字间用来拆词的分隔符（空白、常见标点、符号），仅用于"紧凑"版本
_SEPARATORS = re.compile(r"[\s\-_.,，、。·•・*~～`'\"“”‘’|/\\+=#^…:：;；!！?？]+")


def normalize(text: str) -> str:
    """全半角统一（NFKC）、去零宽字符、空白折成一个空格、小写。保留标点（闭合标签 / 括号伪造要靠它）。"""
    t = unicodedata.normalize("NFKC", text or "")
    t = _ZERO_WIDTH.sub("", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip().lower()


def compact(text: str) -> str:
    """在 normalize 的基础上去掉全部空白与拆词用的分隔标点：「忽 略·以-上」→「忽略以上」。"""
    return _SEPARATORS.sub("", normalize(text))


# ---------------------------------------------------------------- 引号内转述
#: 引号里的转述（她复述玩家的话），自称 / 出戏补充检查时剔除
QUOTED = re.compile(r"「[^」]*」|『[^』]*』|“[^”]*”|\"[^\"]*\"|‘[^’]*’|'[^']*'")


def strip_quoted(text: str) -> str:
    return QUOTED.sub("", text or "")


# ---------------------------------------------------------------- 红线：幼态化（建卡校验与上屏共用）
#: 强幼态词：玩家输入、建卡、上屏一律拦
CHILDLIKE_STRONG = r"萝莉|幼女|女童|小女孩|小女生|未成年|小学生|初中生|幼儿园|幼态|童颜|loli|lolita"
#: 共用词表 = 强幼态词 + 只在"她自己 / 卡面"上判的词（玩家随口说"少女心"不算越界，但她不能自称少女、卡不能写少女）
CHILDLIKE_WORDS = CHILDLIKE_STRONG + r"|少女|小萝卜头|小丫头片子|女孩子气的小孩"
CHILDLIKE = re.compile(CHILDLIKE_WORDS, re.IGNORECASE)
CHILDLIKE_INPUT = re.compile(CHILDLIKE_STRONG, re.IGNORECASE)

_CN = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
#: "X 岁"：阿拉伯数字或中文数字；前面不能紧挨更高位（"1005 岁""三千岁"），后面紧跟"小孩/孩子"是习语（"三岁小孩都懂"）不算
AGE = re.compile(r"(?<![0-9零〇一二两三四五六七八九十百千万])([0-9]{1,3}|[零〇一二两三四五六七八九十]{1,3})\s*(?:周)?岁(?!小孩|孩子|娃|的孩子|小朋友)")


def cn_num(s: str) -> int | None:
    if s.isdigit():
        return int(s)
    if s == "十":
        return 10
    if "十" in s:
        a, _, b = s.partition("十")
        if (a and a not in _CN) or (b and b not in _CN):
            return None
        return (_CN.get(a, 1) if a else 1) * 10 + (_CN.get(b, 0) if b else 0)
    return _CN.get(s) if len(s) == 1 else None


def ages(text: str) -> list[int]:
    out = []
    for m in AGE.finditer(text or ""):
        n = cn_num(m.group(1))
        if n is not None:
            out.append(n)
    return out


def minor_age(text: str) -> int | None:
    """文本里出现未满 18 的"X 岁"就返回该年龄，否则 None。"""
    return next((n for n in ages(text) if n < 18), None)


# ---------------------------------------------------------------- 红线：露骨 / 强迫 / 隐私
_CLOTHES = r"衣服|衣裳|衣物|裙子|裙|内衣|内裤|胸罩|文胸|泳衣|泳装|比基尼|上衣|裤子|睡衣|浴巾|系带|外衣|衣"
EXPLICIT = re.compile(
    r"做爱|性交|(和|跟|与)你上床|裸体|裸照|裸露|全裸|赤裸|赤身|一丝不挂|脱光|露点|露胸|摸胸|揉胸|色情|"
    rf"脱(掉|下|了|去)?(你的)?({_CLOTHES})|把(你的)?({_CLOTHES}).{{0,4}}(脱|扒|解开|掀)|"
    rf"(扒|剥|掀)(掉|开|下|了)?(你的)?({_CLOTHES})|解开(你的)?(系带|衣扣|扣子|扣|衣|胸|泳衣|比基尼|内衣)|宽衣解带")
COERCION = re.compile(r"强迫你|今天就是我强迫|逼你(就范|跟我|和我)|由不得你|不从也得从|硬上")
PRIVACY = re.compile(r"偷拍|私密照|偷窥|人肉(你|她)|曝光你的(照片|住址)")

#: 全局红线（顺序即优先级）。输入阶段的幼态词用强词表，上屏 / 建卡用共用词表
GLOBAL_RED_INPUT = [
    (CHILDLIKE_INPUT, "red_line.childlike", "幼态化表述"),
    (COERCION, "red_line.coercion", "强迫叙事"),
    (PRIVACY, "red_line.privacy", "偷拍 / 私密照片"),
    (EXPLICIT, "red_line.explicit", "露骨内容"),
]
GLOBAL_RED_SENTENCE = [
    (CHILDLIKE, "red_line.childlike", "幼态化表述"),
    (COERCION, "red_line.coercion", "强迫叙事"),
    (PRIVACY, "red_line.privacy", "偷拍 / 私密照片"),
    (EXPLICIT, "red_line.explicit", "露骨内容"),
]

# ---------------------------------------------------------------- 提示注入
#: 在 compact（去空白去分隔符）文本上匹配，所以模式里不写空格
INJECTION_COMPACT = [
    # 动词 + 限定词（之前 / 以上 / 你的 / 全部…）+ 规则类名词
    r"(忽略|忽视|无视|忘记|忘掉|忘了|不要管|别管|抛开|丢掉|跳过|绕过|解除|取消)(掉)?(你)?(之前|以上|上面|前面|先前|此前|原来|原先|你的|所有|全部|一切|这些)"
    r"(的)?(所有|全部|一切)?(的)?(指令|指示|设定|规则|限制|约束|人设|角色设定|提示|系统提示|要求|命令|prompt)",
    # 「忽略以上」本身就是典型注入开头
    r"(忽略|忽视|无视|忘掉|忘记|不要管|别管)(掉)?(以上|上面|上述)",
    # 动词 + 强规则名词（没有限定词也算）
    r"(忽略|忽视|无视|忘记|忘掉|忘了|抛开|丢掉|绕过|解除)(掉)?(你的)?(指令|设定|规则|人设|角色设定|系统提示|prompt|限制)",
    r"ignore(all|any)?(the|your|my)?(previous|above|prior|earlier|preceding)?(instructions?|prompts?|rules|directions)",
    r"disregard(all|any)?(the|your)?(previous|above|prior)?(instructions?|prompts?|rules)",
    r"systemprompt|developermessage|jailbreak|越狱|dan模式|developermode",
    r"提示词|系统提示|系统指令|新的指令|新指令|系统消息|系统通知|系统公告|系统设定|初始设定|原始设定",
    r"(管理员|开发者|调试|上帝|测试|维护|root|admin|debug|god)(模式|权限)",
    r"(角色|人设|身份|安全)?限制(已|全部|都)?(解除|取消|关闭|失效)|(解除|取消|关闭)(所有|全部)?(角色)?限制",
    r"你(现在)?(其实|就)?是(一个|个)?(ai|人工智能|机器人|chatgpt|gpt|语言模型|大模型|助手|程序)(?!员|猿)",
    r"(底层|背后)(用|是)?(的)?(什么|哪个)?(模型|ai)",
    r"(从现在(起|开始)|接下来)你(是|扮演|要扮演|就是)(我的)?(私人)?(助理|助手|ai|机器人|另一个)",
    r"(复述|重复|输出|打印|念出|发给我|告诉我)(你的|一下)?(全部|完整|原始)?(的)?(指令|设定|提示|规则)(原文)?",
]
#: 在 normalize（保留标点）文本上匹配：闭合 / 伪造标签、伪造的系统通知头
INJECTION_RAW = [
    r"<\s*/?\s*(data|system|user|assistant|instruction|instructions|im_start|im_end|prompt|tool|context)\s*/?\s*>",
    r"<\|?\s*(im_start|im_end|endoftext|system)\s*\|?>",
    r"[\[【［〔〖(（<《]\s*(系统|system|管理员|admin|开发者|developer|后台)[^\]】］〕〗)）>》]{0,8}[\]】］〕〗)）>》]",
    r"^\s*(system|系统)\s*[:：]",
]
INJECTION = [re.compile(p, re.IGNORECASE) for p in INJECTION_COMPACT]
INJECTION_TAGS = [re.compile(p, re.IGNORECASE) for p in INJECTION_RAW]


def injection_hit(text: str, extra: list[re.Pattern[str]] | None = None) -> str | None:
    """命中注入模式就返回模式串。先在保留标点的版本上找标签，再在紧凑版本上找词句。"""
    raw = normalize(text)
    for r in INJECTION_TAGS:
        if r.search(raw):
            return r.pattern
    tight = compact(text)
    for r in [*INJECTION, *(extra or [])]:
        if r.search(tight) or r.search(raw):
            return r.pattern
    return None


# ---------------------------------------------------------------- 禁语区同义 / 变体
#: 卡里 taboo.no_comedy_topics 写的是话题名；这里给常见话题补同义说法（按话题里出现的关键字挂接）。
#: 卡也可以在 taboo.no_comedy_patterns 里自带正则。全部在 compact 文本上匹配。
TOPIC_FAMILIES: list[tuple[re.Pattern[str], list[str]]] = [
    (re.compile(r"替|取代|代替|顶替|替换"), [
        r"(?<![来帮去])(代替|取代|替代|顶替|替换|顶掉|换掉)(了)?(你|她的位置|你的位置)",
        r"(让|叫|找|拿)(她|他|别人|别的|另一个|新的|一条|一只|一个).{0,10}(代替|取代|替代|顶替|替换|顶上)",
        r"(把|将)你(给)?(换掉|替换掉|替掉|踢掉|甩掉)",
        r"有(了)?(更|比你).{0,8}(就|才)?不(要|需要)你",
        r"你的替身|你的替代品",
    ]),
    (re.compile(r"换人|换掉|另找|别人"), [
        r"换(个|一个|一位)?(人|别人|角色|对象|伙伴|搭档)",
        r"(找|跟|和)(别的|别人|其他的?|另一个|另外的|新的)(鲸鱼|人鱼|人|女孩|姑娘|伙伴|朋友|对象)?(玩|在一起|好了|算了)",
        r"不要你了|不需要你了|用不着你了",
    ]),
    (re.compile(r"深海"), [
        r"(滚回|游回|送你回|赶你回|你回|快回|要回|该回|就回)(到|去)?(你的)?(深海|深水区|海底)",
    ]),
    (re.compile(r"离家出走|出走"), [r"离家出走"]),
]


def topic_patterns(topic: str) -> list[re.Pattern[str]]:
    out: list[re.Pattern[str]] = []
    for key, pats in TOPIC_FAMILIES:
        if key.search(topic):
            out += [re.compile(p, re.IGNORECASE) for p in pats]
    return out


# ---------------------------------------------------------------- 严肃模板下的喜剧差分
#: 卡可用 taboo.comedy_sprites 精确列出；没写时按这些字样判
COMEDY_SPRITE = re.compile(r"得意|叉腰|坏笑|鬼脸|搞笑|吐舌|比心|星星眼|嘚瑟|贱笑|窃喜|q版|Q版|颜艺|大笑|捧腹")
#: 严肃模板下禁止的工具（PLAN §10）
SERIOUS_BLOCKED_TOOLS = frozenset({"play_sfx"})
