from __future__ import annotations

import json
import re
import sys
from typing import Any

from server.plugins import MemoryHit, MemoryPlugin, MemoryRecord, MCPError, Timeline
from server.plugins.mcp import MCPClient, mcp_content_to_value

_TL = re.compile(r"^tl:(?P<lineage>[^@]+)@(?P<turn>\d+)$")


def visible(t: Timeline | None, views: list[Timeline]) -> bool:
    """t 在可见时间线前缀内：同 lineage 且回合不晚于该时间线当前回合。没打标的记忆视为全局可见。"""
    if t is None:
        return True
    return any(v.lineage == t.lineage and t.turn <= v.turn for v in views)


#: 来源标签进灵枢的 tags（外部 dsh-memory 不认识自定义字段，tags 两边都认）：src:<来源> ek:<去重键> asof:<回合> kind:<kind>
_META_TAGS = {"src": "source", "ek": "evidence_key", "asof": "as_of_turn", "kind": "kind", "tev": "turn_event"}


def meta_tags(record: MemoryRecord) -> list[str]:
    m = record.meta or {}
    out = []
    for prefix, key in (("src", "source"), ("ek", "evidence_key"), ("asof", "as_of_turn"), ("tev", "turn_event")):
        if m.get(key) not in (None, ""):
            out.append(f"{prefix}:{m[key]}")
    if m.get("supersedes"):
        out += [f"supersedes:{x}" for x in m["supersedes"]]
    return out


def parse_meta(tags: list[str] | None) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    sup = []
    for tag in tags or []:
        k, sep, v = str(tag).partition(":")
        if not sep:
            continue
        if k == "supersedes":
            sup.append(v)
        elif k in _META_TAGS:
            meta[_META_TAGS[k]] = int(v) if k in ("asof", "tev") and v.lstrip("-").isdigit() else v
    if sup:
        meta["supersedes"] = sup
    return meta


def parse_timeline(tags: list[str] | None) -> Timeline | None:
    for tag in tags or []:
        m = _TL.match(str(tag))
        if m:
            return Timeline(m["lineage"], int(m["turn"]))
    return None


class LingshuMemory(MemoryPlugin):
    async def setup(self) -> None:
        c = self.ctx.config
        dsh_path = str(c.get("dsh_memory_path") or "").strip() or str(self.ctx.plugin_dir)
        graph = c["graph_dir"].replace("${data_dir}", str(self.ctx.data_dir))
        env = {"MDCG_ROOT": graph, "MDCG_ACTOR": c["actor"], "PYTHONPATH": dsh_path,
               "MDCG_SUSTAIN": "0", "PYTHONUTF8": "1", "MDCG_MCP_SURFACE": "full"}
        token = self.ctx.secrets.get("token")
        if token:
            env["MDCG_TOKEN"] = token
        else:
            env["MDCG_LEGACY_ENV_AUTH"] = "1"
        self.client = MCPClient([c["python"] or sys.executable, "-m", "md_cg.mcp_server"], env=env, cwd=dsh_path,
                                call_timeout_s=c["call_timeout_s"], name=self.ctx.plugin_id)
        await self.client.start()
        names = {t["name"] for t in await self.client.list_tools()}
        need = {"mdcg_remember", "mdcg_search"}
        if not need <= names:
            raise MCPError(f"灵枢缺少工具 {sorted(need - names)}", self.ctx.plugin_id)
        # 修订作废（W2）：内置 md_cg 有 mdcg_mark；外部 dsh-memory 没有就退到插件自己的状态文件（只影响本插件的召回过滤）
        self._has_mark = "mdcg_mark" in names
        self._status_path = self.ctx.data_dir / "lingshu-status.json"
        self._status: dict[str, str] = {}
        if self._status_path.is_file():
            try:
                self._status = dict(json.loads(self._status_path.read_text(encoding="utf-8")))
            except (ValueError, OSError):
                self._status = {}

    async def _call(self, name: str, args: dict[str, Any]) -> Any:
        res = await self.client.call_tool(name, args)
        val = mcp_content_to_value(res)
        if res.get("isError"):
            raise MCPError(f"{name} 失败：{str(val)[:200]}", self.ctx.plugin_id)
        return val

    async def write(self, record: MemoryRecord) -> str:
        t = record.timeline
        tags = [f"tl:{t.lineage}@{t.turn}", f"kind:{record.kind}", *meta_tags(record), *record.tags]
        val = await self._call("mdcg_remember", {
            "content": record.content, "layer": self.ctx.config["layer"], "role": "knowledge",
            "tags": tags, "importance": record.importance, "consistency": False})
        nid = (val or {}).get("id") or (val or {}).get("node_id") if isinstance(val, dict) else None
        if not nid:
            raise MCPError(f"mdcg_remember 没有返回 id：{str(val)[:200]}", self.ctx.plugin_id)
        self.ctx.emit("memory.write", {"id": nid, "timeline": [t.lineage, t.turn], "kind": record.kind})
        return nid

    async def recall(self, query: str, k: int, visible_tl: list[Timeline]) -> list[MemoryHit]:
        val = await self._call("mdcg_search", {"query": query, "k": k * self.ctx.config["overfetch"]})
        hits: list[MemoryHit] = []
        for r in (val or {}).get("results") or []:
            node = r.get("node") or {}
            fm = node.get("frontmatter") or {}
            tl = parse_timeline(fm.get("tags"))
            if not visible(tl, visible_tl):
                continue
            nid = node.get("id", "")
            state = str(r.get("state") or node.get("state") or "active")
            status = "superseded" if state == "superseded" or self._status.get(nid) == "superseded" else "live"
            if status != "live":
                continue
            hits.append(MemoryHit(id=nid, content=node.get("content", ""),
                                  score=float(r.get("score") or 0.0), source="lingshu", timeline=tl,
                                  meta={"state": r.get("state"), "status": status, **parse_meta(fm.get("tags"))}))
            if len(hits) >= k:
                break
        return hits

    async def mark(self, ids: list[str], status: str, by: str | None = None) -> int:
        ids = [str(x) for x in ids if str(x)]
        if not ids:
            return 0
        n = len(ids)
        if self._has_mark:
            val = await self._call("mdcg_mark", {"ids": ids, "state": status, **({"by": by} if by else {})})
            n = len((val or {}).get("marked") or []) if isinstance(val, dict) else n
        for x in ids:  # 本地状态文件两种情况都写：外部灵枢不支持 mark 时靠它过滤
            self._status[x] = status
        self._status_path.write_text(json.dumps(self._status, ensure_ascii=False), encoding="utf-8")
        self.ctx.emit("memory.mark", {"ids": ids, "status": status, "by": by})
        return n

    async def health(self) -> dict[str, Any]:
        return {"ok": self.client.alive, "restarts": self.client.restarts,
                "server": self.client.server_info.get("serverInfo")}

    async def close(self) -> None:
        client = getattr(self, "client", None)
        if client is not None:
            await client.close()
