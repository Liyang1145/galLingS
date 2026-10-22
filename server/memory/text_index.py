"""灵枢认知图（md_cg）与本地记忆（memory-local）共用的中文检索分词、语义概念簇与 BM25/IDF 打分底座。"""
from __future__ import annotations

import math
import re

_PUNCT = re.compile(r"[\s，。！？、…「」『』【】（）()—\-~～：:;；,.!?\"'·]+")
_PREFIX = re.compile(r"^(玩家在手账上写|她在手账上回|玩家选择了|玩家说|她说|我|她|你)[：:]\s*")

# 高频对话停用字词：不作为检索主特征，避免背景闲聊稀释关键事实
_STOP_CHARS = set("我你他她它们的是了在有和就都而及与着或一个这那哪什么怎么为什么吗呢吧啊呀哦嗯哼哈啦呗嘛去来把被让给到从向往对跟比越")
_STOP_BG = {
    "玩家", "本小姐", "小姐", "人类", "今天", "现在", "刚才", "以前", "时候", "东西",
    "觉得", "喜欢", "最喜欢", "记得", "还记得", "知道", "告诉", "说过", "来着",
    "是什么", "叫什么", "有什么", "哪儿", "哪里", "多少", "多久", "特别", "其实", "可以",
}

# 语义同义/转述概念簇（解决换说法提问 / paraphrase 召回）
_CONCEPT_CLUSTERS: list[tuple[str, tuple[str, ...]]] = [
    ("concept:name", ("名字", "叫什么", "我叫", "真名", "本名", "称呼", "姓甚名谁", "阿澈", "林知秋")),
    ("concept:hometown", ("老家", "家乡", "打哪儿来", "从哪来", "来自哪", "哪里人", "哪儿人", "内陆", "山城", "出身")),
    ("concept:allergy", ("过敏", "不能吃", "忌口", "吃不得", "吃了会", "海鲜", "甲壳", "不吃")),
    ("concept:cooking", ("招牌菜", "拿手菜", "最拿手", "拿手", "会做饭", "做菜", "厨艺", "下厨", "红烧肉")),
    ("concept:dream", ("梦想", "想做成", "愿望", "理想", "目标", "心愿", "志向", "会思考", "机器")),
    ("concept:mark", ("记号", "认出", "特征", "旧疤", "伤疤", "疤痕", "胎记", "手腕", "左手腕")),
    ("concept:birthday", ("生日", "哪天", "生辰", "几月几号", "八月十五")),
    ("concept:fear", ("最怕", "害怕", "恐惧", "不敢碰", "螃蟹")),
    ("concept:gift", ("谁送的", "送我的", "送给", "礼物", "笔记本", "奶奶")),
    ("concept:pet", ("养了", "家里养", "家的猫", "宠物", "小猫", "橘猫", "豆包")),
    ("concept:sleep", ("没睡", "睡好觉", "失眠", "熬夜", "多久没睡", "十五天")),
    ("concept:color", ("颜色", "什么色", "珊瑚橘", "紫色", "蓝色")),
    ("concept:pen", ("钢笔", "写字", "发光", "口袋里")),
    ("concept:stay", ("住在哪", "晚上住", "睡在哪", "落脚", "过夜", "帐篷", "岸边")),
    ("concept:pudding", ("布丁", "焦糖", "双倍焦糖", "甜食", "甜点", "糍粑")),
]


def extract_features(text: str) -> set[str]:
    """提取检索特征：字符级 bigram / trigram + 有效实词单字 + 语义概念标签。"""
    core = _PREFIX.sub("", text.strip().lower())
    clean = _PUNCT.sub("", core)
    feats: set[str] = set()
    for i in range(len(clean) - 1):
        bg = clean[i:i + 2]
        if bg not in _STOP_BG and not all(c in _STOP_CHARS for c in bg):
            feats.add(f"bg:{bg}")
    for i in range(len(clean) - 2):
        tg = clean[i:i + 3]
        if not all(c in _STOP_CHARS for c in tg):
            feats.add(f"tg:{tg}")
    for ch in clean:
        if ch not in _STOP_CHARS:
            feats.add(f"ch:{ch}")
    for cid, words in _CONCEPT_CLUSTERS:
        if any(w in core or w in clean for w in words):
            feats.add(cid)
    return feats


def score_shared_features(shared: set[str], df: dict[str, int], n_docs: int) -> float:
    """按 BM25 IDF 与特征层级权重计算匹配原始分。"""
    raw = 0.0
    for f in shared:
        d = df.get(f, 1)
        idf = math.log(1.0 + (n_docs - d + 0.5) / (d + 0.5))
        if f.startswith("concept:"):
            raw += 3.2 * max(0.8, idf)
        elif f.startswith("tg:"):
            raw += 2.2 * max(0.5, idf)
        elif f.startswith("bg:"):
            raw += 1.6 * max(0.4, idf)
        else:
            raw += 0.35 * max(0.1, idf)
    return raw
