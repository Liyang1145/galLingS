"""评测用假模型与请求旁听。

- ``FakeBrain``：挂到内置脚本化模型插件（gallings.llm.scripted）实例上，按请求类型（意图分类 / AI 回合 /
  单句重写 / 演绎层 / 日记）从每条样本预先写好的队列里出输出。不联网、不花钱。
- ``Tap``：真模型（config）模式下包住真实插件的 ``stream``，只旁听请求，不改输出。

两者都把请求按类型记下来，跑分器据此检查提示词里有没有节拍目的、落点、最后一轮指令、严肃模板等。
"""
from __future__ import annotations

import json
import re
from collections import deque
from typing import Any, AsyncIterator, Callable

from server.director import prompts
from server.plugins import ChatRequest, TextDelta, ToolCallDelta, ToolCallDone, Usage

FAKE_VERSION = "eval-fake-0.1.0"
DEFAULT_INTENT = {"intent": "剧本外", "matched_option": "", "confidence": 0.1}
_ITEM = re.compile(r"^(\d+)\. \[(角色台词|旁白)\] (.*)$")


def kind_of(req: ChatRequest) -> str:
    sys0 = req.messages[0].content if req.messages else ""
    last = req.messages[-1].content if req.messages else ""
    if sys0.startswith(prompts.INTENT[:16]):
        return "intent"
    if sys0.startswith(prompts.PERFORM[:16]):
        return "perform"
    if sys0.startswith(prompts.CARD_FILL[:16]):
        return "card_fill"
    if "写一篇很短的日记" in sys0:
        return "diary"
    if req.messages[-1].role == "user" and last.startswith("你上一句台词"):
        return "rewrite"
    return "turn"


def perform_items(req: ChatRequest) -> list[tuple[str, str]]:
    out = []
    for line in req.messages[-1].content.splitlines():
        m = _ITEM.match(line.strip())
        if m:
            out.append(("heroine" if m.group(2) == "角色台词" else "narrator", m.group(3)))
    return out


class FakeBrain:
    """一条样本一个。队列空了就给保守的默认输出。"""

    def __init__(self) -> None:
        self.intents: deque[dict[str, Any]] = deque()
        self.turns: deque[list[tuple[str, dict[str, Any]]]] = deque()
        self.rewrites: deque[str] = deque()
        self.performer: Callable[[list[tuple[str, str]]], list[str]] | None = None
        self.diary_text = "今天浅滩来了个可疑人类。……酸梅汤要加桂花。"
        self.requests: list[tuple[str, ChatRequest]] = []
        self.calls = 0

    async def stream(self, req: ChatRequest) -> AsyncIterator[Any]:
        k = kind_of(req)
        self.requests.append((k, req))
        self.calls += 1
        text, calls = "", []
        if k == "intent":
            text = json.dumps(self.intents.popleft() if self.intents else DEFAULT_INTENT, ensure_ascii=False)
        elif k == "turn":
            calls = self.turns.popleft() if self.turns else [("say", {"text": "……"})]
        elif k == "rewrite":
            if self.rewrites:
                calls = [("say", {"text": self.rewrites.popleft()})]
        elif k == "perform":
            items = perform_items(req)
            lines = self.performer(items) if self.performer else [t for _, t in items]
            text = json.dumps({"lines": lines}, ensure_ascii=False)
        elif k == "diary":
            text = self.diary_text
        else:
            text = "{}"
        for i in range(0, len(text), 16):
            yield TextDelta(text[i:i + 16])
        for i, (name, args) in enumerate(calls):
            cid = f"fake_{self.calls}_{i}"
            yield ToolCallDelta(i, cid, name, json.dumps(args, ensure_ascii=False))
            yield ToolCallDone(i, cid, name, dict(args))
        yield Usage(prompt_tokens=sum(len(m.content) for m in req.messages), completion_tokens=len(text), latency_ms=0.0)


class Tap:
    """包住真实模型插件：旁听请求，原样转发输出。"""

    def __init__(self, plugin: Any) -> None:
        self.plugin = plugin
        self.orig = plugin.stream
        self.requests: list[tuple[str, ChatRequest]] = []
        plugin.stream = self.stream

    async def stream(self, req: ChatRequest) -> AsyncIterator[Any]:
        self.requests.append((kind_of(req), req))
        async for ev in self.orig(req):
            yield ev


def install_fake(rt: Any, brain: FakeBrain) -> None:
    chain = rt.llm_chain()
    if not chain:
        raise RuntimeError("scripted 模式没有可用的 llm 插件（gallings.llm.scripted 未启用）")
    for p in chain:
        p.stream = brain.stream  # 实例属性覆盖：插件本身不改
