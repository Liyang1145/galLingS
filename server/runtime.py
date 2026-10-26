"""旧制作/独立聊天辅助服务：配置、插件管理器与角色卡，不加载或运行剧情。"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

import yaml

from .content import CardStore
from .plugins import LLMPlugin, PluginManager, PluginSettings
from .settings_store import SettingsStore

ROOT = Path(__file__).resolve().parents[1]
GAME_DIR = "海风与布丁"  # 作品本体目录（仓库根下一层，内含 index.html）
log = logging.getLogger("gallings")


def resolve_games_dir(config: dict[str, Any]) -> Path:
    """作品目录。

    两种形态都支持：
    - 目录本身就是一个作品（里面直接有 index.html），默认即此：仓库根的 `海风与布丁/`
    - 目录下每个子文件夹各是一个作品（旧的多作品布局，仍兼容）
    """
    configured = (config.get("vn") or {}).get("games_dir") or os.environ.get("GALLINGS_GAMES_DIR") or GAME_DIR
    directory = Path(os.path.expanduser(str(configured)))
    directory = directory if directory.is_absolute() else ROOT / directory
    if not directory.is_dir():
        # 设置里存的老路径已失效（仓库结构调整过），回退到默认作品目录
        fallback = ROOT / GAME_DIR
        if fallback.is_dir():
            return fallback
    return directory


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
        self.cards = CardStore(ROOT / "content" / "cards", self.data_dir / "cards")
        self.plugins = self._make_plugins()
        self._reload_lock = asyncio.Lock()

    def _make_plugins(self) -> PluginManager:
        settings = PluginSettings.from_dict(self.config.get("plugins"), base_dir=ROOT)
        return PluginManager(settings, self.data_dir, environ=self.settings.environ(self.base_environ))

    async def reload_plugins(self) -> dict[str, Any]:
        """辅助页修改配置后串行重启插件，不创建或迁移剧情会话。"""
        # 两次保存挨得很近时要排队：不然两个重启交错，前一个新起的插件（比如灵枢子进程）没人关
        async with self._reload_lock:
            await self.plugins.stop()
            self.config = self.settings.overlay(self.base_config)
            self.plugins = self._make_plugins()
            return await self.start()

    @property
    def games_dir(self) -> Path:
        """作品文件夹：每个子文件夹是一个 VN Studio 导出的游戏（里面有 index.html）。"""
        return resolve_games_dir(self.config)

    def games(self) -> list[dict[str, Any]]:
        d = self.games_dir
        if not d.is_dir():
            return []
        if (d / "index.html").is_file():
            # 单作品：目录本身就是一个作品
            return [{"id": d.name, "title": d.name}]
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
