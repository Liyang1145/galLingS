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


def _strip_prefix(text: str) -> str:
    return _PREFIX.sub("", text.strip())


def _extract_features(text: str) -> set[str]:
    """提取检索特征：字符级 bigram + 有效实词单字 + 语义概念标签。"""
    core = _strip_prefix(text.lower())
    clean = _PUNCT.sub("", core)
    feats: set[str] = set()
    # 1. Bigrams & Trigrams
    for i in range(len(clean) - 1):
        bg = clean[i:i + 2]
        if bg not in _STOP_BG and not all(c in _STOP_CHARS for c in bg):
            feats.add(f"bg:{bg}")
    for i in range(len(clean) - 2):
        tg = clean[i:i + 3]
        if not all(c in _STOP_CHARS for c in tg):
            feats.add(f"tg:{tg}")
    # 2. 有效单字（去掉停用字）
    for ch in clean:
        if ch not in _STOP_CHARS:
            feats.add(f"ch:{ch}")
    # 3. 语义概念簇匹配
    for cid, words in _CONCEPT_CLUSTERS:
        if any(w in core or w in clean for w in words):
            feats.add(cid)
    return feats


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
            score = 0.0
            for f in shared:
                df = self._df.get(f, 1)
                idf = math.log(1.0 + (n_docs - df + 0.5) / (df + 0.5))
                if f.startswith("concept:"):
                    score += 3.2 * max(0.8, idf)
                elif f.startswith("tg:"):
                    score += 2.2 * max(0.5, idf)
                elif f.startswith("bg:"):
                    score += 1.6 * max(0.4, idf)
                else:
                    score += 0.35 * max(0.1, idf)
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
