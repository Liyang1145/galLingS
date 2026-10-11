from __future__ import annotations

from typing import Any

import jsonschema

from server.plugins import ToolPlugin, ToolResult, ToolSpec

MOODS = ["calm", "happy", "annoyed", "flustered", "sad", "angry"]

SPECS = [
    ToolSpec("propose_affection", "提议好感变化。引擎会按单步限幅与章节预算裁剪，最终值以裁决为准。", {
        "type": "object", "additionalProperties": False, "required": ["delta", "reason"],
        "properties": {"delta": {"type": "integer", "minimum": -10, "maximum": 10},
                       "reason": {"type": "string", "maxLength": 120}}}, effect="propose"),
    ToolSpec("propose_mood", "提议心情切换，可附带立绘差分标签。", {
        "type": "object", "additionalProperties": False, "required": ["mood"],
        "properties": {"mood": {"enum": MOODS}, "sprite_tag": {"type": "string"}}}, effect="propose"),
]


class ProposalTools(ToolPlugin):
    async def list_tools(self) -> list[ToolSpec]:
        return list(SPECS)

    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        spec = next((s for s in SPECS if s.name == name), None)
        if spec is None:
            return ToolResult(False, error=f"未知工具 {name}")
        try:
            jsonschema.validate(arguments, spec.parameters)
        except jsonschema.ValidationError as e:
            return ToolResult(False, error=f"参数不合法：{e.message}")
        return ToolResult(True, content={"status": "pending_verdict"},
                          proposals=[{"type": name, **arguments, "turn": turn.get("turn")}])
