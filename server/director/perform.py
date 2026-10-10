"""演绎层：同一份第一话剧本换一张卡来演（PLAN §6.2）。

- 原作卡（locked_script: true）：直接用锁定台词，不调模型。
- 其他卡：开局后按"选项点之间的段落"分批，让模型把女主台词和带角色专属物件的旁白改成新卡口吻，
  条数、顺序不变；节拍、好感、选项全都还是剧本的。结果按 (卡哈希, 剧本哈希) 缓存在本机。
- 模型失败的条目退回"槽位替换"版本（origin=fallback），演示不会卡住。
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Any

from . import prompts
from .llm import complete, parse_json

log = logging.getLogger("gallings.perform")

CHARACTER_SPECIFIC = re.compile(r"尾|鲸|鳍|鳞|深海|外婆")
BATCH = 24


def _slot_replace(text: str, chapter: dict[str, Any], card: dict[str, Any]) -> str:
    slots = card.get("slots") or {}
    for s in sorted(chapter.get("slots") or [], key=lambda x: -len(x["literal"])):
        v = slots.get(s["slot"])
        if v:
            text = text.replace(s["literal"], v)
    name = (card.get("identity") or {}).get("name")
    return text.replace("鲸鱼小姐", name) if name else text


class Performer:
    def __init__(self, chapter: dict[str, Any], card: dict[str, Any], card_hash: str, chain: list, cache_dir: Path) -> None:
        self.chapter = chapter
        self.card = card
        self.locked = bool(card.get("locked_script"))
        self.chain = chain
        self.cache_path = cache_dir / f"perform-{card_hash}-{chapter['content_hash']}.json"
        self.lines: dict[str, dict[str, str]] = {}  # src -> {text, origin}
        self.segments: list[list[dict[str, Any]]] = []
        self.futures: dict[str, asyncio.Future] = {}
        self._signals_by_meaning: dict[str, dict[str, Any]] = {}
        for s in card.get("honesty_signals") or []:
            self._signals_by_meaning.setdefault(s["meaning"], s)
        self._build_segments()

    def _eligible(self, op: dict[str, Any]) -> bool:
        if op.get("op") != "SAY":
            return False
        if op["speaker"] == "heroine":
            return True
        return op["speaker"] == "narrator" and (bool(op.get("slots")) or bool(CHARACTER_SPECIFIC.search(op["text"])))

    def _build_segments(self) -> None:
        if self.locked:
            return
        cur: list[dict[str, Any]] = []
        for op in self.chapter["program"]:
            if self._eligible(op):
                cur.append(op)
                if len(cur) >= BATCH:
                    self.segments.append(cur)
                    cur = []
            elif op.get("op") == "CHOICE" and cur:
                self.segments.append(cur)
                cur = []
        if cur:
            self.segments.append(cur)

    async def start(self) -> None:
        """后台开跑全部段落（并发），命中缓存则直接用。"""
        if self.locked:
            return
        if self.cache_path.is_file():
            self.lines = json.loads(self.cache_path.read_text(encoding="utf-8"))
            return
        loop = asyncio.get_running_loop()
        for seg in self.segments:
            fut = loop.create_task(self._run_segment(seg))
            for op in seg:
                self.futures[op["src"]] = fut
        asyncio.get_running_loop().create_task(self._save_when_done())

    async def _save_when_done(self) -> None:
        if self.futures:
            await asyncio.gather(*set(self.futures.values()), return_exceptions=True)
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self.lines, ensure_ascii=False), encoding="utf-8")

    def _maps(self) -> tuple[str, str]:
        slots = self.card.get("slots") or {}
        sm = "；".join(f"{s['literal']} → {slots.get(s['slot'], s['literal'])}" for s in self.chapter.get("slots") or [])
        sig = self._signals_by_meaning
        tm = "；".join(f"{m}: 尾鳍 → {s['body_part']}{s['action']}" for m, s in sig.items())
        return sm, tm

    async def _run_segment(self, seg: list[dict[str, Any]]) -> None:
        sm, tm = self._maps()
        items = [{"speaker": op["speaker"], "text": op["text"]} for op in seg]
        res = await complete(self.chain, prompts.perform_messages(self.card, sm, tm, items), json_mode=True,
                             temperature=0.7, timeout=60)
        out: list[str] = []
        if res.error is None:
            try:
                out = [str(x) for x in parse_json(res.text).get("lines", [])]
            except Exception as e:  # noqa: BLE001
                log.warning("演绎层 JSON 解析失败：%s", e)
        for i, op in enumerate(seg):
            if i < len(out) and out[i].strip():
                self.lines[op["src"]] = {"text": out[i].strip(), "origin": "performed"}
            else:
                self.lines[op["src"]] = {"text": _slot_replace(op["text"], self.chapter, self.card), "origin": "fallback"}

    async def render(self, op: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
        """返回 (要上屏的 op, 需要记录的 perform 事件 payload 或 None)。"""
        k = op.get("op")
        if self.locked or "src" not in op:  # 原作卡，或 AI 即兴 / 降级产生的 op：不经演绎层
            return op, None
        if k == "SAY" and self._eligible(op):
            src = op["src"]
            if src not in self.lines and src in self.futures:
                try:
                    await asyncio.wait_for(asyncio.shield(self.futures[src]), timeout=45)
                except Exception:  # noqa: BLE001
                    pass
            got = self.lines.get(src) or {"text": _slot_replace(op["text"], self.chapter, self.card), "origin": "fallback"}
            new = {**op, "text": got["text"], "origin": got["origin"]}
            new.pop("hash", None)
            return new, {"src": src, "origin": got["origin"], "text": got["text"]}
        if k == "SAY":
            return {**op, "text": _slot_replace(op["text"], self.chapter, self.card)}, None
        if k == "TAIL" and op.get("source") == "script":
            meaning = op.get("signal_id")  # 剧本里 signal_id 就是 heart/angry/panic
            s = self._signals_by_meaning.get(meaning) or next(iter(self._signals_by_meaning.values()))
            return {**op, "signal_id": s["id"], "desc": f"{s['body_part']}{s['action']}"}, None
        if k == "SPRITE" and op.get("expr"):
            sprites = (self.card.get("assets") or {}).get("sprites") or ["默认"]
            if op["expr"] not in sprites:
                pick = next((x for x in sprites if x in op["expr"] or op["expr"].startswith(x[:2])), "默认")
                return {**op, "expr": pick}, None
        return op, None
