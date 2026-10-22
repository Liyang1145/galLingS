"""灵枢（md_cg）MCP stdio 服务端：认知图记忆存储、混合检索（BM25 + 语义概念扩展 + 图激活扩散）。

支持 JSON-RPC 2.0 stdio 协议（换行分隔）：
- initialize / notifications/initialized / shutdown
- tools/list
- tools/call：
  - mdcg_remember：写入记忆节点并自动构建实体/概念关联边
  - mdcg_search：按 BM25 + 语义同义概念簇 + 认知图边扩散混合检索
  - mdcg_get：按节点 ID 读取记忆节点与邻边
  - mdcg_link：显式建立两个记忆节点的关联边
  - mdcg_status：查看认知图节点数、边数与存储路径
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "lingshu-mdcg", "version": "0.1.0"}

_REPO_ROOT = Path(__file__).resolve().parents[4]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from server.memory.text_index import extract_features as _extract_features, score_shared_features  # noqa: E402


class CognitiveGraph:
    def __init__(self, root: Path, actor: str = "gallings") -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.actor = actor
        self.nodes_file = self.root / "nodes.jsonl"
        self.edges_file = self.root / "edges.jsonl"
        self.nodes: dict[str, dict[str, Any]] = {}
        self.edges: list[dict[str, Any]] = []
        self._adj: dict[str, list[tuple[str, float]]] = {}
        self._df: dict[str, int] = {}
        self._node_feats: dict[str, set[str]] = {}
        self._load()

    def _load(self) -> None:
        if self.nodes_file.is_file():
            for line in self.nodes_file.read_text(encoding="utf-8", errors="replace").splitlines():
                if not line.strip():
                    continue
                try:
                    n = json.loads(line)
                    nid = n.get("id")
                    if nid:
                        self.nodes[nid] = n
                        self._index_node(nid, n.get("content", ""))
                except json.JSONDecodeError:
                    continue
        if self.edges_file.is_file():
            for line in self.edges_file.read_text(encoding="utf-8", errors="replace").splitlines():
                if not line.strip():
                    continue
                try:
                    e = json.loads(line)
                    self._add_edge_mem(e["src"], e["dst"], float(e.get("weight", 0.5)))
                    self.edges.append(e)
                except (KeyError, ValueError, json.JSONDecodeError):
                    continue

    def _index_node(self, nid: str, content: str) -> None:
        feats = _extract_features(content)
        self._node_feats[nid] = feats
        for f in feats:
            self._df[f] = self._df.get(f, 0) + 1

    def _add_edge_mem(self, src: str, dst: str, weight: float) -> None:
        self._adj.setdefault(src, []).append((dst, weight))
        self._adj.setdefault(dst, []).append((src, weight))

    def remember(self, args: dict[str, Any]) -> dict[str, Any]:
        content = str(args.get("content") or "").strip()
        layer = str(args.get("layer") or "contextual")
        role = str(args.get("role") or "knowledge")
        tags = [str(t) for t in (args.get("tags") or [])]
        importance = float(args.get("importance") if args.get("importance") is not None else 0.5)

        nid = f"n{len(self.nodes) + 1:05d}"
        while nid in self.nodes:
            nid = f"n{int(nid[1:]) + 1:05d}"

        node = {
            "id": nid,
            "node_id": nid,
            "content": content,
            "state": "active",
            "created_at": time.time(),
            "frontmatter": {
                "layer": layer,
                "role": role,
                "actor": self.actor,
                "tags": tags,
                "importance": importance,
            },
        }
        self.nodes[nid] = node
        self._index_node(nid, content)
        with self.nodes_file.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(node, ensure_ascii=False) + "\n")

        # 自动建立认知图关联边（共享概念簇或稀有实词特征的节点相连）
        my_feats = self._node_feats[nid]
        new_edges: list[dict[str, Any]] = []
        for other_id, other_feats in self._node_feats.items():
            if other_id == nid:
                continue
            shared = my_feats & other_feats
            concepts = [x for x in shared if x.startswith("concept:")]
            rare_bg = [x for x in shared if x.startswith(("bg:", "tg:")) and self._df.get(x, 1) <= 4]
            if concepts or len(rare_bg) >= 2:
                w = min(1.0, 0.35 * len(concepts) + 0.15 * len(rare_bg))
                edge = {"src": nid, "dst": other_id, "weight": round(w, 3), "kind": "semantic"}
                self._add_edge_mem(nid, other_id, w)
                self.edges.append(edge)
                new_edges.append(edge)
        if new_edges:
            with self.edges_file.open("a", encoding="utf-8", newline="\n") as f:
                for e in new_edges:
                    f.write(json.dumps(e, ensure_ascii=False) + "\n")

        return {"id": nid, "node_id": nid, "layer": layer, "actor": self.actor, "edges_added": len(new_edges)}

    def search(self, args: dict[str, Any]) -> dict[str, Any]:
        query = str(args.get("query") or "").strip()
        k = max(1, int(args.get("k") or 10))
        if not query or not self.nodes:
            return {"results": []}

        q_feats = _extract_features(query)
        n_docs = max(1, len(self.nodes))
        direct_scores: dict[str, float] = {}

        for nid, node in self.nodes.items():
            d_feats = self._node_feats.get(nid) or set()
            shared = q_feats & d_feats
            if not shared:
                continue
            score = score_shared_features(shared, self._df, n_docs)
            norm = math.sqrt(max(4, len(d_feats)))
            imp = float((node.get("frontmatter") or {}).get("importance", 0.5))
            direct_scores[nid] = (score / norm) + 0.08 * imp

        # 认知图一跳激活扩散（Spreading Activation）
        final_scores = dict(direct_scores)
        for nid, s in sorted(direct_scores.items(), key=lambda x: -x[1])[:12]:
            for nb, w in self._adj.get(nid, ()):
                boost = 0.18 * s * w
                if boost > 0.02:
                    final_scores[nb] = final_scores.get(nb, 0.0) + boost

        ranked = sorted(final_scores.items(), key=lambda x: (-x[1], x[0]))[:k]
        results = [
            {
                "id": nid,
                "content": self.nodes[nid].get("content") or self.nodes[nid].get("body") or "",
                "node": self.nodes[nid],
                "score": round(sc, 4),
                "state": self.nodes[nid].get("state", "active"),
            }
            for nid, sc in ranked
        ]
        return {"results": results}

    def get_node(self, args: dict[str, Any]) -> dict[str, Any]:
        nid = str(args.get("id") or args.get("node_id") or "")
        node = self.nodes.get(nid)
        if not node:
            return {"found": False, "id": nid}
        neighbors = [{"id": dst, "weight": w} for dst, w in self._adj.get(nid, ())]
        return {"found": True, "node": node, "neighbors": neighbors}

    def link(self, args: dict[str, Any]) -> dict[str, Any]:
        src = str(args.get("src") or "")
        dst = str(args.get("dst") or "")
        w = float(args.get("weight") if args.get("weight") is not None else 0.6)
        if src not in self.nodes or dst not in self.nodes:
            return {"ok": False, "error": "节点不存在"}
        edge = {"src": src, "dst": dst, "weight": round(w, 3), "kind": str(args.get("kind") or "manual")}
        self._add_edge_mem(src, dst, w)
        self.edges.append(edge)
        with self.edges_file.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(edge, ensure_ascii=False) + "\n")
        return {"ok": True, "edge": edge}

    def status(self, _args: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": True,
            "engine": "lingshu-mdcg",
            "version": SERVER_INFO["version"],
            "root": str(self.root),
            "actor": self.actor,
            "nodes": len(self.nodes),
            "edges": len(self.edges),
        }


TOOLS_SPEC = [
    {
        "name": "mdcg_remember",
        "description": "向灵枢认知图写入一条记忆节点（零 LLM、存原文，自动建立语义与时间线关联边）。",
        "inputSchema": {
            "type": "object",
            "required": ["content"],
            "properties": {
                "content": {"type": "string", "description": "记忆原文"},
                "layer": {"type": "string", "default": "contextual"},
                "role": {"type": "string", "default": "knowledge"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "importance": {"type": "number", "default": 0.5},
                "consistency": {"type": "boolean", "default": False},
            },
        },
    },
    {
        "name": "mdcg_search",
        "description": "在灵枢认知图中按混合检索（BM25 + 语义概念扩展 + 图激活扩散）召回相关记忆节点。",
        "inputSchema": {
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string", "description": "查询语句或关键词"},
                "k": {"type": "integer", "default": 10, "minimum": 1, "maximum": 200},
            },
        },
    },
    {
        "name": "mdcg_get",
        "description": "按节点 ID 获取灵枢认知图中的单条记忆及关联邻边。",
        "inputSchema": {
            "type": "object",
            "required": ["id"],
            "properties": {"id": {"type": "string"}},
        },
    },
    {
        "name": "mdcg_link",
        "description": "在灵枢认知图的两个记忆节点之间建立关联边。",
        "inputSchema": {
            "type": "object",
            "required": ["src", "dst"],
            "properties": {
                "src": {"type": "string"},
                "dst": {"type": "string"},
                "weight": {"type": "number", "default": 0.6},
                "kind": {"type": "string", "default": "manual"},
            },
        },
    },
    {
        "name": "mdcg_status",
        "description": "查看灵枢认知图当前的节点数、关联边数与存储状态。",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _reply(rid: Any, result: Any = None, error: dict[str, Any] | None = None) -> None:
    msg: dict[str, Any] = {"jsonrpc": "2.0", "id": rid}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    root = Path(os.environ.get("MDCG_ROOT") or (Path.home() / ".gallings" / "plugins" / "gallings.memory.lingshu" / "graph"))
    actor = os.environ.get("MDCG_ACTOR") or "gallings"
    graph = CognitiveGraph(root, actor=actor)
    handlers = {
        "mdcg_remember": graph.remember,
        "mdcg_search": graph.search,
        "mdcg_get": graph.get_node,
        "mdcg_link": graph.link,
        "mdcg_status": graph.status,
    }

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        method = req.get("method")
        rid = req.get("id")
        params = req.get("params") or {}

        if method == "initialize":
            _reply(rid, {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": SERVER_INFO,
            })
        elif method == "notifications/initialized":
            continue
        elif method == "shutdown":
            if rid is not None:
                _reply(rid, {})
            return 0
        elif method == "tools/list":
            _reply(rid, {"tools": TOOLS_SPEC})
        elif method == "tools/call":
            name = str(params.get("name") or "")
            args = params.get("arguments") or {}
            fn = handlers.get(name)
            if fn is None:
                _reply(rid, {"isError": True, "content": [{"type": "text", "text": f"未知工具：{name}"}]})
            else:
                try:
                    val = fn(args)
                    _reply(rid, {"isError": False, "content": [{"type": "text", "text": json.dumps(val, ensure_ascii=False)}]})
                except Exception as e:  # noqa: BLE001
                    _reply(rid, {"isError": True, "content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}]})
        elif rid is not None:
            _reply(rid, error={"code": -32601, "message": f"Method not found: {method}"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
