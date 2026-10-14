"""Create a small, self-contained HTML demonstration for team review."""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image

from build_art_catalog import GAME, ROOT, build


def run() -> Path:
    catalog = build()
    text = (GAME / "game.js").read_text(encoding="utf-8-sig")
    project = json.loads(text[text.index("=") + 1:].strip().removesuffix(";"))
    for item in catalog["items"]:
        with Image.open(ROOT / item["path"]) as image:
            image = image.convert("RGBA")
            image.thumbnail((960, 720) if item["category"] != "ch" else (600, 900))
            data = io.BytesIO()
            image.save(data, "WEBP", quality=80, method=5)
        item["previewSrc"] = "data:image/webp;base64," + base64.b64encode(data.getvalue()).decode("ascii")
        for asset_id in item["runtimeIds"]:
            project["assets"][asset_id]["src"] = ""  # Filled from catalog below; do not duplicate embedded images.
    for asset in project["assets"].values():
        if asset["type"] not in {"bg", "ch"}:
            asset["src"] = ""  # Artwork demonstration; no missing external audio requests.
    html = (GAME / "index.html").read_text(encoding="utf-8")
    styles = (GAME / "game-polish.css").read_text(encoding="utf-8") + "\n" + (GAME / "art-editor.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="game-polish.css">', "<style>" + styles + "</style>")
    jsdata = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    prelude = "window.VN_EDITOR=true;window.VN_PREVIEW_ONLY=true;window.VN_GAME=" + jsdata(project) + ";window.VN_ART_CATALOG=" + jsdata(catalog) + ";window.VN_ART_CATALOG.items.forEach(i=>i.runtimeIds.forEach(id=>window.VN_GAME.assets[id].src=i.previewSrc));\n" + (GAME / "art-editor.js").read_text(encoding="utf-8")
    # JavaScript string literals may contain HTML closing tags; do not end the inline script early.
    html = html.replace('<script src="game.js"></script>', "<script>" + prelude.replace("</script", "<\\/script") + "</script>")
    out = ROOT.parent.parent / "outputs/art-editor/海风与布丁_美术开发页预览.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    result = run()
    print(json.dumps({"file": str(result), "bytes": result.stat().st_size}, ensure_ascii=True))
