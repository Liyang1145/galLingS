from __future__ import annotations

import json

from server.plugins import Error, TextDelta, ToolCallDelta, ToolCallDone, Usage
from server.plugins.loader import load_class
from server.plugins.manifest import load_manifest

from .conftest import BUILTIN


def sse_module():
    m = load_manifest(BUILTIN / "llm-openai-compat")
    load_class(m)  # 以插件包方式导入，sse 子模块随之可用
    import sys
    return sys.modules[[n for n in sys.modules if n.endswith("gallings_llm_openai_compat.sse")][0]]


def d(obj):
    return "data: " + json.dumps(obj, ensure_ascii=False)


def test_sse_text_toolcall_usage():
    sse = sse_module()
    lines = [
        ": keep-alive",
        d({"choices": [{"delta": {"content": "哼，"}}]}),
        d({"choices": [{"delta": {"content": "你还没走啊。"}}]}),
        d({"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "c1", "function": {"name": "propose_affection", "arguments": "{\"delta\": "}}]}}]}),
        d({"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "2, \"reason\": \"夸\"}"}}]}}]}),
        d({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}),
        d({"choices": [], "usage": {"prompt_tokens": 100, "completion_tokens": 12}}),
        "data: [DONE]",
    ]
    evs = sse.normalize(lines)
    assert "".join(e.text for e in evs if isinstance(e, TextDelta)) == "哼，你还没走啊。"
    assert sum(isinstance(e, ToolCallDelta) for e in evs) == 2
    done = [e for e in evs if isinstance(e, ToolCallDone)]
    assert done == [ToolCallDone(0, "c1", "propose_affection", {"delta": 2, "reason": "夸"})]
    assert [e for e in evs if isinstance(e, Usage)] == [Usage(100, 12)]


def test_sse_bad_arguments_and_garbage():
    sse = sse_module()
    evs = sse.normalize([
        "data: {not json",
        d({"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "x", "function": {"name": "f", "arguments": "{bad"}}]}}]}),
        "data: [DONE]",
    ])
    errs = [e for e in evs if isinstance(e, Error)]
    assert len(errs) == 2 and all(e.code == "bad_response" for e in errs)
    assert not any(isinstance(e, ToolCallDone) for e in evs)


def _plugin_body(base_url, thinking="auto"):
    """跑一次 stream，抓发给服务端的请求体。"""
    import asyncio
    import httpx
    from server.plugins.kinds import ChatMessage as Message, ChatRequest
    m = load_manifest(BUILTIN / "llm-openai-compat")
    cls = load_class(m)
    seen = {}

    def handler(req):
        seen.update(json.loads(req.content))
        return httpx.Response(200, text='data: {"choices":[{"delta":{"content":"在呢"}}]}\n\ndata: [DONE]\n\n')

    p = cls.__new__(cls)
    p.ctx = type("C", (), {"config": {"base_url": base_url, "model": "m", "temperature": 0.8, "thinking": thinking}})()
    p._client = httpx.AsyncClient(base_url=base_url, transport=httpx.MockTransport(handler))

    async def go():
        return [e async for e in p.stream(ChatRequest(messages=[Message(role="user", content="hi")], max_tokens=10))]
    asyncio.run(go())
    return seen


def test_deepseek_thinking_off_by_default():
    # deepseek-flash 默认开思考：短回复（max_tokens=10）会被思考吃光、正文为空，所以 DeepSeek 默认关掉
    assert _plugin_body("https://api.deepseek.com")["thinking"] == {"type": "disabled"}
    assert "thinking" not in _plugin_body("https://api.openai.com/v1")
    assert _plugin_body("https://api.deepseek.com", "enabled")["thinking"] == {"type": "enabled"}
