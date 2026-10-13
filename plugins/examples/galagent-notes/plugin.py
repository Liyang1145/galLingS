"""示例扩展：备忘本。effect=read 的工具默认直接执行；effect=perform 默认先问玩家（可在 galagent 的 confirm 里改）。"""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

from server.plugins import ToolPlugin, ToolResult, ToolSpec

SPECS = [
    ToolSpec("add_note", "帮玩家记一条备忘（比如约定、待办、喜欢的东西）。", {
        "type": "object", "additionalProperties": False, "required": ["text"],
        "properties": {"text": {"type": "string", "maxLength": 500},
                       "tag": {"type": "string", "description": "分类，可空"}}}, effect="perform"),
    ToolSpec("list_notes", "查看记过的备忘，可按关键词筛选。", {
        "type": "object", "additionalProperties": False,
        "properties": {"keyword": {"type": "string"}}}, effect="read"),
]


class NotesTools(ToolPlugin):
    async def setup(self) -> None:
        self.file = self.ctx.data_dir / "notes.json"

    def _load(self) -> list[dict[str, Any]]:
        return json.loads(self.file.read_text(encoding="utf-8")) if self.file.exists() else []

    async def list_tools(self) -> list[ToolSpec]:
        return list(SPECS)

    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        notes = self._load()
        if name == "add_note":
            notes.append({"text": arguments["text"], "tag": arguments.get("tag", ""),
                          "at": dt.datetime.now().isoformat(timespec="minutes")})
            notes = notes[-int(self.ctx.config["max_notes"]):]
            self.file.write_text(json.dumps(notes, ensure_ascii=False, indent=1), encoding="utf-8")
            return ToolResult(True, content={"saved": True, "count": len(notes)})
        if name == "list_notes":
            kw = arguments.get("keyword", "")
            hits = [n for n in notes if kw in n["text"] or kw in n.get("tag", "")]
            return ToolResult(True, content={"notes": hits[-50:], "total": len(hits)})
        return ToolResult(False, error=f"未知工具 {name}")
