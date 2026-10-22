"""把作品页打成不需要 Python 服务的离线包（桌面程序 desktop/ 直接装进去；也能用任何静态服务器打开）。

    python tools/build_desktop_dist.py              # 输出到 dist/desktop/
    python tools/build_desktop_dist.py --out D:/x   # 指定位置
    python tools/build_desktop_dist.py --wasm path/to/galcore.wasm

目录结构和服务端路由一一对应，所以网页代码不用分两套：

    vn.html                      作品页（注入 GALLINGS_OFFLINE，在线设置隐藏）
    static/…                     web/ 原样
    static/offline/galcore.wasm  Rust 引擎（core/，cargo build --target wasm32-unknown-unknown --release）
    static/offline/chapter.json  导入器把作品编成的 OP 程序（compiler/vnstudio.py，与服务端同一份）
    static/offline/card.json     默认角色卡
    vn/<作品>/…                  作品文件夹原样
    api/vn/games、api/vn/plugins、api/status   原来的 GET 接口，换成静态 JSON

离线包只有纯选项模式：AI 模式、结局后聊天、灵枢记忆要服务端（start.bat）。
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from compiler.vnstudio import ensure_imported  # noqa: E402
from server.content import CardStore, load_chapter_file  # noqa: E402
from server.runtime import load_config, resolve_games_dir, resolve_vn_game_dir  # noqa: E402

WASM_DEFAULT = ROOT / "core" / "target" / "wasm32-unknown-unknown" / "release" / "galcore.wasm"
OFFLINE_HEAD = (
    '<script>window.GALLINGS_OFFLINE = true; window.GALLINGS_STEAM = true;</script>\n'
    '<style>#onlineSettings{display:none}</style>\n'
)


def build_wasm() -> Path:
    subprocess.run(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"], cwd=ROOT / "core", check=True)
    return WASM_DEFAULT


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=str(ROOT / "dist" / "desktop"))
    ap.add_argument("--wasm", default="", help="已编好的 galcore.wasm；不给就现编（需要 Rust 和 wasm32 目标）")
    ap.add_argument("--card", default="", help="角色卡 id，默认取 config.yaml 的 game.default_card")
    a = ap.parse_args(argv)

    cfg = load_config()
    game = cfg.get("game") or {}
    games_dir = resolve_games_dir(cfg)
    vn_game = str(game.get("vn_game") or games_dir.name)
    src_game = resolve_vn_game_dir(games_dir, vn_game)
    if not vn_game or not (src_game / "index.html").is_file():
        print(f"找不到作品：{src_game}（config.yaml 的 game.vn_game）", file=sys.stderr)
        return 1

    wasm = Path(a.wasm) if a.wasm else (WASM_DEFAULT if WASM_DEFAULT.is_file() else build_wasm())
    if not wasm.is_file():
        print(f"找不到 galcore.wasm：{wasm}", file=sys.stderr)
        return 1

    out = Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    # 网页 + 作品 + GalAgent 插件原样复制
    shutil.copytree(ROOT / "web", out / "static", ignore=shutil.ignore_patterns("*.map"))
    shutil.copytree(src_game, out / "vn" / vn_game, ignore=shutil.ignore_patterns(".gitignore", "*.md"))
    ga_web = ROOT / "plugins" / "builtin" / "galagent" / "web"
    if ga_web.is_dir():
        (out / "galagent").mkdir(parents=True, exist_ok=True)
        for name in ("galagent.vnplugin.js", "galagent-ui.js", "chat.html"):
            if (ga_web / name).is_file():
                shutil.copy2(ga_web / name, out / "galagent" / name)
    html = (ROOT / "web" / "vn.html").read_text(encoding="utf-8")
    html = html.replace("</head>", OFFLINE_HEAD + "</head>", 1)
    (out / "vn.html").write_text(html, encoding="utf-8")
    (out / "index.html").write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=vn.html?steam=1">', encoding="utf-8")

    # 引擎 + 编好的剧本 + 角色卡
    off = out / "static" / "offline"
    off.mkdir(parents=True, exist_ok=True)
    shutil.copy2(wasm, off / "galcore.wasm")
    with tempfile.TemporaryDirectory() as tmp:
        chapter = load_chapter_file(ensure_imported(src_game, Path(tmp)))
        card_id = a.card or str(game.get("default_card", "whale"))
        card, _ = CardStore(ROOT / "content" / "cards", Path(tmp) / "cards").get(card_id)
    write_json(off / "chapter.json", chapter)
    write_json(off / "card.json", card)

    # 原来的 GET 接口
    write_json(out / "api" / "vn" / "games", {"dir": "（离线包）", "games": [{"id": vn_game, "title": vn_game}]})
    write_json(out / "api" / "vn" / "plugins", {"plugins": [
        {"id": "gallings.galcore", "name": "galcore 引擎", "url": "/static/galcore.vnplugin.js"},
        {"id": "gallings.galagent", "name": "GalAgent", "url": "/galagent/galagent.vnplugin.js"},
    ]})
    write_json(out / "api" / "status", {"offline": True, "llm": False, "memory": False,
                                        "chapter": {"id": chapter["chapter_id"], "title": chapter["title"],
                                                    "content_hash": chapter["content_hash"]},
                                        "default_card": card["id"], "default_mode": "choice"})
    write_json(out / "api" / "settings", {"llm": {"configured": False, "base_url": "", "model": "", "key_tail": ""},
                                          "memory": {"backend": "local", "active": "local"},
                                          "games_dir": "（离线包）"})

    n = sum(1 for p in out.rglob("*") if p.is_file())
    mb = sum(p.stat().st_size for p in out.rglob("*") if p.is_file()) / 1e6
    print(f"离线包：{out}（{n} 个文件，{mb:.1f} MB；剧本 {chapter['chapter_id']} {chapter['content_hash']}，角色卡 {card['id']}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
