"""辅助服务的角色卡读取；不编译或加载剧情章节。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]


def load_card_any(path: str | Path) -> dict[str, Any]:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    return json.loads(text) if p.suffix == ".json" else yaml.safe_load(text)


class CardStore:
    """内置卡（只读）+ 玩家卡（可写）。"""

    def __init__(self, builtin_dir: Path, user_dir: Path) -> None:
        self.builtin_dir = builtin_dir
        self.user_dir = user_dir
        user_dir.mkdir(parents=True, exist_ok=True)

    def paths(self) -> dict[str, Path]:
        out: dict[str, Path] = {}
        for d in (self.builtin_dir, self.user_dir):
            if d.is_dir():
                for p in sorted(list(d.glob("*.yaml")) + list(d.glob("*.json"))):
                    try:
                        out.setdefault(load_card_any(p)["id"], p)
                    except Exception:  # noqa: BLE001 - 坏卡跳过，建卡页会提示
                        continue
        return out

    def get(self, card_id: str) -> tuple[dict[str, Any], Path]:
        p = self.paths().get(card_id)
        if p is None:
            raise KeyError(card_id)
        return load_card_any(p), p

    def is_builtin(self, card_id: str) -> bool:
        p = self.paths().get(card_id)
        return p is not None and p.parent == self.builtin_dir

    def save(self, card: dict[str, Any]) -> Path:
        if self.is_builtin(card["id"]):
            raise ValueError("不能覆盖内置卡，请换一个 id")
        p = self.user_dir / f"{card['id']}.json"
        p.write_text(json.dumps(card, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
        return p

    def listing(self) -> list[dict[str, Any]]:
        out = []
        for cid, p in self.paths().items():
            c = load_card_any(p)
            out.append({"id": cid, "name": c["identity"]["name"], "builtin": p.parent == self.builtin_dir,
                        "locked_script": bool(c.get("locked_script"))})
        return out
