from __future__ import annotations

import json
import math
import re
from typing import Any

from server.plugins import MemoryHit, MemoryPlugin, MemoryRecord, Timeline

_PUNCT = re.compile(r"[\s，。！？、…「」『』【】（）()—\-~～：:;；,.!?\"'·]+")
_PREFIX = re.compile(r"^(玩家在手账上写|她在手账上回|玩家选择了|玩家说|她说|我|她|你)[：:]\s*")
_STOP_CHARS = set("我你他她它们的是了在有和就都而及与着或一个这那哪什么怎么为什么吗呢吧啊呀哦嗯哼哈啦呗嘛去来把被让给到从向往对跟比越")
_STOP_BG = {
    "玩家", "本小姐", "小姐", "人类", "今天", "现在", "刚才", "以前", "时候", "东西",
    "觉得", "喜欢", "最喜欢", "记得", "还记得", "知道", "告诉", "说过", "来着",
    "是什么", "叫什么", "有什么", "哪儿", "哪里", "多少", "多久", "特别", "其实", "可以",
}
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


def _grams(text: str) -> set[str]:
    core = _PREFIX.sub("", text.strip().lower())
    t = _PUNCT.sub("", core)
    out: set[str] = set()
    for i in range(len(t) - 1):
        bg = t[i:i + 2]
        if bg not in _STOP_BG and not all(c in _STOP_CHARS for c in bg):
            out.add(f"bg:{bg}")
    for i in range(len(t) - 2):
        tg = t[i:i + 3]
        if not all(c in _STOP_CHARS for c in tg):
            out.add(f"tg:{tg}")
    for ch in t:
        if ch not in _STOP_CHARS:
            out.add(f"ch:{ch}")
    for cid, words in _CONCEPT_CLUSTERS:
        if any(w in core or w in t for w in words):
            out.add(cid)
    return out


def _visible(tl: Timeline, visible: list[Timeline]) -> bool:
    return any(v.lineage == tl.lineage and tl.turn <= v.turn for v in visible)


class LocalMemory(MemoryPlugin):
    async def setup(self) -> None:
        self._path = self.ctx.data_dir / self.ctx.config.get("file", "memory.jsonl")
        self._items: list[dict[str, Any]] = []
        if self.ctx.config.get("fresh", True) and self._path.exists():
            self._path.unlink()
        if self._path.is_file():
            for line in self._path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    self._items.append(json.loads(line))

    async def write(self, record: MemoryRecord) -> str:
        mid = f"m{len(self._items) + 1:05d}"
        item = {"id": mid, "content": record.content, "kind": record.kind, "tags": list(record.tags),
                "lineage": record.timeline.lineage, "turn": record.timeline.turn,
                "importance": record.importance, "meta": record.meta}
        self._items.append(item)
        with self._path.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
        return mid

    async def recall(self, query: str, k: int, visible: list[Timeline]) -> list[MemoryHit]:
        q = _grams(query)
        vis_items = []
        df: dict[str, int] = {}
        for it in self._items:
            tl = Timeline(it["lineage"], it["turn"])
            if not _visible(tl, visible):
                continue
            g = _grams(it["content"])
            vis_items.append((it, tl, g))
            for f in g:
                df[f] = df.get(f, 0) + 1
        n_docs = max(1, len(vis_items))
        scored = []
        for it, tl, g in vis_items:
            shared = q & g
            if not shared:
                continue
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
            score = raw / (len(g) ** 0.5 + 1) + 0.1 * float(it.get("importance", 0.5))
            scored.append((score, it, tl))
        scored.sort(key=lambda x: (-x[0], x[1]["id"]))
        return [MemoryHit(it["id"], it["content"], round(s, 4), "local", tl, {"kind": it["kind"]})
                for s, it, tl in scored[:k]]

    async def dump(self) -> list[dict[str, Any]]:
        return list(self._items)
