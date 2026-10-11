"""进程级运行时：配置、插件管理器、章节、角色卡库。一个进程一个，多个会话共用。"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml

from .content import CardStore, ensure_chapter, load_chapter_file
from .plugins import LLMPlugin, PluginManager, PluginSettings
from .settings_store import SettingsStore

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
        self.base_config, self.base_environ = config, environ
        srv = config.get("server") or {}
        self.data_dir = Path(os.path.expanduser(str(srv.get("data_dir", "~/.gallings"))))
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings = SettingsStore(self.data_dir)  # 网页“设置”里改的东西，叠在 config.yaml 上
        config = self.config = self.settings.overlay(config)
        game = config.get("game") or {}
        self.game = game
        cdir = Path(game.get("chapter_dir", "content/scripts/ch01"))
        cdir = cdir if cdir.is_absolute() else ROOT / cdir
        self.chapter_path = ensure_chapter(cdir)
        self.chapter = load_chapter_file(self.chapter_path)
        self.cards = CardStore(ROOT / "content" / "cards", self.data_dir / "cards")
        self.plugins = self._make_plugins()

    def _make_plugins(self) -> PluginManager:
        settings = PluginSettings.from_dict(self.config.get("plugins"), base_dir=ROOT)
        return PluginManager(settings, self.data_dir, environ=self.settings.environ(self.base_environ))

    async def reload_plugins(self) -> dict[str, Any]:
        """网页里改了设置：重新叠配置、重启插件。正在进行的剧本会话下次开局才用上新模型。"""
        await self.plugins.stop()
        self.config = self.settings.overlay(self.base_config)
        self.plugins = self._make_plugins()
        return await self.start()

    @property
    def games_dir(self) -> Path:
        """作品文件夹：每个子文件夹是一个 VN Studio 导出的游戏（里面有 index.html）。"""
        d = Path(os.path.expanduser(str((self.config.get("vn") or {}).get("games_dir") or "content/vn")))
        return d if d.is_absolute() else ROOT / d

    def games(self) -> list[dict[str, Any]]:
        d = self.games_dir
        if not d.is_dir():
            return []
        return [{"id": p.name, "title": p.name} for p in sorted(d.iterdir()) if (p / "index.html").is_file()]

    async def start(self) -> dict[str, Any]:
        rep = await self.plugins.start()
        for pid, err in self.plugins.failed().items():
            log.warning("插件未启用 %s：%s", pid, err)
        return rep

    async def stop(self) -> None:
        await self.plugins.stop()

    def llm_chain(self) -> list[LLMPlugin]:
        return [p for p in self.plugins.chain("llm") if isinstance(p, LLMPlugin)]
