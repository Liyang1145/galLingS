"""python -m server → 启动本地后端；有作品时打开作品页，否则打开 API 文档。"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import threading
import webbrowser
from pathlib import Path

import uvicorn

from .api.app import create_app
from .runtime import load_config, resolve_games_dir
from .settings_store import SettingsStore


def _has_games(cfg: dict) -> bool:
    """作品文件夹（content/imports/vnstudio 或网页设置里改过的）里有没有 VN Studio 导出的游戏。"""
    srv = cfg.get("server") or {}
    data_dir = Path(os.path.expanduser(str(srv.get("data_dir", "~/.gallings"))))
    d = resolve_games_dir(SettingsStore(data_dir).overlay(cfg))
    return d.is_dir() and any((p / "index.html").is_file() for p in d.iterdir())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m server")
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--port", type=int, default=None)
    a = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cfg = load_config()
    srv = cfg.get("server") or {}
    host = srv.get("host", "127.0.0.1")
    port = a.port or int(srv.get("port", 8765))
    url = f"http://{host}:{port}" + ("/vn.html" if _has_games(cfg) else "/docs")
    print(f"galLingS 已启动：{url}")
    if not a.no_browser:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    uvicorn.run(create_app(), host=host, port=port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
