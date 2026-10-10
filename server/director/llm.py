"""模型调用小工具：走插件管理器的 llm 降级链（PLAN §12），把五种内部事件收成结果。"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from server.plugins import ChatMessage, ChatRequest, Error, LLMPlugin, TextDelta, ToolCallDone, Usage


@dataclass
class LLMResult:
    text: str = ""
    tool_calls: list[ToolCallDone] = field(default_factory=list)
    usage: Usage | None = None
    error: Error | None = None
    plugin: str = ""


def to_messages(raw: list[dict[str, Any]]) -> list[ChatMessage]:
    return [ChatMessage(m["role"], m["content"]) for m in raw]


async def stream_events(chain: list[LLMPlugin], req: ChatRequest, first_token_timeout: float, total_timeout: float
                        ) -> AsyncIterator[tuple[str, Any]]:
    """依次试降级链；产出 ("event", ev)，最后是 ("done", plugin_id) 或 ("error", Error)。"""
    last_err: Error | None = None
    for plug in chain:
        got_any = False
        this_err: Error | None = None
        try:
            agen = plug.stream(req).__aiter__()
            loop = asyncio.get_running_loop()
            deadline = loop.time() + total_timeout
            while True:
                timeout = first_token_timeout if not got_any else max(0.1, deadline - loop.time())
                try:
                    ev = await asyncio.wait_for(agen.__anext__(), timeout=timeout)
                except StopAsyncIteration:
                    break
                if isinstance(ev, Error):
                    last_err = this_err = ev
                    break
                got_any = True
                yield ("event", ev)
            if this_err is None or got_any:
                yield ("done", plug.ctx.plugin_id)
                return
        except asyncio.TimeoutError:
            last_err = Error("timeout", f"{plug.ctx.plugin_id} 超时", retryable=True)
            if got_any:
                yield ("error", last_err)
                return
        except Exception as e:  # noqa: BLE001 - 插件异常也算失败，换下一个
            last_err = Error("unknown", f"{type(e).__name__}: {e}")
            if got_any:
                yield ("error", last_err)
                return
    yield ("error", last_err or Error("unknown", "没有可用的模型插件"))


async def complete(chain: list[LLMPlugin], messages: list[dict[str, Any]], *, tools: list[dict[str, Any]] | None = None,
                   temperature: float | None = None, json_mode: bool = False, timeout: float = 30.0,
                   max_tokens: int | None = None) -> LLMResult:
    extra = {"response_format": {"type": "json_object"}} if json_mode else {}
    req = ChatRequest(to_messages(messages), tools=tools or [], temperature=temperature, max_tokens=max_tokens, extra=extra)
    out = LLMResult()
    async for kind, ev in stream_events(chain, req, first_token_timeout=min(timeout, 15.0), total_timeout=timeout):
        if kind == "event":
            if isinstance(ev, TextDelta):
                out.text += ev.text
            elif isinstance(ev, ToolCallDone):
                out.tool_calls.append(ev)
            elif isinstance(ev, Usage):
                out.usage = ev
        elif kind == "done":
            out.plugin = ev
        else:
            out.error = ev
    return out


def parse_json(text: str) -> Any:
    m = re.search(r"\{.*\}", text.strip(), re.S)
    if not m:
        raise ValueError("模型没有输出 JSON")
    return json.loads(m.group(0))
