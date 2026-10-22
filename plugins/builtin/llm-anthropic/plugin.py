"""Anthropic Claude (/v1/messages) 原生 SSE 流式模型插件。"""
from __future__ import annotations

import json
import time
from typing import Any, AsyncIterator

import httpx

from server.plugins import ChatMessage, ChatRequest, Error, LLMEvent, LLMPlugin, TextDelta, ToolCallDelta, ToolCallDone, Usage


def _convert_messages(messages: list[ChatMessage]) -> tuple[str, list[dict[str, Any]]]:
    sys_parts: list[str] = []
    out: list[dict[str, Any]] = []
    for m in messages:
        if m.role == "system":
            if m.content:
                sys_parts.append(m.content)
        elif m.role == "user":
            out.append({"role": "user", "content": m.content or ""})
        elif m.role == "assistant":
            blocks: list[dict[str, Any]] = []
            if m.content:
                blocks.append({"type": "text", "text": m.content})
            for tc in m.tool_calls or []:
                fn = tc.get("function") or {}
                try:
                    inp = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    inp = {}
                blocks.append({
                    "type": "tool_use",
                    "id": tc.get("id") or "call_0",
                    "name": fn.get("name") or "",
                    "input": inp,
                })
            out.append({"role": "assistant", "content": blocks or [{"type": "text", "text": ""}]})
        elif m.role == "tool":
            block = {
                "type": "tool_result",
                "tool_use_id": m.tool_call_id or "call_0",
                "content": m.content or "",
            }
            if out and out[-1]["role"] == "user" and isinstance(out[-1]["content"], list):
                out[-1]["content"].append(block)
            else:
                out.append({"role": "user", "content": [block]})
    return "\n\n".join(sys_parts), out


def _convert_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for t in tools or []:
        fn = t.get("function") or t
        if not fn.get("name"):
            continue
        out.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
        })
    return out


class AnthropicLLM(LLMPlugin):
    async def setup(self) -> None:
        c = self.ctx.config
        self._key = self.ctx.secrets.require("api_key")
        base = c["base_url"].rstrip("/")
        if base.endswith("/v1"):
            base = base[:-3]
        self._client = httpx.AsyncClient(
            base_url=base,
            timeout=httpx.Timeout(c["timeout_s"], connect=c["connect_timeout_s"]),
            headers={
                "x-api-key": self._key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        c = self.ctx.config
        sys_text, msgs = _convert_messages(request.messages)
        body: dict[str, Any] = {
            "model": c["model"],
            "stream": True,
            "max_tokens": request.max_tokens or c.get("max_tokens", 2048),
            "messages": msgs or [{"role": "user", "content": "你好"}],
            "temperature": min(1.0, request.temperature if request.temperature is not None else c["temperature"]),
        }
        if sys_text:
            body["system"] = sys_text
        if request.tools:
            body["tools"] = _convert_tools(request.tools)
        if request.stop:
            body["stop_sequences"] = request.stop

        t0 = time.perf_counter()
        in_tok = 0
        out_tok = 0
        tool_slots: dict[int, dict[str, Any]] = {}
        in_think: set[int] = set()

        try:
            async with self._client.stream("POST", "/v1/messages", json=body) as resp:
                if resp.status_code != 200:
                    text = (await resp.aread()).decode("utf-8", "replace")[:200]
                    code = {401: "auth", 403: "auth", 429: "rate_limit"}.get(resp.status_code, "unknown")
                    yield Error(code, f"HTTP {resp.status_code}: {text}", retryable=resp.status_code in (429, 500, 502, 503))
                    return
                async for raw in resp.aiter_lines():
                    line = raw.strip()
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        ev = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    etype = ev.get("type")
                    if etype == "error":
                        err = ev.get("error") or {}
                        yield Error("unknown", str(err.get("message") or err)[:200])
                        return
                    elif etype == "message_start":
                        u = (ev.get("message") or {}).get("usage") or {}
                        in_tok = int(u.get("input_tokens", in_tok))
                        out_tok = int(u.get("output_tokens", out_tok))
                    elif etype == "content_block_start":
                        idx = int(ev.get("index", 0))
                        cb = ev.get("content_block") or {}
                        if cb.get("type") == "tool_use":
                            tool_slots[idx] = {"id": cb.get("id") or f"call_{idx}", "name": cb.get("name") or "", "args": ""}
                            yield ToolCallDelta(idx, cb.get("id"), cb.get("name"), "")
                        elif cb.get("type") == "thinking":
                            in_think.add(idx)
                            yield TextDelta("<think>")
                    elif etype == "content_block_delta":
                        idx = int(ev.get("index", 0))
                        delta = ev.get("delta") or {}
                        dtype = delta.get("type")
                        if dtype == "text_delta" and delta.get("text"):
                            yield TextDelta(delta["text"])
                        elif dtype == "thinking_delta" and delta.get("thinking"):
                            yield TextDelta(delta["thinking"])
                        elif dtype == "input_json_delta" and idx in tool_slots:
                            part = delta.get("partial_json") or ""
                            tool_slots[idx]["args"] += part
                            yield ToolCallDelta(idx, None, None, part)
                    elif etype == "content_block_stop":
                        idx = int(ev.get("index", 0))
                        if idx in in_think:
                            in_think.discard(idx)
                            yield TextDelta("</think>")
                        if idx in tool_slots:
                            slot = tool_slots.pop(idx)
                            try:
                                args = json.loads(slot["args"] or "{}")
                                if not isinstance(args, dict):
                                    args = {}
                            except json.JSONDecodeError as e:
                                yield Error("bad_response", f"工具 {slot['name']} 参数不是合法 JSON：{e}")
                                continue
                            yield ToolCallDone(idx, slot["id"], slot["name"], args)
                    elif etype == "message_delta":
                        u = ev.get("usage") or {}
                        out_tok = int(u.get("output_tokens", out_tok))
                yield Usage(in_tok, out_tok, (time.perf_counter() - t0) * 1000)
        except httpx.TimeoutException as e:
            yield Error("timeout", str(e) or "请求超时", retryable=True)
        except httpx.HTTPError as e:
            yield Error("network", f"{type(e).__name__}: {e}", retryable=True)

    async def health(self) -> dict[str, Any]:
        return {"ok": True, "provider": "anthropic", "base_url": self.ctx.config["base_url"], "model": self.ctx.config["model"]}

    async def close(self) -> None:
        client = getattr(self, "_client", None)
        if client is not None:
            await client.aclose()
            self._client = None
