"""记忆网关：灵枢 / 本地记忆插件 + 时间线过滤 + AGM 补位（PLAN §13）。

召回 = 记忆插件取 top30（插件内按可见时间线过滤）→ 取前 7 条 → 以这 30 条为种子在 Rust 核心的 AGM 图上扩散，
补 3 条不在前 7 里的条目。返回的永远是记忆原文。整次召回记成一条 ``memory_recall`` 事件。
"""
from __future__ import annotations

import json
from typing import Any

from server.plugins import MemoryPlugin, MemoryRecord, Timeline

INF_TURN = 2**62


class MemoryGateway:
    def __init__(self, plugin: MemoryPlugin | None, agm_fill: bool = True, top: int = 7, fill: int = 3, pool: int = 30) -> None:
        self.plugin = plugin
        self.agm_fill = agm_fill
        self.top, self.fill, self.pool = top, fill, pool
        self.cache: dict[str, str] = {}

    @property
    def enabled(self) -> bool:
        return self.plugin is not None

    @staticmethod
    def visible(engine: Any) -> list[Timeline]:
        return [Timeline(v["lineage"], min(int(v["max_turn"]), INF_TURN)) for v in json.loads(engine.visible_json())]

    async def write(self, content: str, kind: str, turn: int, lineage: str, tags: tuple[str, ...] = ()) -> str | None:
        if not self.plugin or not content.strip():
            return None
        mid = await self.plugin.write(MemoryRecord(content=content, timeline=Timeline(lineage, turn), kind=kind, tags=tags))
        self.cache[mid] = content
        return mid

    async def recall(self, engine: Any, query: str) -> dict[str, Any]:
        vis = self.visible(engine)
        out: dict[str, Any] = {"query": query, "hits": [], "agm": [],
                               "visible": [{"lineage": t.lineage, "turn": t.turn} for t in vis]}
        if not self.plugin:
            return out
        hits = await self.plugin.recall(query, self.pool, vis)
        for h in hits:
            self.cache[h.id] = h.content
        out["hits"] = [{"id": h.id, "content": h.content, "score": round(h.score, 4), "source": h.source}
                       for h in hits[: self.top]]
        if self.agm_fill and hits:
            seeds = [{"id": h.id, "score": int(round(max(h.score, 0.001) * 1000))} for h in hits]
            exclude = [h["id"] for h in out["hits"]]
            for a in json.loads(engine.agm_recall(json.dumps(seeds), json.dumps(exclude), self.fill)):
                if a["id"] in self.cache:
                    out["agm"].append({"id": a["id"], "content": self.cache[a["id"]], "score": a["activation"] / 1000,
                                       "source": "agm_fill", "path": a["path"]})
        return out
