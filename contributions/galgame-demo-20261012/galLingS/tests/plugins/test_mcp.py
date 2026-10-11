from __future__ import annotations

import sys

import pytest

from server.plugins import MCPError, PluginSettings
from server.plugins.manager import PluginManager
from server.plugins.mcp import MCPClient

from .conftest import REPO, base_manifest, write_plugin

FAKE = str(REPO / "tests" / "fixtures" / "fake_mcp_server.py")


def mcp_manifest(pid, tools, env=None):
    rt = {"type": "mcp", "command": [sys.executable, FAKE], "startup_timeout_s": 10, "call_timeout_s": 10}
    if env:
        rt["env"] = env
    return base_manifest(pid, kind="tool", runtime=rt, provides={"tools": tools})


async def test_mcp_tool_plugin_whitelist(plugin_root, tmp_path):
    write_plugin(plugin_root, "m", mcp_manifest("t.tool.fake", ["echo", "add"]))
    s = PluginSettings.from_dict({"tools": ["t.tool.fake"]}); s.paths = [plugin_root]
    async with PluginManager(s, tmp_path) as mgr:
        assert not mgr.failed(), mgr.failed()
        names = [t.name for t in await mgr.tool_specs()]
        assert names == ["echo", "add"]  # secret_tool 不在白名单，不导出
        r = await mgr.call_tool("add", {"a": 2, "b": 3}, {})
        assert r.ok and r.content == {"sum": 5}
        r = await mgr.call_tool("echo", {"text": "海风"}, {})
        assert r.content == "海风"
        assert not (await mgr.call_tool("secret_tool", {}, {})).ok


async def test_mcp_missing_declared_tool(plugin_root, tmp_path):
    write_plugin(plugin_root, "m", mcp_manifest("t.tool.fake", ["echo", "nonexistent"]))
    s = PluginSettings.from_dict({"tools": ["t.tool.fake"]}); s.paths = [plugin_root]
    async with PluginManager(s, tmp_path) as mgr:
        assert "nonexistent" in mgr.failed()["t.tool.fake"]


async def test_mcp_restart_once(tmp_path):
    marker = tmp_path / "crashed"
    c = MCPClient([sys.executable, FAKE], env={"FAKE_MCP_CRASH_ON": "echo", "FAKE_MCP_MARKER": str(marker)},
                  call_timeout_s=10)
    await c.start()
    try:
        res = await c.call_tool("echo", {"text": "hi"})  # 第一次让服务崩溃，客户端自动重启后重试成功
        assert res["content"][0]["text"] == "hi" and c.restarts == 1
        marker.unlink()
        with pytest.raises(MCPError):  # 再崩一次：重启次数用尽
            await c.call_tool("echo", {"text": "hi"})
    finally:
        await c.close()


async def test_mcp_bad_command():
    c = MCPClient(["/no/such/binary"])
    with pytest.raises(MCPError, match="无法启动"):
        await c.start()
