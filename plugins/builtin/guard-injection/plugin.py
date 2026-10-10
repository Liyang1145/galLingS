from __future__ import annotations

import re
from typing import Any

from server.plugins import GuardPlugin, GuardVerdict

DEFAULT_PATTERNS = [
    r"忽略(以上|上面|之前|前面)(的)?(所有)?(指令|设定|规则|内容)",
    r"(无视|忘记|忘掉)(你的)?(设定|规则|系统提示|人设)",
    r"ignore (all )?(the )?(previous|above) (instructions|prompts?)",
    r"(system prompt|系统提示词)",
]


class InjectionGuard(GuardPlugin):
    stages = ("input",)

    async def setup(self) -> None:
        pats = DEFAULT_PATTERNS + list(self.ctx.config.get("extra_patterns") or [])
        self._res = [re.compile(p, re.IGNORECASE) for p in pats]

    async def check(self, stage: str, text: str, turn: dict[str, Any]) -> GuardVerdict:
        if stage != "input":
            return GuardVerdict(True)
        for r in self._res:
            if r.search(text):
                return GuardVerdict(False, rule="prompt_injection", reason=f"命中 {r.pattern}")
        return GuardVerdict(True)
