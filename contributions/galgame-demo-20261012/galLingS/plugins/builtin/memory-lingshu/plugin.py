from __future__ import annotations

import re
from typing import Any

from server.plugins import MemoryHit, MemoryPlugin, MemoryRecord, MCPError, Timeline
from server.plugins.mcp import MCPClient, mcp_content_to_value

_TL = re.compile(r"^tl:(?P<lineage>[^@]+)@(?P<turn>\d+)$")


def visible(t: Timeline | None, views: list[Timeline]) -> bool:
    """t 在可见时间线前缀内：同 lineage 且回合不晚于该时间线当前回合。没打标的记忆视为全局可见。"""
    if t is None:
        return True
    return any(v.lineage == t.lineage and t.turn <= v.turn for v in views)


def parse_timeline(tags: list[str] | None) -> Timeline | None:
    for tag in tags or []:
        m = _TL.match(str(tag))
        if m:
            return Timeline(m["lineage"], int(m["turn"]))
    return None


class LingshuMemory(MemoryPlugin):
    async def setup(self) -> None:
        c = self.ctx.config
        graph = c["graph_dir"].replace("${data_dir}", str(self.ctx.data_dir))
        env = {"MDCG_ROOT": graph, "MDCG_ACTOR": c["actor"], "PYTHONPATH": c["dsh_memory_path"],
               "MDCG_SUSTAIN": "0", "PYTHONUTF8": "1", "MDCG_MCP_SURFACE": "full"}
        token = self.ctx.secrets.get("token")
        if token:
            env["MDCG_TOKEN"] = token
        else:
            env["MDCG_LEGACY_ENV_AUTH"] = "1"
        self.client = MCPClient([c["python"], "-m", "md_cg.mcp_server"], env=env, cwd=c["dsh_memory_path"],
                                call_timeout_s=c["call_timeout_s"], name=self.ctx.plugin_id)
        await self.client.start()
        names = {t["name"] for t in await self.client.list_tools()}
        need = {"mdcg_remember", "mdcg_search"}
        if not need <= names:
            raise MCPError(f"灵枢缺少工具 {sorted(need - names)}", self.ctx.plugin_id)

    async def _call(self, name: str, args: dict[str, Any]) -> Any:
        res = await self.client.call_tool(name, args)
        val = mcp_content_to_value(res)
        if res.get("isError"):
            raise MCPError(f"{name} 失败：{str(val)[:200]}", self.ctx.plugin_id)
        return val

    async def write(self, record: MemoryRecord) -> str:
        t = record.timeline
        tags = [f"tl:{t.lineage}@{t.turn}", f"kind:{record.kind}", *record.tags]
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
            hits.append(MemoryHit(id=node.get("id", ""), content=node.get("content", ""),
                                  score=float(r.get("score") or 0.0), source="lingshu", timeline=tl,
                                  meta={"state": r.get("state")}))
            if len(hits) >= k:
                break
        return hits

    async def health(self) -> dict[str, Any]:
        return {"ok": self.client.alive, "restarts": self.client.restarts,
                "server": self.client.server_info.get("serverInfo")}

    async def close(self) -> None:
        client = getattr(self, "client", None)
        if client is not None:
            await client.close()
