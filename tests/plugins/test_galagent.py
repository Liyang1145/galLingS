"""GalAgent：流拆分、工具循环、确认、前端工具、扩展插件、post_ending 端口。"""
from __future__ import annotations

import asyncio
import importlib
import json
from pathlib import Path
from typing import Any

import pytest

from server.plugins import PluginManager, PluginSettings

from .conftest import BUILTIN, base_manifest, write_plugin



def _splitter():
    import importlib.util
    spec = importlib.util.spec_from_file_location("ga_split", BUILTIN / "galagent" / "stream_split.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)  # type: ignore[union-attr]
    return m.StreamSplitter()


def test_splitter_handles_tags_cut_across_chunks():
    s = _splitter()
    out: list[tuple[str, str]] = []
    for chunk in ["<thi", "nk>想一", "想</th", "ink>好<emo", "tion>笑</emotion>的", " a<b 不是标签"]:
        out += list(s.feed(chunk))
    out += list(s.finish())
    think = "".join(t for k, t in out if k == "think")
    say = "".join(t for k, t in out if k == "say")
    assert think == "想一想"
    assert say == "好的 a<b 不是标签"
    assert ("emotion", "笑") in out


EXT_CODE = """
from server.plugins import ToolPlugin, ToolResult, ToolSpec
class P(ToolPlugin):
    async def list_tools(self):
        return [ToolSpec("roll_dice", "掷骰子", {"type": "object", "properties": {"sides": {"type": "integer"}}}, effect="read")]
    async def call(self, name, arguments, turn):
        return ToolResult(True, content={"value": 4, "sides": arguments.get("sides", 6)})
"""

HIDDEN_CODE = EXT_CODE.replace("roll_dice", "secret_tool")


async def _manager(tmp_path: Path, responses: list[dict[str, Any]], confirm: dict[str, str] | None = None) -> PluginManager:
    ext = tmp_path / "ext"
    ext.mkdir()
    write_plugin(ext, "dice", base_manifest("test.tool.dice", kind="tool", capabilities=["galagent"],
                                            provides={"tools": ["roll_dice"]}), EXT_CODE)
    write_plugin(ext, "hidden", base_manifest("test.tool.hidden", kind="tool",
                                              provides={"tools": ["secret_tool"]}), HIDDEN_CODE)
    cfg = {"workspace": str(tmp_path / "ws"), "think": True}
    if confirm:
        cfg["confirm"] = confirm
    settings = PluginSettings.from_dict({
        "paths": [str(BUILTIN), str(ext)],
        "select": {"llm": ["gallings.llm.scripted"]},
        "tools": ["gallings.tool.galagent", "test.tool.dice", "test.tool.hidden"],
        "config": {"gallings.llm.scripted": {"responses": responses, "chunk_chars": 5},
                   "gallings.tool.galagent": cfg}})
    m = PluginManager(settings, tmp_path / "data")
    await m.start()
    assert m.failed() == {}, m.failed()
    return m


class Collector:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.session: Any = None
        self.on: dict[str, Any] = {}
        self.done = asyncio.Event()

    async def __call__(self, m: dict[str, Any]) -> None:
        self.events.append(m)
        h = self.on.get(m["type"])
        if h:
            asyncio.get_running_loop().call_soon(lambda: asyncio.ensure_future(h(m)))
        if m["type"] == "turn_end":
            self.done.set()

    def types(self) -> list[str]:
        return [e["type"] for e in self.events]


async def _open(m: PluginManager, col: Collector, **hello: Any):
    prov = m.states["gallings.tool.galagent"].instance
    chain = m.chain("llm")
    s = prov.open_post_ending(llm_chain=chain, send=col, manager=m)
    col.session = s
    await s.handle({"type": "hello", "character": {"name": "猫小姐", "persona": "傲娇", "expressions": ["默认", "笑"]},
                    **hello})
    return s


async def test_tool_loop_think_and_reply(tmp_path: Path):
    (tmp_path / "ws").mkdir()
    (tmp_path / "ws" / "日记.txt").write_text("今天很开心", encoding="utf-8")
    m = await _manager(tmp_path, [
        {"text": "<think>玩家想看文件</think><emotion>笑</emotion>本喵去翻翻～",
         "tool_calls": [{"name": "list_dir", "arguments": {}}]},
        {"text": "<think>找到一个文件</think>只有一个「日记.txt」喵。"},
    ])
    col = Collector()
    s = await _open(m, col)
    ready = col.events[0]
    names = {t["name"] for t in ready["tools"]}
    assert {"powershell", "list_dir", "roll_dice"} <= names
    assert "secret_tool" not in names  # 没声明 galagent 能力的插件不接入
    await s.handle({"type": "user", "text": "看看我的文件"})
    await asyncio.wait_for(col.done.wait(), 10)
    t = col.types()
    assert t.index("step_start") < t.index("think_delta") < t.index("step_end") < t.index("tool_start") < t.index("tool_end")
    assert ("emotion" in t)
    end = col.events[-1]
    assert end["type"] == "turn_end" and end["reply"] == "只有一个「日记.txt」喵。"
    assert end["tool_calls"] == 1 and end["rounds"] == 2 and end["steps"] == 3
    te = next(e for e in col.events if e["type"] == "tool_end")
    assert te["ok"] and any("日记.txt" in x for x in te["result"]["entries"])
    # 历史里：user, assistant(tool_calls), tool, assistant
    assert [h.role for h in s.history] == ["user", "assistant", "tool", "assistant"]
    await m.stop()


async def test_approval_deny_and_allow(tmp_path: Path):
    m = await _manager(tmp_path, [
        {"text": "<think>要执行命令</think>", "tool_calls": [{"name": "powershell", "arguments": {"command": "echo hi"}}]},
        {"text": "好吧。"},
    ])
    col = Collector()
    s = await _open(m, col)
    col.on["approval_required"] = lambda e: s.handle({"type": "approve", "call_id": e["call_id"], "allow": False})
    await s.handle({"type": "user", "text": "跑个命令"})
    await asyncio.wait_for(col.done.wait(), 10)
    te = next(e for e in col.events if e["type"] == "tool_end")
    assert not te["ok"] and "没有同意" in te["error"]

    col.events.clear()
    col.done.clear()
    col.on["approval_required"] = lambda e: s.handle({"type": "approve", "call_id": e["call_id"], "allow": True,
                                                      "remember": True})
    await s.handle({"type": "user", "text": "再跑一次"})
    await asyncio.wait_for(col.done.wait(), 10)
    te = next(e for e in col.events if e["type"] == "tool_end")
    assert te["ok"] and "hi" in te["result"]["stdout"]
    assert "powershell" in s.always_allow
    await m.stop()


async def test_client_tool_roundtrip(tmp_path: Path):
    m = await _manager(tmp_path, [
        {"text": "", "tool_calls": [{"name": "set_var", "arguments": {"name": "好感", "value": 5}}]},
        {"text": "记下了。"},
    ])
    col = Collector()
    s = await _open(m, col, client_tools=[{"name": "set_var", "description": "改变量",
                                           "parameters": {"type": "object", "properties": {}}}])
    assert any(t["name"] == "set_var" and t["source"] == "client" for t in col.events[0]["tools"])
    col.on["client_call"] = lambda e: s.handle({"type": "client_result", "call_id": e["call_id"], "ok": True,
                                                "result": {"好感": 5}})
    await s.handle({"type": "user", "text": "把好感设成5"})
    await asyncio.wait_for(col.done.wait(), 10)
    te = next(e for e in col.events if e["type"] == "tool_end")
    assert te["ok"] and te["result"] == {"好感": 5}
    await m.stop()


async def test_extension_tool_and_stop(tmp_path: Path):
    m = await _manager(tmp_path, [
        {"text": "", "tool_calls": [{"name": "roll_dice", "arguments": {"sides": 20}}]},
        {"text": "", "tool_calls": [{"name": "powershell", "arguments": {"command": "echo x"}}]},
        {"text": "不会到这里"},
    ])
    col = Collector()
    s = await _open(m, col)

    async def stop(_e):
        await s.handle({"type": "stop"})
    col.on["approval_required"] = stop
    await s.handle({"type": "user", "text": "掷骰子然后跑命令"})
    await asyncio.wait_for(col.done.wait(), 10)
    dice = next(e for e in col.events if e["type"] == "tool_end" and e["name"] == "roll_dice")
    assert dice["ok"] and dice["result"]["sides"] == 20
    end = col.events[-1]
    assert end["stopped"] is True
    # 被中止的 tool_call 也补了回应，历史仍然合法
    roles = [h.role for h in s.history]
    assert roles.count("tool") == 2
    await m.stop()


def test_workspace_escape_blocked(tmp_path: Path):
    import importlib.util
    import sys
    spec = importlib.util.spec_from_file_location("ga_tools", BUILTIN / "galagent" / "tools_basic.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ga_tools"] = mod
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    bt = mod.BasicTools({"workspace": str(tmp_path / "w")}, tmp_path)
    r = asyncio.run(bt.call("read_file", {"path": "../../etc/passwd"}))
    assert not r.ok and "工作目录之外" in r.error


def test_ws_endpoint_requires_token(tmp_path: Path):
    from fastapi.testclient import TestClient

    from server.api.post_ending import create_standalone_app

    cfg = {"server": {"data_dir": str(tmp_path / "d")},
           "game": {"post_ending": {"mode": "chat_window", "token": "s3cret"}},
           "plugins": {"paths": [str(BUILTIN)], "select": {"llm": ["gallings.llm.scripted"]},
                       "tools": ["gallings.tool.galagent"],
                       "config": {"gallings.llm.scripted": {"responses": [{"text": "<think>嗯</think>你好呀。"}]},
                                  "gallings.tool.galagent": {"workspace": str(tmp_path / "ws")}}}}
    with TestClient(create_standalone_app(cfg)) as c:
        info = c.get("/api/post_ending/info").json()
        assert info["enabled"] and info["provider"] == "gallings.tool.galagent" and info["tools"] == []
        with c.websocket_connect("/ws/post_ending") as ws:
            ws.send_text(json.dumps({"type": "hello", "token": "wrong"}))
            assert json.loads(ws.receive_text())["code"] == "auth"
        with c.websocket_connect("/ws/post_ending") as ws:
            ws.send_text(json.dumps({"type": "hello", "token": "s3cret", "character": {"name": "鲸鱼小姐"}}))
            assert json.loads(ws.receive_text())["type"] == "ready"
            ws.send_text(json.dumps({"type": "user", "text": "嗨"}))
            seen = []
            while True:
                e = json.loads(ws.receive_text())
                seen.append(e["type"])
                if e["type"] == "turn_end":
                    assert e["reply"] == "你好呀。"
                    break
            assert "think_delta" in seen and "say_delta" in seen
        r = c.post("/api/post_ending/chat", headers={"X-GalAgent-Token": "s3cret"},
                   json={"protocol": "vn-agent/1", "character": {"name": "鲸鱼小姐"}, "input": "嗨",
                         "history": [{"role": "player", "text": "嗨"}]})
        assert r.status_code == 200 and r.json()["text"] == "你好呀。"
        assert c.get("/galagent").status_code == 200
        assert c.get("/galagent/galagent-ui.js").status_code == 200
        # VN Studio 插件（vn-plugin/1）：作品页里的游戏从这里装 GalAgent
        js = c.get("/galagent/galagent.vnplugin.js")
        assert js.status_code == 200 and js.headers["content-type"].startswith("text/javascript")
        assert "VNPlugin.define" in js.text and "gallings.galagent" in js.text and "</script>" not in js.text


def test_vn_plugin_listing(tmp_path: Path):
    """开着 GalAgent 时 /api/vn/plugins 会列出它；关掉（mode: off）就不列。"""
    from server.api import post_ending

    class RT:
        def __init__(self, mode: str):
            from server.plugins import PluginManager, PluginSettings
            self.game = {"post_ending": {"mode": mode}}
            self.plugins = PluginManager(PluginSettings.from_dict({"paths": [str(BUILTIN)], "tools": ["gallings.tool.galagent"],
                                                                   "config": {"gallings.tool.galagent": {"workspace": str(tmp_path / "ws")}}}),
                                         tmp_path / "d")

    on = RT("chat_window")
    asyncio.run(on.plugins.start())
    try:
        assert post_ending.vn_plugins(on) == [{"id": "gallings.galagent", "name": "GalAgent", "url": "/galagent/galagent.vnplugin.js"}]
    finally:
        asyncio.run(on.plugins.stop())
    assert post_ending.vn_plugins(RT("off")) == []


async def test_example_notes_extension(tmp_path: Path):
    settings = PluginSettings.from_dict({
        "paths": [str(BUILTIN), str(BUILTIN.parent / "examples")],
        "select": {"llm": ["gallings.llm.scripted"]},
        "tools": ["gallings.tool.galagent", "example.tool.notes"],
        "config": {"gallings.llm.scripted": {"responses": [
            {"text": "", "tool_calls": [{"name": "add_note", "arguments": {"text": "周六一起吃布丁"}}]},
            {"text": "记好啦。"}]},
            "gallings.tool.galagent": {"workspace": str(tmp_path / "ws"), "confirm_by_effect": {"perform": "auto", "read": "auto"}}}})
    m = PluginManager(settings, tmp_path / "data")
    await m.start()
    assert m.failed() == {}
    col = Collector()
    s = await _open(m, col)
    pol = {t["name"]: (t["source"], t["policy"]) for t in col.events[0]["tools"]}
    assert pol["add_note"] == ("example.tool.notes", "auto") and pol["list_notes"][1] == "auto"
    await s.handle({"type": "user", "text": "帮我记一下周六吃布丁"})
    await asyncio.wait_for(col.done.wait(), 10)
    te = next(e for e in col.events if e["type"] == "tool_end")
    assert te["ok"] and te["result"]["count"] == 1
    await m.stop()


async def test_no_model_finishes_turn_instead_of_hanging(tmp_path: Path):
    m = await _manager(tmp_path, [])
    try:
        col = Collector()
        s = await _open(m, col)
        s.chain = []
        await s.handle({"type": "user", "text": "晚安"})
        await asyncio.wait_for(col.done.wait(), 1)
        end = col.events[-1]
        assert end["type"] == "turn_end" and end["tool_calls"] == 0
        assert "尚未配置" in end["reply"] and end["error"]
        assert not s.task
        await s.close()
    finally:
        await m.stop()
