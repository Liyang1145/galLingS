"""作品 index.html 内嵌的多模型面板必须和插件里的 panel.js / panel.css 一致（改了插件面板记得跑 tools/sync_router_panel.py）。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from sync_router_panel import GAME_HTML, block  # noqa: E402


def test_embedded_router_panel_is_in_sync():
    assert block() in GAME_HTML.read_text(encoding="utf-8")
