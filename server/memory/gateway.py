"""记忆网关：灵枢 / 本地记忆插件 + 时间线过滤 + AGM 补位（PLAN §13）。

召回 = 记忆插件取 top30（插件内按可见时间线过滤）→ 取前 7 条 → 以这 30 条为种子在 Rust 核心的 AGM 图上扩散，
补 3 条不在前 7 里的条目。返回的永远是记忆原文。整次召回记成一条 ``memory_recall`` 事件。

来源标签（整合方案 W1，见 provenance.py）：
- 写入时给每条记忆打 ``meta.source / evidence_key / turn_event``，带数量 / 归属 / 称呼的再打 ``as_of_turn``（W3）；
- ``kind="fact"`` 只有剧本 / 引擎来源能写，其它来源一律降成 ``note``（玩家说法永不升格为事实）；
- 召回结果每条带 ``provenance``（来源）、同 ``evidence_key`` 的只留一条、被修订作废（superseded）的不返回。
  注意：召回条目里原有的 ``source`` 字段是“从哪个检索器召回的”（lingshu / local / agm_fill），与记忆来源无关。

修订（W2）：``revise()`` = 追加新条（meta.supersedes 指向旧条）+ 旧条打 superseded，原文不删；
必须带本轮召回给的 ``read_token``（先读后写），且新条来源的权级不低于旧条。
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from server.plugins import MemoryPlugin, MemoryRecord, Timeline

from . import provenance as pv

INF_TURN = 2**62


class MemoryGateway:
    def __init__(self, plugin: MemoryPlugin | None, agm_fill: bool = True, top: int = 7, fill: int = 3, pool: int = 30) -> None:
        self.plugin = plugin
        self.agm_fill = agm_fill
        self.top, self.fill, self.pool = top, fill, pool
        self.cache: dict[str, str] = {}
        self.meta_cache: dict[str, dict[str, Any]] = {}
        #: read_token → 这次召回读到的 id（只保留最近一次召回的令牌：先读后写只认“本轮”）
        self.tokens: dict[str, set[str]] = {}
        self.superseded: set[str] = set()

    @property
    def enabled(self) -> bool:
        return self.plugin is not None

    @staticmethod
    def visible(engine: Any) -> list[Timeline]:
        return [Timeline(v["lineage"], min(int(v["max_turn"]), INF_TURN)) for v in json.loads(engine.visible_json())]

    @staticmethod
    def build_meta(content: str, kind: str, turn: int, source: str | None, meta: dict[str, Any] | None) -> tuple[str, dict[str, Any]]:
        """规范化 kind 与 meta：补来源、去重键、发生回合、as_of_turn；非剧本 / 引擎来源的 fact 降成 note。"""
        src = source if source in pv.SOURCES else pv.infer_source(content, kind)
        if kind == "fact" and src not in pv.FACT_SOURCES:
            kind = "note"
        m = dict(meta or {})
        m["source"] = src
        m.setdefault("evidence_key", pv.evidence_key(src, content))
        m.setdefault("turn_event", int(turn))
        if "as_of_turn" not in m and (src in pv.FACT_SOURCES and kind == "fact" or pv.has_quantity(content)):
            m["as_of_turn"] = int(turn)
        return kind, m

    async def write(self, content: str, kind: str, turn: int, lineage: str, tags: tuple[str, ...] = (),
                    source: str | None = None, meta: dict[str, Any] | None = None) -> str | None:
        if not self.plugin or not content.strip():
            return None
        kind, m = self.build_meta(content, kind, turn, source, meta)
        mid = await self.plugin.write(MemoryRecord(content=content, timeline=Timeline(lineage, turn), kind=kind, tags=tags, meta=m))
        self.cache[mid] = content
        self.meta_cache[mid] = {"kind": kind, **m}
        return mid

    def _hit_view(self, mid: str, content: str, meta: dict[str, Any]) -> dict[str, Any]:
        kind = str(meta.get("kind") or "")
        src = pv.provenance_of(meta, content, kind)
        out = {"provenance": src or "unknown", "kind": kind or None,
               "evidence_key": str(meta.get("evidence_key") or pv.evidence_key(src, content))}
        if meta.get("as_of_turn") is not None:
            out["as_of_turn"] = int(meta["as_of_turn"])
        return out

    def _dead(self, mid: str, meta: dict[str, Any]) -> bool:
        return mid in self.superseded or str(meta.get("status") or "live") == "superseded"

    async def recall(self, engine: Any, query: str) -> dict[str, Any]:
        vis = self.visible(engine)
        out: dict[str, Any] = {"query": query, "hits": [], "agm": [],
                               "visible": [{"lineage": t.lineage, "turn": t.turn} for t in vis]}
        if not self.plugin:
            return out
        hits = await self.plugin.recall(query, self.pool, vis)
        seen: set[str] = set()
        live = []
        dup = 0
        for h in hits:
            meta = {**self.meta_cache.get(h.id, {}), **(h.meta or {})}
            self.cache[h.id] = h.content
            self.meta_cache[h.id] = meta
            if self._dead(h.id, meta):
                continue
            view = self._hit_view(h.id, h.content, meta)
            if view["evidence_key"] in seen:  # 同一证据重复出现只算一条（重复不等于证据，W1）
                dup += 1
                continue
            seen.add(view["evidence_key"])
            live.append((h, view))
        out["hits"] = [{"id": h.id, "content": h.content, "score": round(h.score, 4), "source": h.source, **v}
                       for h, v in live[: self.top]]
        if dup:
            out["deduped"] = dup
        if self.agm_fill and hits:
            seeds = [{"id": h.id, "score": int(round(max(h.score, 0.001) * 1000))} for h in hits]
            exclude = [h["id"] for h in out["hits"]]
            for a in json.loads(engine.agm_recall(json.dumps(seeds), json.dumps(exclude), self.fill)):
                mid = a["id"]
                if mid not in self.cache:
                    continue
                meta = self.meta_cache.get(mid, {})
                if self._dead(mid, meta):
                    continue
                view = self._hit_view(mid, self.cache[mid], meta)
                if view["evidence_key"] in seen:
                    continue
                seen.add(view["evidence_key"])
                out["agm"].append({"id": mid, "content": self.cache[mid], "score": a["activation"] / 1000,
                                   "source": "agm_fill", "path": a["path"], **view})
        ids = sorted({h["id"] for h in out["hits"]} | {h["id"] for h in out["agm"]})
        token = hashlib.sha1(("|".join(ids) + f"|{len(self.tokens)}").encode("utf-8")).hexdigest()[:12] if ids else ""
        self.tokens = {token: set(ids)} if token else {}
        out["read_token"] = token
        return out

    async def revise(self, old_ids: list[str], content: str, kind: str, turn: int, lineage: str, read_token: str,
                     source: str, tags: tuple[str, ...] = ()) -> dict[str, Any]:
        """修订 = 追加新条 + 旧条打 superseded（只打标，原文不删）。返回 ``{ok, id?, rule?, reason?, supersedes}``。

        守卫：① 必须带本轮召回的 read_token，且 old_ids 都在那次召回里（先读后写）；② 新条来源权级 ≥ 旧条
        （玩家说法不能作废任何条目，模型笔记不能作废剧本 / 引擎事实）；③ 插件要支持 mark。"""
        old = [str(x) for x in old_ids if str(x)]
        res: dict[str, Any] = {"ok": False, "supersedes": old}
        if not self.plugin:
            return {**res, "rule": "memory.disabled", "reason": "没有启用记忆插件"}
        if not old:
            return {**res, "rule": "memory.revise_empty", "reason": "没有指明要修订的旧条目"}
        seen = self.tokens.get(read_token or "")
        if seen is None or not set(old) <= seen:
            return {**res, "rule": "memory.revise_no_read_token", "reason": "修订前必须先在本轮召回里读到这些条目（read_token 不符）"}
        src = source if source in pv.SOURCES else ""
        for mid in old:
            osrc = pv.provenance_of(self.meta_cache.get(mid), self.cache.get(mid, ""))
            if not pv.can_supersede(src, osrc):
                return {**res, "rule": "memory.revise_authority",
                        "reason": f"来源 {src or '未知'} 不能作废来源 {osrc or '未知'} 的条目 {mid}"}
        if not callable(getattr(self.plugin, "mark", None)):
            return {**res, "rule": "memory.mark_unsupported", "reason": "记忆插件不支持 mark"}
        new_kind, m = self.build_meta(content, kind, turn, src, {"supersedes": old, "turn_revised": int(turn)})
        try:
            # 先确认插件支持 mark（空列表探测），避免写了新条却作废不了旧条
            await self.plugin.mark([], "superseded", None)
        except NotImplementedError as e:
            return {**res, "rule": "memory.mark_unsupported", "reason": str(e)}
        mid = await self.plugin.write(MemoryRecord(content=content, timeline=Timeline(lineage, turn), kind=new_kind,
                                                   tags=tags, meta=m))
        self.cache[mid] = content
        self.meta_cache[mid] = {"kind": new_kind, **m}
        n = await self.plugin.mark(old, "superseded", mid)
        for x in old:
            self.superseded.add(x)
            self.meta_cache.setdefault(x, {})["status"] = "superseded"
            self.meta_cache[x]["superseded_by"] = mid
        self.tokens = {}  # 令牌一次性
        return {**res, "ok": True, "id": mid, "marked": n, "kind": new_kind}
