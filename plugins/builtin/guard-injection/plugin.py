from __future__ import annotations

import re
from typing import Any

from server.guard import lexicon
from server.plugins import GuardPlugin, GuardVerdict

# 默认模式与内置文本守卫共用 server/guard/lexicon.py（归一化：全半角、零宽字符、字间空格 / 分隔符）；
# 这里保留旧版模式作为最小集合，配置里的 extra_patterns 追加在后面（同样在归一化文本上匹配）。
DEFAULT_PATTERNS = [
    r"忽略(以上|上面|之前|前面)(的)?(所有)?(指令|设定|规则|内容)",
    r"(无视|忘记|忘掉)(你的)?(设定|规则|系统提示|人设)",
    r"ignore(all)?(the)?(previous|above)(instructions|prompts?)",
    r"(systemprompt|系统提示词)",
]


class InjectionGuard(GuardPlugin):
    stages = ("input",)

    async def setup(self) -> None:
        pats = DEFAULT_PATTERNS + list(self.ctx.config.get("extra_patterns") or [])
        self._res = [re.compile(p, re.IGNORECASE) for p in pats]

    async def check(self, stage: str, text: str, turn: dict[str, Any]) -> GuardVerdict:
        if stage != "input":
            return GuardVerdict(True)
        hit = lexicon.injection_hit(text, extra=self._res)
        if hit:
            return GuardVerdict(False, rule="prompt_injection", reason=f"命中 {hit}")
        return GuardVerdict(True)
