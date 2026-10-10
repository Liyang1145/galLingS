"""OpenAI 风格 SSE 流 → 五种内部事件的纯函数解析器（无 IO，便于用录制数据测试）。"""
from __future__ import annotations

import json
from typing import Any, Iterable, Iterator

from server.plugins import Error, LLMEvent, TextDelta, ToolCallDelta, ToolCallDone, Usage


class StreamNormalizer:
    def __init__(self) -> None:
        self._calls: dict[int, dict[str, Any]] = {}
        self._done = False

    def feed_line(self, line: str) -> Iterator[LLMEvent]:
        line = line.strip()
        if not line.startswith("data:"):
            return
        data = line[5:].strip()
        if data == "[DONE]":
            yield from self.finish()
            return
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError:
            yield Error("bad_response", f"无法解析的流片段：{data[:80]}")
            return
        if "error" in chunk:
            yield Error("unknown", str(chunk["error"])[:200])
            return
        for choice in chunk.get("choices") or []:
            delta = choice.get("delta") or {}
            if delta.get("content"):
                yield TextDelta(delta["content"])
            for tc in delta.get("tool_calls") or []:
                idx = int(tc.get("index", 0))
                slot = self._calls.setdefault(idx, {"id": None, "name": None, "args": ""})
                fn = tc.get("function") or {}
                slot["id"] = tc.get("id") or slot["id"]
                slot["name"] = fn.get("name") or slot["name"]
                slot["args"] += fn.get("arguments") or ""
                yield ToolCallDelta(idx, tc.get("id"), fn.get("name"), fn.get("arguments") or "")
            if choice.get("finish_reason"):
                yield from self._flush_calls()
        u = chunk.get("usage")
        if u:
            yield Usage(int(u.get("prompt_tokens", 0)), int(u.get("completion_tokens", 0)))

    def _flush_calls(self) -> Iterator[LLMEvent]:
        for idx in sorted(self._calls):
            slot = self._calls[idx]
            try:
                args = json.loads(slot["args"] or "{}")
                if not isinstance(args, dict):
                    raise ValueError("arguments 不是对象")
            except (json.JSONDecodeError, ValueError) as e:
                yield Error("bad_response", f"工具 {slot['name']} 参数不是合法 JSON 对象：{e}")
                continue
            yield ToolCallDone(idx, slot["id"] or f"call_{idx}", slot["name"] or "", args)
        self._calls.clear()

    def finish(self) -> Iterator[LLMEvent]:
        if not self._done:
            self._done = True
            yield from self._flush_calls()


def normalize(lines: Iterable[str]) -> list[LLMEvent]:
    n = StreamNormalizer()
    out: list[LLMEvent] = []
    for ln in lines:
        out.extend(n.feed_line(ln))
    out.extend(n.finish())
    return out
