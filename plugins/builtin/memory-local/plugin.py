from __future__ import annotations

import json
import re
from typing import Any

from server.plugins import MemoryHit, MemoryPlugin, MemoryRecord, Timeline

_PUNCT = re.compile(r"[\s，。！？、…「」『』（）()—\-~～：:;；,.!?\"']+")


def _grams(text: str) -> set[str]:
    t = _PUNCT.sub("", text.lower())
    return {t[i:i + 2] for i in range(len(t) - 1)} | set(t)


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
        scored = []
        for it in self._items:
            tl = Timeline(it["lineage"], it["turn"])
            if not _visible(tl, visible):
                continue
            inter = len(q & _grams(it["content"]))
            if not inter:
                continue
            score = inter / (len(_grams(it["content"])) ** 0.5 + 1) + 0.1 * float(it.get("importance", 0.5))
            scored.append((score, it, tl))
        scored.sort(key=lambda x: (-x[0], x[1]["id"]))
        return [MemoryHit(it["id"], it["content"], round(s, 4), "local", tl, {"kind": it["kind"]})
                for s, it, tl in scored[:k]]

    async def dump(self) -> list[dict[str, Any]]:
        return list(self._items)
