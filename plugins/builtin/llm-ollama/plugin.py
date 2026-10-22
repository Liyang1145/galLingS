"""Ollama 本地模型网关插件（免密钥，兼容 /v1/chat/completions SSE）。"""
from __future__ import annotations

import json
import time
from dataclasses import asdict
from typing import Any, AsyncIterator

import httpx

from server.plugins import ChatRequest, Error, LLMEvent, LLMPlugin, TextDelta, ToolCallDelta, ToolCallDone, Usage


def _message(m) -> dict[str, Any]:
    return {k: v for k, v in asdict(m).items() if v is not None}


class OllamaLLM(LLMPlugin):
    async def setup(self) -> None:
        c = self.ctx.config
        base = c["base_url"].rstrip("/")
        if not base.endswith("/v1"):
            base = base + "/v1"
        self._client = httpx.AsyncClient(
            base_url=base,
            timeout=httpx.Timeout(c["timeout_s"], connect=c["connect_timeout_s"]),
        )

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        c = self.ctx.config
        body: dict[str, Any] = {
            "model": c["model"],
            "stream": True,
            "messages": [_message(m) for m in request.messages],
            "temperature": request.temperature if request.temperature is not None else c["temperature"],
            **request.extra,
        }
        if request.tools:
            body["tools"] = request.tools
        if request.max_tokens:
            body["max_tokens"] = request.max_tokens
        if request.stop:
            body["stop"] = request.stop

        t0 = time.perf_counter()
        calls: dict[int, dict[str, Any]] = {}
        try:
            async with self._client.stream("POST", "/chat/completions", json=body) as resp:
                if resp.status_code != 200:
                    text = (await resp.aread()).decode("utf-8", "replace")[:200]
                    yield Error("unknown", f"HTTP {resp.status_code}: {text}", retryable=resp.status_code >= 500)
                    return
                async for raw in resp.aiter_lines():
                    line = raw.strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    for choice in chunk.get("choices") or []:
                        delta = choice.get("delta") or {}
                        if delta.get("content"):
                            yield TextDelta(delta["content"])
                        for tc in delta.get("tool_calls") or []:
                            idx = int(tc.get("index", 0))
                            slot = calls.setdefault(idx, {"id": None, "name": None, "args": ""})
                            fn = tc.get("function") or {}
                            slot["id"] = tc.get("id") or slot["id"]
                            slot["name"] = fn.get("name") or slot["name"]
                            slot["args"] += fn.get("arguments") or ""
                            yield ToolCallDelta(idx, tc.get("id"), fn.get("name"), fn.get("arguments") or "")
                for idx in sorted(calls):
                    slot = calls[idx]
                    try:
                        args = json.loads(slot["args"] or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    yield ToolCallDone(idx, slot["id"] or f"call_{idx}", slot["name"] or "", args if isinstance(args, dict) else {})
                yield Usage(0, 0, (time.perf_counter() - t0) * 1000)
        except httpx.TimeoutException as e:
            yield Error("timeout", str(e) or "请求超时", retryable=True)
        except httpx.HTTPError as e:
            yield Error("network", f"{type(e).__name__}: {e}", retryable=True)

    async def health(self) -> dict[str, Any]:
        return {"ok": True, "provider": "ollama", "base_url": self.ctx.config["base_url"], "model": self.ctx.config["model"]}

    async def close(self) -> None:
        client = getattr(self, "_client", None)
        if client is not None:
            await client.aclose()
            self._client = None
