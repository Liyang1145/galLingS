"""Google Gemini (v1beta streamGenerateContent) 原生 SSE 流式模型插件。"""
from __future__ import annotations

import json
import time
from typing import Any, AsyncIterator

import httpx

from server.plugins import ChatMessage, ChatRequest, Error, LLMEvent, LLMPlugin, TextDelta, ToolCallDelta, ToolCallDone, Usage


def _convert_messages(messages: list[ChatMessage]) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    sys_parts: list[str] = []
    contents: list[dict[str, Any]] = []
    for m in messages:
        if m.role == "system":
            if m.content:
                sys_parts.append(m.content)
        elif m.role == "user":
            contents.append({"role": "user", "parts": [{"text": m.content or ""}]})
        elif m.role == "assistant":
            parts: list[dict[str, Any]] = []
            if m.content:
                parts.append({"text": m.content})
            for tc in m.tool_calls or []:
                fn = tc.get("function") or {}
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                parts.append({"functionCall": {"name": fn.get("name") or "", "args": args}})
            contents.append({"role": "model", "parts": parts or [{"text": ""}]})
        elif m.role == "tool":
            try:
                resp_obj = json.loads(m.content or "{}")
                if not isinstance(resp_obj, dict):
                    resp_obj = {"result": resp_obj}
            except json.JSONDecodeError:
                resp_obj = {"result": m.content or ""}
            contents.append({
                "role": "user",
                "parts": [{"functionResponse": {"name": m.name or "tool", "response": resp_obj}}],
            })
    sys_inst = {"parts": [{"text": "\n\n".join(sys_parts)}]} if sys_parts else None
    return sys_inst, contents


def _convert_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    decls: list[dict[str, Any]] = []
    for t in tools or []:
        fn = t.get("function") or t
        if not fn.get("name"):
            continue
        params = dict(fn.get("parameters") or {"type": "object", "properties": {}})
        params.pop("additionalProperties", None)
        decls.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "parameters": params,
        })
    return [{"functionDeclarations": decls}] if decls else []


class GeminiLLM(LLMPlugin):
    async def setup(self) -> None:
        c = self.ctx.config
        self._key = self.ctx.secrets.require("api_key")
        base = c["base_url"].rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=base,
            timeout=httpx.Timeout(c["timeout_s"], connect=c["connect_timeout_s"]),
            headers={"x-goog-api-key": self._key, "content-type": "application/json"},
        )

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        c = self.ctx.config
        sys_inst, contents = _convert_messages(request.messages)
        gen_cfg: dict[str, Any] = {
            "temperature": request.temperature if request.temperature is not None else c["temperature"],
        }
        if request.max_tokens:
            gen_cfg["maxOutputTokens"] = request.max_tokens
        if request.stop:
            gen_cfg["stopSequences"] = request.stop

        body: dict[str, Any] = {
            "contents": contents or [{"role": "user", "parts": [{"text": "你好"}]}],
            "generationConfig": gen_cfg,
        }
        if sys_inst:
            body["systemInstruction"] = sys_inst
        if request.tools:
            gtools = _convert_tools(request.tools)
            if gtools:
                body["tools"] = gtools

        model_name = c["model"].removeprefix("models/")
        path = f"/v1beta/models/{model_name}:streamGenerateContent?alt=sse"
        t0 = time.perf_counter()
        call_idx = 0
        prompt_tok = 0
        comp_tok = 0

        try:
            async with self._client.stream("POST", path, json=body) as resp:
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
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    if "error" in chunk:
                        yield Error("unknown", str(chunk["error"])[:200])
                        return
                    for cand in chunk.get("candidates") or []:
                        for part in (cand.get("content") or {}).get("parts") or []:
                            if "text" in part and part["text"]:
                                if part.get("thought"):
                                    yield TextDelta(f"<think>{part['text']}</think>")
                                else:
                                    yield TextDelta(part["text"])
                            if "functionCall" in part:
                                fc = part["functionCall"] or {}
                                fname = fc.get("name") or ""
                                fargs = fc.get("args") if isinstance(fc.get("args"), dict) else {}
                                cid = f"call_{call_idx}"
                                raw_args = json.dumps(fargs, ensure_ascii=False)
                                yield ToolCallDelta(call_idx, cid, fname, raw_args)
                                yield ToolCallDone(call_idx, cid, fname, fargs)
                                call_idx += 1
                    um = chunk.get("usageMetadata") or {}
                    if um:
                        prompt_tok = int(um.get("promptTokenCount", prompt_tok))
                        comp_tok = int(um.get("candidatesTokenCount", comp_tok))
                yield Usage(prompt_tok, comp_tok, (time.perf_counter() - t0) * 1000)
        except httpx.TimeoutException as e:
            yield Error("timeout", str(e) or "请求超时", retryable=True)
        except httpx.HTTPError as e:
            yield Error("network", f"{type(e).__name__}: {e}", retryable=True)

    async def health(self) -> dict[str, Any]:
        return {"ok": True, "provider": "gemini", "base_url": self.ctx.config["base_url"], "model": self.ctx.config["model"]}

    async def close(self) -> None:
        client = getattr(self, "_client", None)
        if client is not None:
            await client.aclose()
            self._client = None
