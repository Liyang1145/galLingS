"""灵枢插件集成测试：需要本机 dsh-memory 检出，设 GALLINGS_TEST_DSH=<路径> 才运行。"""
from __future__ import annotations

import os

import pytest

from server.plugins import MemoryRecord, PluginSettings, Timeline
from server.plugins.manager import PluginManager

from .conftest import BUILTIN

DSH = os.environ.get("GALLINGS_TEST_DSH") or str(BUILTIN / "memory-lingshu")


async def test_write_recall_with_timeline_filter(tmp_path):
    s = PluginSettings.from_dict({"select": {"memory": "gallings.memory.lingshu"},
                                  "config": {"gallings.memory.lingshu": {"dsh_memory_path": DSH, "call_timeout_s": 60}}})
    s.paths = [BUILTIN]
    async with PluginManager(s, tmp_path) as mgr:
        assert not mgr.failed(), mgr.failed()
        mem = mgr.get("memory")
        await mem.write(MemoryRecord("玩家说他最喜欢吃焦糖布丁", Timeline("main", 3), kind="dialogue"))
        await mem.write(MemoryRecord("玩家说他讨厌布丁的口感", Timeline("branch-b", 5), kind="dialogue"))
        await mem.write(MemoryRecord("玩家承诺明天带布丁来浅滩", Timeline("main", 9), kind="dialogue"))
        hits = await mem.recall("布丁", 5, [Timeline("main", 5)])
        texts = [h.content for h in hits]
        assert any("焦糖布丁" in t for t in texts)
        assert not any("讨厌" in t for t in texts)      # 其它时间线
        assert not any("明天带布丁" in t for t in texts)  # 读档后被放弃的未来回合
        assert all(h.source == "lingshu" and h.timeline.lineage == "main" for h in hits)
        assert (await mem.health())["ok"]


async def test_mark_superseded_and_meta_roundtrip(tmp_path):
    """W2：内置灵枢 md_cg 支持 mdcg_mark，作废的节点默认不召回、原文仍在；来源标签经 tags 往返（W1）。"""
    s = PluginSettings.from_dict({"select": {"memory": "gallings.memory.lingshu"},
                                  "config": {"gallings.memory.lingshu": {"dsh_memory_path": DSH, "call_timeout_s": 60}}})
    s.paths = [BUILTIN]
    async with PluginManager(s, tmp_path) as mgr:
        assert not mgr.failed(), mgr.failed()
        mem = mgr.get("memory")
        old = await mem.write(MemoryRecord("她觉得紫色的灯塔很可疑", Timeline("main", 2), kind="note",
                                           meta={"source": "model_note", "evidence_key": "k1", "turn_event": 2}))
        new = await mem.write(MemoryRecord("她觉得紫色的灯塔其实很好看", Timeline("main", 4), kind="note",
                                           meta={"source": "model_note", "evidence_key": "k2", "as_of_turn": 4,
                                                 "supersedes": [old]}))
        assert await mem.mark([old], "superseded", new) == 1
        hits = await mem.recall("紫色的灯塔", 5, [Timeline("main", 9)])
        assert [h.id for h in hits] == [new]
        m = hits[0].meta
        assert m["source"] == "model_note" and m["evidence_key"] == "k2" and m["as_of_turn"] == 4
        assert m["supersedes"] == [old] and m["status"] == "live"
        got = await mem._call("mdcg_get", {"id": old})
        assert got["node"]["content"] == "她觉得紫色的灯塔很可疑" and got["node"]["state"] == "superseded"
        again = await mem._call("mdcg_search", {"query": "紫色的灯塔", "k": 5, "include_inactive": True})
        assert old in {r["id"] for r in again["results"]}
