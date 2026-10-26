"""Offline Agent tests: synthetic context, temporary data directory and scripted model only."""
from __future__ import annotations

import asyncio
import copy
import json
import os
from pathlib import Path
import secrets
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import httpx
import yaml

from server.api import aftergame
from server.plugins import Error, LLMPlugin, TextDelta, ToolCallDone, Usage

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "http://127.0.0.1:5173"


def config(directory: str, responses: list | None = None) -> dict:
    return {
        "server": {"host": "127.0.0.1", "port": 8766, "data_dir": directory, "allowed_origins": [ORIGIN]},
        "aftergame": {
            "enabled": True, "service_id": "test-service", "name": "离线测试服务", "work_id": "chat-test-work",
            "characters": [{
                "id": "test-character", "revision": "test-1", "name": "测试角色", "persona": "仅用于离线测试。",
                "ending_ids": ["test-ending"],
            }],
        },
        "plugins": {
            "paths": ["plugins/builtin"], "select": {"llm": ["gallings.llm.scripted"]},
            "tools": [], "guards": [], "importers": [],
            "config": {"gallings.llm.scripted": {"responses": responses or [{"text": "离线测试回复🐋"}], "chunk_chars": 2}},
        },
    }


def request() -> dict:
    return {
        "format": "haifeng.chat-request/1", "requestId": "test-request", "conversationId": "test-conversation",
        "character": {"id": "test-character", "revision": "test-1", "name": "测试角色"},
        "context": {
            "format": "haifeng.cleared-context/1", "workId": "chat-test-work",
            "scope": {"kind": "development", "id": "normal-entry"},
            "completion": {"factId": "test-clear-1", "endingId": "test-ending"}, "coverage": "ending-only",
            "reference": {"kind": "current-content", "contentRevision": "a" * 64, "sourceSha256": "b" * 64},
        },
        "messages": [{"role": "user", "text": "隔离输入"}],
    }


class Model(LLMPlugin):
    def __init__(self, events):
        super().__init__(None)
        self.events = events
        self.requests = []
        self.closed = False

    async def stream(self, value):
        self.requests.append(value)
        try:
            for event in self.events:
                yield event
        finally:
            self.closed = True


async def collect(model, data=None, active=None, seen=None):
    value = request() if data is None else data
    ch = config("unused")["aftergame"]["characters"][0]
    return [json.loads(line) async for line in aftergame.turns(
        value, ch, model, set() if active is None else active, {} if seen is None else seen,
    )]


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.cfg = config("unused")
        _, self.characters, _ = aftergame.configuration(self.cfg)

    def test_valid_request_is_minimum_context(self):
        value = request()
        self.assertIs(aftergame.validate_request(value, self.cfg["aftergame"], self.characters), value)

    def test_reject_preview_game_other_work_character_revision_and_ending(self):
        mutations = [
            lambda v: v["context"]["scope"].update(kind="preview"),
            lambda v: v["context"]["scope"].update(kind="game", id="main"),
            lambda v: v["context"].update(workId="another-work"),
            lambda v: v["character"].update(revision="obsolete"),
            lambda v: v["context"]["completion"].update(endingId="not-allowed"),
            lambda v: v.update(tools=[{"command": "write_file"}]),
            lambda v: v["messages"][0].update(role="system"),
            lambda v: v["context"]["reference"].update(kind="historical-route"),
            lambda v: v["context"]["reference"].update(sourceSha256="short"),
        ]
        for change in mutations:
            with self.subTest(change=mutations.index(change)):
                value = request()
                change(value)
                with self.assertRaises(aftergame.Invalid):
                    aftergame.validate_request(value, self.cfg["aftergame"], self.characters)

    def test_utf16_and_history_limits_match_client(self):
        for text in ("🐋" * 2001, "\ud800"):
            value = request()
            value["messages"][0]["text"] = text
            with self.assertRaises(aftergame.Invalid):
                aftergame.validate_request(value, self.cfg["aftergame"], self.characters)
        value = request()
        value["messages"] = [
            {"role": "user" if i % 2 == 0 else "assistant", "text": "字" * (2000 if i % 2 == 0 else 10000)}
            for i in range(9)
        ]
        with self.assertRaises(aftergame.Invalid):
            aftergame.validate_request(value, self.cfg["aftergame"], self.characters)

    def test_duplicate_fields_nan_and_recursive_json_are_rejected(self):
        for raw in (b'{"format":"one","format":"two"}', b'{"n":NaN}'):
            with self.assertRaises(aftergame.Invalid):
                aftergame.strict_json(raw)
        # Python versions differ in parser depth limits. Either parsing or the
        # request boundary must reject this; don't assert a platform's recursion threshold.
        with self.assertRaises(aftergame.Invalid):
            aftergame.validate_request(
                aftergame.strict_json(b"[" * 2000 + b"]" * 2000), self.cfg["aftergame"], self.characters,
            )

    def test_tools_memory_fallback_and_wildcard_origins_are_rejected(self):
        mutations = [
            lambda v: v["plugins"].update(tools=["gallings.tool.galagent"]),
            lambda v: v["plugins"]["select"].update(memory=["gallings.memory.local"]),
            lambda v: v["plugins"]["select"].update(llm=["first", "second"]),
            lambda v: v["server"].update(host="0.0.0.0"),
            lambda v: v["server"].update(allowed_origins=["*"]),
            lambda v: v["server"].update(allowed_origins=["null"]),
            lambda v: v["server"].update(allowed_origins=["http://127.0.0.1/path"]),
        ]
        for index, change in enumerate(mutations):
            with self.subTest(index=index):
                value = copy.deepcopy(self.cfg)
                change(value)
                with self.assertRaises((aftergame.Invalid, ValueError)):
                    aftergame.configuration(value)

    def test_example_is_disabled_and_has_no_supplier_or_role(self):
        value = yaml.safe_load((ROOT / "config.aftergame.example.yaml").read_text(encoding="utf-8"))
        _, characters, settings = aftergame.configuration(value)
        self.assertFalse(value["aftergame"]["enabled"])
        self.assertFalse(characters)
        self.assertFalse(settings.select["llm"])
        self.assertFalse(value["server"]["allowed_origins"])


