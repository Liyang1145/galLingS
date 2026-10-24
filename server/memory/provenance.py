"""记忆来源标签（整合方案 W1 / W3）：谁说的、算不算发生过。

一条记忆的 ``MemoryRecord.meta`` 里带：

- ``source``：来源，取下面五种之一（命名按《借鉴到galLingS_整合方案》§3.1 W1）
    - ``script``        剧本原文 / 作者写定的事
    - ``engine``        引擎裁决落账的事（玩家点的选项、propose_* 被 applied / clamped 后的结果）
    - ``player_claim``  玩家说的话——永远只是“玩家说”，不会升格成事实
    - ``heroine_line``  她（模型）说出口的台词——说过 ≠ 做过
    - ``model_note``    模型自己写下的笔记（write_memory 工具、日记）
- ``evidence_key``：``sha1(source + normalize(content))`` 的前 16 位，召回去重用（重复不等于证据）
- ``turn_event``：事件发生的回合
- ``as_of_turn``：条目里带数量 / 归属 / 称呼时才有——“这是第 N 回合时的说法”，当前真值只认引擎状态（W3）

只有 ``script`` / ``engine`` 两种来源能写 ``kind="fact"``；别的来源想写 fact，网关会降成 ``note``。
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

SOURCES = ("script", "engine", "player_claim", "heroine_line", "model_note")
FACT_SOURCES = frozenset({"script", "engine"})
#: 修订权：新条的来源权级 ≥ 旧条才能作废旧条（玩家说法永远不能作废任何条目）
AUTHORITY = {"script": 3, "engine": 3, "model_note": 1, "heroine_line": 1, "player_claim": 0}

#: 提示词里的分组（顺序即显示顺序）
GROUPS = (
    ("happened", "发生过的事（剧本 / 引擎落账，是事实）", ("script", "engine")),
    ("player", "玩家说过（只是玩家的说法，没有引擎记录佐证就不是事实，不要当成已经发生）", ("player_claim",)),
    ("heroine", "她自己说过 / 记下的（说过 ≠ 做过；承诺没有落账就没有发生）", ("heroine_line", "model_note")),
    ("unknown", "来源不明的片段（不当作事实）", ("",)),
)

_PUNCT = re.compile(r"[\s，。！？、…「」『』（）()—\-~～：:;；,.!?\"'“”‘’]+")
# 数量 / 归属 / 称呼：带这些的条目写入时打 as_of_turn（W3）
_QUANTITY = re.compile(r"[0-9０-９]+|[零一二两三四五六七八九十百几半]+\s*(个|块|株|只|颗|片|次|份|朵|根|张|枚|瓶|杯|天|回|点|成)"
                       r"|还剩|剩下|剩了|只剩|一共|总共|给了|送给|送了|交给|借给|收下|拿走|属于|归.{0,4}所有|是.{0,6}的东西"
                       r"|好感|心情|称呼|叫.{0,4}(主人|名字)")


def normalize(content: str) -> str:
    return _PUNCT.sub("", str(content or "")).lower()


def evidence_key(source: str, content: str) -> str:
    return hashlib.sha1(f"{source}|{normalize(content)}".encode("utf-8")).hexdigest()[:16]


def infer_source(content: str, kind: str) -> str:
    """没显式给来源时按旧写法推断（兼容老记忆 / 评测背景记忆）：
    ``玩家说：`` → player_claim，``她说：`` → heroine_line，event → engine，diary/note → model_note。
    kind=fact 不推断（旧版 write_memory 把模型笔记写成过 fact）：没显式来源的 fact 算来源不明，网关会降成 note。"""
    c = str(content or "").lstrip()
    if c.startswith(("玩家说：", "玩家说:", "我：")):
        return "player_claim"
    if c.startswith(("她说：", "她说:")):
        return "heroine_line"
    if kind in ("diary", "note"):
        return "model_note"
    if kind == "event":
        return "engine"
    return ""


def has_quantity(content: str) -> bool:
    return bool(_QUANTITY.search(str(content or "")))


def provenance_of(meta: dict[str, Any] | None, content: str, kind: str = "") -> str:
    src = str((meta or {}).get("source") or "")
    return src if src in SOURCES else infer_source(content, kind or str((meta or {}).get("kind") or ""))


def group_of(source: str) -> str:
    for gid, _, srcs in GROUPS:
        if source in srcs:
            return gid
    return "unknown"


def can_supersede(new_source: str, old_source: str) -> bool:
    """新条来源能不能作废旧条：玩家说法不能作废任何条目；模型笔记 / 台词不能作废剧本、引擎事实。"""
    if new_source == "player_claim":
        return False
    return AUTHORITY.get(new_source, 0) >= AUTHORITY.get(old_source or "", 0)
