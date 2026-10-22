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
