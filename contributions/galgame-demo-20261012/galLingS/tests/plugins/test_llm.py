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
