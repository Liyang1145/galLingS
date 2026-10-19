"""事件记录器：唯一写事件日志的地方（PLAN §4.2）。JSONL，追加写，一行一个事件。

不写 API key；模型原始请求体不进日志。``wall_ms`` 只给时间轴显示 / 重播定节奏，不参与计算。

除了事件行，还有 ``{"kind": "sent", "after_seq": N, "msg": {...}}`` 行：那一刻真正发给前端的画面消息
（ops / screen / notice）。它不是事件、不进引擎，只给"录制回放演示模式"原样重放画面用；``read_log`` 会跳过它。
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

LOG_VERSION = 1


class Recorder:
    def __init__(self, path: Path, header: dict[str, Any]) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.header = {"kind": "header", "log_version": LOG_VERSION, **header}
        self.events: list[dict[str, Any]] = []
        self._f = self.path.open("w", encoding="utf-8", newline="\n")
        self._write(self.header)

    def _write(self, obj: dict[str, Any]) -> None:
        self._f.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")
        self._f.flush()

    def record(self, event: dict[str, Any], result: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
        row = {"seq": result["seq"], "kind": event["kind"], "source": event.get("source", "engine"),
               "payload": event.get("payload", {}), "verdicts": result.get("verdicts", []),
               "state_hash": result["state_hash"], "wall_ms": int(time.time() * 1000)}
        if extra:
            row["display"] = extra  # 只给时间轴看（如 AGM 联想路径的说明），不参与回放
        self.events.append(row)
        self._write(row)
        return row

    def sent(self, msg: dict[str, Any]) -> None:
        """记下发给前端的一条画面消息（重播用），挂在当前最后一个事件之后。"""
        if self._f.closed:
            return
        self._write({"kind": "sent", "after_seq": self.events[-1]["seq"] if self.events else 0, "msg": msg})

    def close(self) -> None:
        if not self._f.closed:
            self._f.close()


def read_log_full(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """返回 (header, 事件行, sent 行)。"""
    lines = [json.loads(x) for x in Path(path).read_text(encoding="utf-8").splitlines() if x.strip()]
    if not lines or lines[0].get("kind") != "header":
        raise ValueError("日志第一行不是 header")
    events = [x for x in lines[1:] if x.get("kind") != "sent"]
    sent = [x for x in lines[1:] if x.get("kind") == "sent"]
    return lines[0], events, sent


def read_log(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    h, events, _ = read_log_full(path)
    return h, events
