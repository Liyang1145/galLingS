from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "tests" / "fixtures"
CH01 = ROOT / "content" / "scripts" / "ch01"


@pytest.fixture()
def mini_dir(tmp_path: Path) -> Path:
    d = tmp_path / "mini"
    shutil.copytree(FIX / "mini", d)
    return d


@pytest.fixture()
def mini_chapter(mini_dir: Path) -> dict:
    from compiler.compile import compile_chapter
    ch, _ = compile_chapter(mini_dir / "mini.md", mini_dir / "beats.yaml")
    return ch


@pytest.fixture()
def cat_card() -> dict:
    import yaml
    return yaml.safe_load((FIX / "cards" / "cat.yaml").read_text(encoding="utf-8"))


def make_runtime(tmp_path: Path, chapter_dir: Path, cards_dir: Path, llm_responses: list | None = None):
    from server.runtime import Runtime
    sel = {"memory": ["gallings.memory.local"]}
    conf = {}
    if llm_responses is not None:
        sel["llm"] = ["gallings.llm.scripted"]
        conf["gallings.llm.scripted"] = {"responses": llm_responses}
    cfg = {"server": {"data_dir": str(tmp_path / "data")},
           "game": {"chapter_dir": str(chapter_dir), "default_card": "cat"},
           "plugins": {"paths": [str(ROOT / "plugins" / "builtin")], "select": sel, "config": conf,
                       "guards": [], "tools": [], "importers": []}}
    rt = Runtime(cfg)
    rt.cards.builtin_dir = cards_dir
    return rt


def tool(name: str, **args) -> dict:
    return {"name": name, "arguments": args}


def jtext(obj) -> dict:
    return {"text": json.dumps(obj, ensure_ascii=False)}
