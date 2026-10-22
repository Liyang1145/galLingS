from __future__ import annotations

import json
from typing import Any

from server.memory.text_index import extract_features, score_shared_features
from server.plugins import MemoryHit, MemoryPlugin, MemoryRecord, Timeline


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
                    row = json.loads(line)
                    if row.get("op") == "mark":  # 状态行（W2）：只改已有条目的 status，不删原文
                        self._apply_mark(row["ids"], row["status"], row.get("by"))
                    else:
                        self._items.append(row)

    def _apply_mark(self, ids: list[str], status: str, by: str | None) -> int:
        want = set(ids)
        n = 0
        for it in self._items:
            if it["id"] in want:
                it["status"] = status
                if by:
                    it["superseded_by"] = by
                n += 1
        return n

    async def write(self, record: MemoryRecord) -> str:
        mid = f"m{len(self._items) + 1:05d}"
        item = {"id": mid, "content": record.content, "kind": record.kind, "tags": list(record.tags),
                "lineage": record.timeline.lineage, "turn": record.timeline.turn,
                "importance": record.importance, "meta": record.meta, "status": "live"}
        self._items.append(item)
        with self._path.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")
        return mid

    async def recall(self, query: str, k: int, visible: list[Timeline]) -> list[MemoryHit]:
        q = extract_features(query)
        vis_items = []
        df: dict[str, int] = {}
        for it in self._items:
            if it.get("status", "live") != "live":  # 被修订作废的条目不召回（原文仍在 dump 里）
                continue
            tl = Timeline(it["lineage"], it["turn"])
            if not _visible(tl, visible):
                continue
            g = extract_features(it["content"])
            vis_items.append((it, tl, g))
            for f in g:
                df[f] = df.get(f, 0) + 1
        n_docs = max(1, len(vis_items))
        scored = []
        for it, tl, g in vis_items:
            shared = q & g
            if not shared:
                continue
            raw = score_shared_features(shared, df, n_docs)
            score = raw / (len(g) ** 0.5 + 1) + 0.1 * float(it.get("importance", 0.5))
            scored.append((score, it, tl))
        scored.sort(key=lambda x: (-x[0], x[1]["id"]))
        return [MemoryHit(it["id"], it["content"], round(s, 4), "local", tl,
                          {**(it.get("meta") or {}), "kind": it["kind"], "status": it.get("status", "live")})
                for s, it, tl in scored[:k]]

    async def mark(self, ids: list[str], status: str, by: str | None = None) -> int:
        ids = [str(x) for x in ids]
        if not ids:
            return 0
        n = self._apply_mark(ids, status, by)
        with self._path.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps({"op": "mark", "ids": ids, "status": status, "by": by}, ensure_ascii=False) + "\n")
        return n

    async def dump(self) -> list[dict[str, Any]]:
        return list(self._items)
