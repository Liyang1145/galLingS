"""回放：从事件日志重建引擎，逐条比对 state_hash（PLAN §4.1 第 5 条、§19.1）。

    python -m server.replay %USERPROFILE%\\.gallings\\sessions\\<id>\\events.jsonl

回放不调用模型、不查记忆；召回结果、模型输出都直接取日志里的事件。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import galcore

from .content import load_chapter_file
from .recorder import read_log


def engine_from_header(h: dict[str, Any]) -> Any:
    chapter = load_chapter_file(Path(h["chapter_path"]))
    if chapter["content_hash"] != h["content_hash"]:
        raise ValueError(f"剧本已变（日志 {h['content_hash']}，现在 {chapter['content_hash']}），拒绝回放")
    return galcore.Engine(json.dumps(chapter, ensure_ascii=False), json.dumps(h["card"], ensure_ascii=False),
                          json.dumps(h["engine_config"], ensure_ascii=False), int(h["seed"]))


def replay(header: dict[str, Any], events: list[dict[str, Any]], upto: int | None = None
           ) -> tuple[Any, list[dict[str, Any]], int | None]:
    """返回 (engine, 所有 ops, 第一处不一致的 seq 或 None)。"""
    eng = engine_from_header(header)
    ops: list[dict[str, Any]] = []
    mismatch = None
    for row in events:
        if upto is not None and row["seq"] > upto:
            break
        res = json.loads(eng.step(json.dumps({"kind": row["kind"], "payload": row["payload"]}, ensure_ascii=False)))
        ops.extend(res["ops"])
        if res["state_hash"] != row["state_hash"] and mismatch is None:
            mismatch = row["seq"]
    return eng, ops, mismatch


def screen_from_ops(ops: list[dict[str, Any]]) -> dict[str, Any]:
    """把一串 ops 折叠成"那一刻的画面"，供调试时间轴拖动后显示（PLAN §14）。"""
    sc: dict[str, Any] = {"scene": None, "bgm": None, "sprite": None, "say": None, "choice": None, "state": None, "tail": None}
    for op in ops:
        k = op.get("op")
        if k == "SCENE":
            sc["scene"] = op
        elif k == "BGM":
            sc["bgm"] = op
        elif k == "SPRITE":
            sc["sprite"] = op
        elif k == "SAY":
            sc["say"], sc["choice"] = op, None
        elif k == "CHOICE":
            sc["choice"] = op
        elif k == "STATE":
            sc["state"] = op
        elif k == "TAIL":
            sc["tail"] = op
        elif k == "END":
            sc["choice"] = None
    return sc


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    sys.stdout.reconfigure(encoding="utf-8")
    if not argv:
        print("用法：python -m server.replay <events.jsonl>")
        return 2
    h, evs = read_log(Path(argv[0]))
    _, _, bad = replay(h, evs)
    if bad is None:
        print(f"回放一致：{len(evs)} 个事件，state_hash 逐条相同。")
        return 0
    print(f"回放不一致：第一处分歧在 seq={bad}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