class StreamTests(unittest.IsolatedAsyncioTestCase):
    async def test_metadata_does_not_restart_first_text_deadline(self):
        timeouts = []
        original_wait_for = asyncio.wait_for

        async def observed_wait_for(awaitable, timeout):
            timeouts.append(timeout)
            return await original_wait_for(awaitable, timeout)

        class MetadataFirst(Model):
            async def stream(self, value):
                yield Usage(1, 0)
                await asyncio.sleep(0.01)
                yield Usage(2, 0)
                yield TextDelta("有效回复")

        with patch.object(aftergame.asyncio, "wait_for", observed_wait_for):
            result = await collect(MetadataFirst([]))
        self.assertEqual(result[-1]["type"], "done")
        self.assertLess(timeouts[1], timeouts[0])

    async def test_single_model_call_without_tools_and_ordered_utf16_text(self):
        model = Model([TextDelta("🐋" * 3000), Usage(1, 1)])
        events = await collect(model)
        self.assertEqual("".join(v.get("text", "") for v in events), "🐋" * 3000)
        self.assertTrue(all(aftergame.units(v.get("text", "")) <= 4096 for v in events))
        self.assertEqual([v["sequence"] for v in events], list(range(len(events))))
        self.assertEqual(events[-1]["type"], "done")
        self.assertEqual(len(model.requests), 1)
        self.assertEqual(model.requests[0].tools, [])
        self.assertIn("当前内容引用", model.requests[0].messages[0].content)
        self.assertTrue(model.closed)

    async def test_tools_empty_reply_provider_error_and_overflow_do_not_succeed(self):
        cases = [
            ([ToolCallDone(0, "call", "write_file", {})], "protocol"),
            ([], "protocol"),
            ([TextDelta("字" * 16001)], "limit"),
            ([Error("auth", "PRIVATE PROVIDER ERROR")], "auth"),
            ([Error("rate_limit", "PRIVATE PROVIDER ERROR")], "quota"),
        ]
        for events, code in cases:
            with self.subTest(code=code):
                model = Model(events)
                result = await collect(model)
                self.assertEqual(result[-1]["type"], "error")
                self.assertEqual(result[-1]["code"], code)
                self.assertNotIn("PRIVATE", json.dumps(result))
                self.assertEqual(len(model.requests), 1)
                self.assertTrue(model.closed)

    async def test_whitespace_only_reply_is_not_success(self):
        result = await collect(Model([TextDelta(" \n\t")]))
        self.assertEqual(result[-1]["type"], "error")
        self.assertEqual(result[-1]["code"], "protocol")

    async def test_duplicate_request_and_concurrent_conversation_have_no_model_call(self):
        seen = {}
        await collect(Model([TextDelta("回复")]), seen=seen)
        model = Model([TextDelta("不应调用")])
        self.assertEqual((await collect(model, seen=seen))[-1]["code"], "context")
        self.assertEqual(model.requests, [])
        self.assertEqual((await collect(model, active={"test-conversation"}))[-1]["code"], "busy")
        self.assertEqual((await collect(model, active={str(i) for i in range(4)}))[-1]["code"], "busy")
        self.assertEqual(model.requests, [])

    async def test_cancelling_stream_closes_provider_and_releases_active_conversation(self):
        entered = asyncio.Event()
        closed = asyncio.Event()

        class Hanging(Model):
            async def stream(self, value):
                self.requests.append(value)
                try:
                    yield TextDelta("片段")
                    entered.set()
                    await asyncio.Event().wait()
                finally:
                    closed.set()

        active = set()
        value = request()
        stream = aftergame.turns(value, config("unused")["aftergame"]["characters"][0], Hanging([]), active, {})
        await anext(stream)
        waiting = asyncio.create_task(anext(stream))
        await entered.wait()
        waiting.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await waiting
        await stream.aclose()
        self.assertTrue(closed.is_set())
        self.assertEqual(active, set())


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.token = secrets.token_urlsafe(24)
        self.env = patch.dict(os.environ, {aftergame.TOKEN_NAME: self.token})
        self.env.start()
        self.app = aftergame.create_app(config(self.temp.name))
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://127.0.0.1:8766")
        self.headers = {"Origin": ORIGIN, "X-Haifeng-Chat-Token": self.token}

    async def asyncTearDown(self):
        await self.client.aclose()
        await self.lifespan.__aexit__(None, None, None)
        self.env.stop()
        self.temp.cleanup()

    async def test_info_and_post_use_real_scripted_plugin_with_no_private_fields(self):
        response = await self.client.get("/api/aftergame/info", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], ORIGIN)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.json()["characters"][0]["endingIds"], ["test-ending"])
        self.assertNotIn("persona", response.text)
        self.assertNotIn(self.token, response.text)
        response = await self.client.post("/api/aftergame/chat", headers=self.headers, json=request())
        self.assertEqual(response.status_code, 200)
        result = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual(result[-1]["type"], "done")
        self.assertEqual("".join(v.get("text", "") for v in result), "离线测试回复🐋")
        again = await self.client.post("/api/aftergame/chat", headers=self.headers, json=request())
        self.assertEqual(json.loads(again.text)["code"], "context")

    async def test_bad_token_error_is_readable_cross_origin_and_does_not_leak_token(self):
        response = await self.client.get("/api/aftergame/info", headers={"Origin": ORIGIN})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers.get("access-control-allow-origin"), ORIGIN)
        self.assertEqual(response.headers.get("cache-control"), "no-store")
        self.assertNotIn(self.token, response.text)

    async def test_host_and_origin_are_checked_independently_of_token(self):
        for headers in ({**self.headers, "Host": "attacker.invalid"}, {**self.headers, "Origin": "https://attacker.invalid"}):
            response = await self.client.get("/api/aftergame/info", headers=headers)
            self.assertEqual(response.status_code, 403)

    async def test_only_exact_preflight_origin_and_headers_are_allowed(self):
        response = await self.client.options("/api/aftergame/chat", headers={
            "Origin": ORIGIN, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-haifeng-chat-token",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], ORIGIN)
        self.assertNotIn("access-control-allow-credentials", response.headers)
        response = await self.client.options("/api/aftergame/chat", headers={
            "Origin": "null", "Access-Control-Request-Method": "POST",
        })
        self.assertNotEqual(response.status_code, 200)

    async def test_bad_body_unsupported_roles_and_oversize_body_are_bounded(self):
        response = await self.client.post("/api/aftergame/chat", headers=self.headers, content=b"{}")
        self.assertEqual(response.status_code, 415)
        headers = {**self.headers, "Content-Type": "application/json"}
        for body in (b'{"n":1,"n":2}', b"not-json"):
            response = await self.client.post("/api/aftergame/chat", headers=headers, content=body)
            self.assertEqual(response.status_code, 422)
        value = request()
        value["messages"][0]["role"] = "tool"
        response = await self.client.post("/api/aftergame/chat", headers=self.headers, json=value)
        self.assertEqual(response.status_code, 422)
        response = await self.client.post("/api/aftergame/chat", headers=headers, content=b" " * (aftergame.BODY_LIMIT + 1))
        self.assertEqual(response.status_code, 413)

    async def test_disabled_service_does_not_start_plugins_or_allow_chat(self):
        cfg = config(self.temp.name)
        cfg["aftergame"]["enabled"] = False
        with patch.object(aftergame.PluginManager, "start", side_effect=AssertionError("不得启动模型")):
            app = aftergame.create_app(cfg)
            async with app.router.lifespan_context(app):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost:8766") as client:
                    response = await client.get("/api/aftergame/info")
                    self.assertEqual(response.status_code, 503)

    async def test_transitive_tool_dependency_is_rejected_before_any_plugin_starts(self):
        def discover(manager):
            manager.states = {
                "model": SimpleNamespace(manifest=SimpleNamespace(kind="llm")),
                "hidden-tool": SimpleNamespace(manifest=SimpleNamespace(kind="tool")),
            }

        with (
            patch.object(aftergame.PluginManager, "discover", discover),
            patch.object(aftergame.PluginManager, "wanted", return_value=["model", "hidden-tool"]),
            patch.object(aftergame.PluginManager, "start", side_effect=AssertionError("不得启动工具")),
        ):
            app = aftergame.create_app(config(self.temp.name))
            with self.assertRaises(aftergame.Invalid):
                async with app.router.lifespan_context(app):
                    self.fail("不能进入启用状态")


if __name__ == "__main__":
    unittest.main()
