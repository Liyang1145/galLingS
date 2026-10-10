"""进程级运行时：配置、插件管理器、章节、角色卡库。一个进程一个，多个会话共用。"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml

from .content import CardStore, ensure_chapter, load_chapter_file
from .plugins import LLMPlugin, PluginManager, PluginSettings

ROOT = Path(__file__).resolve().parents[1]
log = logging.getLogger("gallings")


def load_config(path: Path | None = None) -> dict[str, Any]:
    env = os.environ.get("GALLINGS_CONFIG")
    for p in [path, Path(env) if env else None, ROOT / "config.yaml", ROOT / "config.example.yaml"]:
        if p and Path(p).is_file():
            return yaml.safe_load(Path(p).read_text(encoding="utf-8")) or {}
    return {}


class Runtime:
    def __init__(self, config: dict[str, Any], environ: dict[str, str] | None = None) -> None:
        self.config = config
        srv = config.get("server") or {}
        self.data_dir = Path(os.path.expanduser(str(srv.get("data_dir", "~/.gallings"))))
        self.data_dir.mkdir(parents=True, exist_ok=True)
        game = config.get("game") or {}
        self.game = game
        cdir = Path(game.get("chapter_dir", "content/scripts/ch01"))
        cdir = cdir if cdir.is_absolute() else ROOT / cdir
        self.chapter_path = ensure_chapter(cdir)
        self.chapter = load_chapter_file(self.chapter_path)
        self.cards = CardStore(ROOT / "content" / "cards", self.data_dir / "cards")
        settings = PluginSettings.from_dict(config.get("plugins"), base_dir=ROOT)
        self.plugins = PluginManager(settings, self.data_dir, environ=environ)

    async def start(self) -> dict[str, Any]:
        rep = await self.plugins.start()
        for pid, err in self.plugins.failed().items():
            log.warning("插件未启用 %s：%s", pid, err)
        return rep

    async def stop(self) -> None:
        await self.plugins.stop()

    def llm_chain(self) -> list[LLMPlugin]:
        return [p for p in self.plugins.chain("llm") if isinstance(p, LLMPlugin)]
