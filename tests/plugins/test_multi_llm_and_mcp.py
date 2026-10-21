"""测试：内置灵枢认知图 MCP 引擎、多模型 LLM 插件链、GalAgent 完整工具链与 MCP 扩展合并。"""
from __future__ import annotations

import pytest

from server.plugins import PluginManager, PluginSettings
from server.runtime import ROOT
from server.settings_store import SettingsStore


def test_builtin_plugins_discovered(tmp_path):
    """四大模型插件、内置灵枢记忆库、GalAgent 与灵枢 MCP 工具插件全部可被发现。"""
    settings = PluginSettings.from_dict({"paths": ["plugins/builtin"]}, base_dir=ROOT)
    pm = PluginManager(settings, tmp_path / "data")
    pm.discover()
    expected = {
        "gallings.llm.openai-compat",
        "gallings.llm.anthropic",
        "gallings.llm.gemini",
        "gallings.llm.ollama",
        "gallings.memory.lingshu",
        "gallings.memory.local",
        "gallings.tool.galagent",
        "gallings.tool.lingshu-mcp",
    }
    assert expected.issubset(set(pm.states.keys()))


def test_settings_store_multi_provider_overlay(tmp_path):
    """SettingsStore 支持切换 openai-compat / anthropic / gemini / ollama 四种模型协议与 lingshu 记忆。"""
    store = SettingsStore(tmp_path)
    base_cfg = {
        "plugins": {
            "paths": ["plugins/builtin"],
            "select": {
                "llm": ["gallings.llm.openai-compat"],
                "memory": ["gallings.memory.lingshu", "gallings.memory.local"],
            },
            "tools": ["gallings.tool.galagent", "gallings.tool.lingshu-mcp"],
            "config": {},
        }
    }

    # 1. 切换到 Anthropic Claude
    store.save({
        "llm": {"provider": "anthropic", "base_url": "https://api.anthropic.com", "model": "claude-sonnet-4-20250514", "api_key": "sk-ant-1234"},
        "memory": {"use": "lingshu", "dsh_memory_path": ""},
    })
    out = store.overlay(base_cfg)
    assert out["plugins"]["select"]["llm"][0] == "gallings.llm.anthropic"
    assert out["plugins"]["config"]["gallings.llm.anthropic"]["model"] == "claude-sonnet-4-20250514"
    assert out["plugins"]["select"]["memory"] == ["gallings.memory.lingshu", "gallings.memory.local"]

    # 2. 切换到 Google Gemini
    store.save({"llm": {"provider": "gemini", "base_url": "https://generativelanguage.googleapis.com", "model": "gemini-2.5-flash"}})
    out2 = store.overlay(base_cfg)
    assert out2["plugins"]["select"]["llm"][0] == "gallings.llm.gemini"
    assert out2["plugins"]["config"]["gallings.llm.gemini"]["model"] == "gemini-2.5-flash"

    # 3. 切换到本地免密 Ollama
    store.save({"llm": {"provider": "ollama", "base_url": "http://127.0.0.1:11434", "model": "qwen2.5:7b"}})
    out3 = store.overlay(base_cfg)
    assert out3["plugins"]["select"]["llm"][0] == "gallings.llm.ollama"


@pytest.mark.asyncio
async def test_galagent_mounts_lingshu_mcp_tools(tmp_path):
    """GalAgent 启动时自动发现并挂载 gallings.tool.lingshu-mcp 提供的 5 个 MCP 认知图工具，并可直接调用。"""
    settings = PluginSettings.from_dict(
        {
            "paths": ["plugins/builtin"],
            "select": {
                "llm": ["gallings.llm.ollama"],
                "memory": ["gallings.memory.lingshu", "gallings.memory.local"],
            },
            "tools": ["gallings.tool.galagent", "gallings.tool.lingshu-mcp"],
            "config": {
                "gallings.llm.ollama": {"base_url": "http://127.0.0.1:11434", "model": "qwen2.5:7b"},
                "gallings.tool.galagent": {"workspace": str(tmp_path / "ws")},
            },
        },
        base_dir=ROOT,
    )
    pm = PluginManager(settings, tmp_path / "data")
    await pm.start()
    try:
        # 1. 验证内置灵枢认知图记忆库已作为主记忆插件启动
        mem = pm.get("memory")
        assert mem is not None
        assert mem.ctx.plugin_id == "gallings.memory.lingshu"

        # 2. 验证 Ollama 免密模型插件已就绪
        llm = pm.get("llm")
        assert llm is not None
        assert llm.ctx.plugin_id == "gallings.llm.ollama"

        # 3. 验证 GalAgent 注册表同时拥有内置 6 工具 + 灵枢 MCP 5 工具
        from plugins.builtin.galagent.plugin import ManagerRegistry
        ga = pm.states["gallings.tool.galagent"].instance
        assert ga is not None
        reg = ManagerRegistry(ga, pm)
        entries = await reg.entries()
        names = {e.spec.name for e in entries}
        assert {"powershell", "read_file", "write_file", "list_dir", "fetch_url", "get_time"}.issubset(names)
        assert {"mdcg_remember", "mdcg_search", "mdcg_get", "mdcg_link", "mdcg_status"}.issubset(names)

        # 4. 通过 GalAgent 注册表直接调用 MCP 认知图工具写入并检索记忆
        r1 = await reg.call("mdcg_remember", {
            "content": "鲸鱼小姐在结局后和人类约定一起看下一次深海流星雨",
            "tags": ["约定", "流星雨"],
            "importance": 0.9,
        }, {})
        assert r1.ok is True
        assert r1.content["id"].startswith("n")

        r2 = await reg.call("mdcg_search", {"query": "深海流星雨约定", "k": 5}, {})
        assert r2.ok is True
        assert any("流星雨" in x["content"] for x in r2.content["results"])

        r3 = await reg.call("mdcg_status", {}, {})
        assert r3.ok is True
        assert r3.content["nodes"] >= 1
    finally:
        await pm.stop()
