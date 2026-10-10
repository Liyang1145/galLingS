from __future__ import annotations

import json
from typing import AsyncIterator

from server.plugins import ChatRequest, LLMEvent, LLMPlugin, TextDelta, ToolCallDelta, ToolCallDone, Usage


class ScriptedLLM(LLMPlugin):
    async def setup(self) -> None:
        self.responses = self.ctx.config.get("responses") or [{"text": "……"}]
        self.chunk = int(self.ctx.config.get("chunk_chars", 8))
        self.calls = 0

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        r = self.responses[self.calls % len(self.responses)]
        self.calls += 1
        text = r.get("text", "")
        for i in range(0, len(text), self.chunk):
            yield TextDelta(text[i:i + self.chunk])
        for i, tc in enumerate(r.get("tool_calls") or []):
            cid = f"call_{self.calls}_{i}"
            args = json.dumps(tc["arguments"], ensure_ascii=False)
            yield ToolCallDelta(i, cid, tc["name"], args)
            yield ToolCallDone(i, cid, tc["name"], dict(tc["arguments"]))
        prompt = sum(len(m.content) for m in request.messages)
        yield Usage(prompt_tokens=prompt, completion_tokens=len(text), latency_ms=0.0)
