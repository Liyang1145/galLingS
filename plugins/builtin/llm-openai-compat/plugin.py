from __future__ import annotations

import time
from dataclasses import asdict
from typing import Any, AsyncIterator

import httpx

from server.plugins import ChatRequest, Error, LLMEvent, LLMPlugin, Usage

from .sse import StreamNormalizer, http_status_error


def _message(m) -> dict[str, Any]:
    d = {k: v for k, v in asdict(m).items() if v is not None}
    return d


class OpenAICompatLLM(LLMPlugin):
    async def setup(self) -> None:
        c = self.ctx.config
        self._key = self.ctx.secrets.require("api_key")
        self._client = httpx.AsyncClient(
            base_url=c["base_url"].rstrip("/"),
            timeout=httpx.Timeout(c["timeout_s"], connect=c["connect_timeout_s"]),
            headers={"Authorization": f"Bearer {self._key}"})

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        c = self.ctx.config
        body: dict[str, Any] = {
            "model": c["model"], "stream": True, "stream_options": {"include_usage": True},
            "messages": [_message(m) for m in request.messages],
            "temperature": request.temperature if request.temperature is not None else c["temperature"],
            **request.extra,
        }
        th = c.get("thinking", "auto")
        if th == "auto":
            th = "disabled" if "deepseek" in c["base_url"].lower() else ""
        if th and "thinking" not in body:
            body["thinking"] = {"type": th}
        if request.tools:
            body["tools"] = request.tools
        if request.max_tokens:
            body["max_tokens"] = request.max_tokens
        if request.stop:
            body["stop"] = request.stop
        t0 = time.perf_counter()
        norm = StreamNormalizer()
        try:
            async with self._client.stream("POST", "/chat/completions", json=body) as resp:
                if resp.status_code != 200:
                    yield await http_status_error(resp)
                    return
                async for line in resp.aiter_lines():
                    for ev in norm.feed_line(line):
                        if isinstance(ev, Usage):
                            ev = Usage(ev.prompt_tokens, ev.completion_tokens, (time.perf_counter() - t0) * 1000)
                        yield ev
                for ev in norm.finish():
                    yield ev
        except httpx.TimeoutException as e:
            yield Error("timeout", str(e) or "请求超时", retryable=True)
        except httpx.HTTPError as e:
            yield Error("network", f"{type(e).__name__}: {e}", retryable=True)

    async def health(self) -> dict[str, Any]:
        return {"ok": True, "base_url": self.ctx.config["base_url"], "model": self.ctx.config["model"]}

    async def close(self) -> None:
        client = getattr(self, "_client", None)
        if client is not None:
            await client.aclose()
            self._client = None
