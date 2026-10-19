"""把 VN Studio 导出的游戏文件夹整理成安卓包要用的 assets/game/。

python mobile/prepare_assets.py <作品文件夹> <android 工程目录>
- 复制整个作品文件夹到 app/src/main/assets/game/（编辑器专用文件不带）；
- 背景 / CG 等宽于 1920 的图缩到 1920 宽（文件名、格式不变，game.js 不用改）；
- index.html 末尾注入 mobile/host.js（横竖屏切换、返回键）；
- 用封面图生成启动图标。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

MAXW = 1920
SKIP = {"art-editor.js", "art-editor.css", "art-catalog.js"}


def main() -> int:
    game, proj = Path(sys.argv[1]), Path(sys.argv[2])
    out = proj / "app/src/main/assets/game"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    raw = done = 0
    for src in game.rglob("*"):
        if src.is_dir() or src.name in SKIP:
            continue
        rel = src.relative_to(game)
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        raw += src.stat().st_size
        ext = src.suffix.lower()
        if ext in (".webp", ".png", ".jpg", ".jpeg"):
            try:
                im = Image.open(src)
                if im.width > MAXW:
                    s = MAXW / im.width
                    im = im.resize((MAXW, round(im.height * s)), Image.LANCZOS)
                    if ext == ".webp":
                        im.save(dst, "WEBP", quality=84, method=4)
                    elif ext == ".png":
                        im.save(dst, "PNG", optimize=True)
                    else:
                        im.convert("RGB").save(dst, "JPEG", quality=88)
                    done += dst.stat().st_size
                    continue
            except Exception as e:  # 认不出的图原样复制
                print("skip", rel, e)
        shutil.copy2(src, dst)
        done += dst.stat().st_size
    idx = out / "index.html"
    html = idx.read_text(encoding="utf-8")
    host = (Path(__file__).parent / "host.js").read_text(encoding="utf-8")
    i = html.rfind("</body>")
    html = html[:i] + "<script>\n" + host + "\n</script>\n" + html[i:]
    # 编辑器脚本不带进安卓包
    html = re.sub(r'<script src="art-(catalog|editor)\.js"></script>\s*', "", html)
    html = re.sub(r'<link rel="stylesheet" href="art-editor\.css">\s*', "", html)
    idx.write_text(html, encoding="utf-8")
    # 图标：封面图中间裁正方形
    g = (game / "game.js").read_text(encoding="utf-8")
    data = json.JSONDecoder().raw_decode(g[g.index("{"):])[0]
    cover = (data.get("settings") or {}).get("cover") or {}
    a = data["assets"].get(cover.get("img") or "", {})
    ic_src = game / a["src"] if a.get("src") and (game / a["src"]).is_file() else None
    res = proj / "app/src/main/res"
    for d, n in (("mipmap-mdpi", 48), ("mipmap-hdpi", 72), ("mipmap-xhdpi", 96), ("mipmap-xxhdpi", 144), ("mipmap-xxxhdpi", 192)):
        (res / d).mkdir(parents=True, exist_ok=True)
        if ic_src:
            im = Image.open(ic_src).convert("RGB")
            s = min(im.size)
            l, t = (im.width - s) // 2, (im.height - s) // 2
            im.crop((l, t, l + s, t + s)).resize((n, n), Image.LANCZOS).save(res / d / "ic_launcher.png")
        else:
            Image.new("RGB", (n, n), (40, 110, 140)).save(res / d / "ic_launcher.png")
    print(json.dumps({"raw_mb": round(raw / 1e6, 1), "out_mb": round(done / 1e6, 1), "icon": str(ic_src)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
