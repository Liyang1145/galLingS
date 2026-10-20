"""进程级运行时：配置、插件管理器、章节、角色卡库。一个进程一个，多个会话共用。"""
from __future__ import annotations

import asyncio
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


def resolve_games_dir(config: dict[str, Any]) -> Path:
    """Keep the old default in saved settings usable after the repository move."""
    configured = (config.get("vn") or {}).get("games_dir") or "content/imports/vnstudio"
    directory = Path(os.path.expanduser(str(configured)))
    directory = directory if directory.is_absolute() else ROOT / directory
    legacy = ROOT / "content/vn"
    migrated = ROOT / "content/imports/vnstudio"
    if directory.resolve() == legacy.resolve() and migrated.is_dir():
        has_legacy_game = directory.is_dir() and any((p / "index.html").is_file() for p in directory.iterdir())
        if not has_legacy_game:
            return migrated
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
        cdir = Path(game.get("chapter_dir", "content/scripts/ch01"))
        cdir = cdir if cdir.is_absolute() else ROOT / cdir
        vn_game = game.get("vn_game") if game.get("source") == "vnstudio" else None
        try:
            if vn_game:
                # 一个游戏：VN Studio 作品经导入器变成 OP 程序，由 galcore 跑（PLAN §16.1 importer）
                from compiler.vnstudio import ensure_imported
                self.chapter_path = ensure_imported(self.games_dir / vn_game, self.data_dir / "imports")
            else:
                self.chapter_path = ensure_chapter(cdir)
            self.chapter = load_chapter_file(self.chapter_path)
            self.has_chapter = True
        except (IndexError, FileNotFoundError):
            # 没有剧本内容包（content/scripts/ch01）：AI 剧本会话不能用，但作品页 /vn.html 和设置照常可用
            self.chapter_path = cdir / "chapter.json"
            self.chapter = {"chapter_id": "none", "title": "（没有剧本内容包）", "content_hash": "", "program": [], "slots": []}
            self.has_chapter = False
        self.cards = CardStore(ROOT / "content" / "cards", self.data_dir / "cards")
        self.plugins = self._make_plugins()
        self._reload_lock = asyncio.Lock()

    def _make_plugins(self) -> PluginManager:
        settings = PluginSettings.from_dict(self.config.get("plugins"), base_dir=ROOT)
        return PluginManager(settings, self.data_dir, environ=self.settings.environ(self.base_environ))

    async def reload_plugins(self) -> dict[str, Any]:
        """网页里改了设置：重新叠配置、重启插件。正在进行的剧本会话下次开局才用上新模型。"""
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
        return [{"id": p.name, "title": p.name} for p in sorted(d.iterdir()) if (p / "index.html").is_file()]

    async def start(self) -> dict[str, Any]:
        rep = await self.plugins.start()
        for pid, err in self.plugins.failed().items():
            log.warning("插件未启用 %s：%s", pid, err)
        return rep

    async def stop(self) -> None:
        await self.plugins.stop()

    def llm_chain(self, purpose: str | None = None) -> list[Any]:
        """这次调用的模型降级链。purpose：story / soul / chat / cards，标明调用方（多模型插件目前不按用途区分）。

        选了多模型插件（gallings.llm.router）且它有可用模型时：链 = 它正在用的模型 + 其余非 openai-compat 的 llm 插件
        （路由里配的就是实际用的，旧的单模型插件不再悄悄兜底）；路由还没配模型时照旧走其余插件。
        """
        chain = [p for p in self.plugins.chain("llm") if isinstance(p, LLMPlugin)]
        router = next((p for p in chain if hasattr(p, "chain_for")), None)
        if router is None:
            return chain
        routed = router.chain_for(purpose)
        rest = [p for p in chain if p is not router and (not routed or p.ctx.plugin_id != "gallings.llm.openai-compat")]
        return routed + rest

    def plugin(self, plugin_id: str) -> Any | None:
        """按 id 取运行中的插件实例（设置面板接口用）。"""
        st = self.plugins.states.get(plugin_id)
        return st.instance if st is not None and st.status == "running" else None
