"""把多模型面板（plugins/builtin/llm-router/web/panel.js + panel.css）同步进作品 index.html。

为什么要内嵌一份：单文件 游玩.html / 双击打开的作品不连 galLingS 时，「设置 → 在线聊天与连接」也用同一个面板，
只是把 ctx.api 换成浏览器本地存储（index.html 的 VNModel.api）。在 galLingS 作品页里玩时 GL_ONLINE 发现
window.GLPanels 已经有这个面板，就不再从 /plugin-web 加载。

改了 panel.js / panel.css 之后跑一次：python tools/sync_router_panel.py（build_single_file_game.py 也会自动跑）。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PANEL = ROOT / "plugins/builtin/llm-router/web"
GAME_HTML = ROOT / "content/imports/vnstudio/海风与布丁/index.html"
START, END = "<!--gl-router-panel:start-->", "<!--gl-router-panel:end-->"


def block() -> str:
    js = (PANEL / "panel.js").read_text(encoding="utf-8")
    css = (PANEL / "panel.css").read_text(encoding="utf-8")
    if "</script" in js.lower() or "</style" in css.lower():
        raise ValueError("panel.js / panel.css 里不能出现 </script> 或 </style>")
    return (f"{START}\n<!-- 自动生成：tools/sync_router_panel.py 从 plugins/builtin/llm-router/web/ 复制，别手改 -->\n"
            f"<style id=\"gl-router-panel-css\">\n{css}</style>\n<script id=\"gl-router-panel-js\">\n{js}</script>\n{END}")


def sync(path: Path = GAME_HTML) -> bool:
    html = path.read_text(encoding="utf-8")
    new = block()
    if START in html:
        out = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _m: new, html, count=1, flags=re.S)
    else:
        i = html.index("</head>")
        out = html[:i] + new + "\n" + html[i:]
    if out == html:
        return False
    path.write_text(out, encoding="utf-8")
    return True


if __name__ == "__main__":
    changed = sync()
    print("已同步" if changed else "已是最新")
    sys.exit(0)
