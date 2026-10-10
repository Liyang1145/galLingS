"""内容加载：编译好的章节、角色卡（内置 content/cards 与玩家建的 ~/.gallings/cards）。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]


def canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha16(obj: Any) -> str:
    return hashlib.sha256(canonical(obj).encode("utf-8")).hexdigest()[:16]


def load_chapter_file(path: Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def ensure_chapter(chapter_dir: Path) -> Path:
    """chapter.json 不存在或比源稿旧时自动重编译。"""
    out = chapter_dir / "chapter.json"
    scripts = [p for p in chapter_dir.glob("*.md") if p.name not in ("report.md", "README.md")]
    srcs = scripts + [chapter_dir / "beats.yaml"]
    if not out.exists() or any(p.stat().st_mtime > out.stat().st_mtime for p in srcs if p.exists()):
        from compiler.compile import canonical as c2, compile_chapter
        appendix = chapter_dir.parent / "appendix_e.md"
        ch, report = compile_chapter(scripts[0], chapter_dir / "beats.yaml", appendix if appendix.exists() else None)
        out.write_text(c2(ch) + "\n", encoding="utf-8", newline="\n")
        (chapter_dir / "report.md").write_text(report, encoding="utf-8", newline="\n")
    return out


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
