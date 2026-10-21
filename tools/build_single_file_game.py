"""Pack the current VN Studio project and original media into one offline HTML."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "content/imports/vnstudio/海风与布丁"
# 默认输出 = 仓库根目录 游玩.html：一个文件包含全部剧情、美术、配乐和插件（GalAgent），发给别人双击就能玩；
# 结局后聊天 / 灵枢悄悄话在游戏「设置 → 在线聊天与连接」里填自己的 AI 模型密钥，不用 galLingS 后端。
DEFAULT_OUT = ROOT / "游玩.html"
MEDIA_MIME = {".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp",
              ".gif":"image/gif", ".avif":"image/avif", ".mp3":"audio/mpeg", ".ogg":"audio/ogg",
              ".wav":"audio/wav", ".m4a":"audio/mp4", ".aac":"audio/aac", ".flac":"audio/flac"}


def build(output: Path, project_file: Path | None = None) -> dict:
    # 多模型面板内嵌进作品 index.html（不连 galLingS 时“在线聊天与连接”也用它），先同步成插件里的最新版
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from sync_router_panel import sync as sync_router_panel
    sync_router_panel()
    if project_file:
        project = json.loads(project_file.read_text(encoding="utf-8-sig"))
        if not isinstance(project.get("assets"), dict) or not isinstance(project.get("lines"), list):
            raise ValueError("Expected a saved VN Studio project with assets and lines")
        project["cur"] = 0
        project.pop("recent", None)
    else:
        source = (GAME / "game.js").read_text(encoding="utf-8-sig")
        project = json.loads(source[source.index("=") + 1:].strip().removesuffix(";"))
    used = set()
    def scan(value):
        if isinstance(value,str):used.add(value)
        elif isinstance(value,list):
            for item in value:scan(item)
        elif isinstance(value,dict):
            for item in value.values():scan(item)
    for key,value in project.items():
        if key not in {'assets','recent'}:scan(value)
    project['assets']={key:a for key,a in project['assets'].items()
        if key in used or (not a.get('libraryPath') and a['type'] not in {'bg','ch'})}
    cache, hashes = {}, {}
    def embed(src: str, library_path: str = "") -> str:
        if src.startswith("data:"):
            mime, encoded = src.split(",", 1)
            if ";base64" not in mime or not mime.startswith(("data:image/", "data:audio/")):
                raise ValueError("Imported media must be an image/audio base64 data URL")
            data = base64.b64decode(encoded, validate=True)
            key = "imported:" + hashlib.sha256(data).hexdigest()
            hashes[key] = {"bytes":len(data), "sha256":hashlib.sha256(data).hexdigest()}
            return src
        if library_path:
            path = (ROOT / library_path).resolve()
        elif src.startswith("file:"):
            path = Path(url2pathname(unquote(urlparse(src).path))).resolve()
        else:
            if urlparse(src).scheme or src.startswith("/"):
                raise ValueError(f"Unsupported media URL; use the repository libraryPath: {src}")
            path = (GAME / src).resolve()
        if (ROOT / "content").resolve() not in path.parents or not path.is_file():
            raise ValueError(f"Missing or unsafe media path: {library_path or src}")
        # Windows registry MIME entries may omit WebP or override its media type.
        mime = MEDIA_MIME.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if not mime.startswith(("image/", "audio/")):
            raise ValueError(f"Expected image/audio media: {path.name}")
        key = path.relative_to(ROOT.resolve()).as_posix()
        if key not in cache:
            data = path.read_bytes()
            cache[key] = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")
            hashes[key] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        return cache[key]
    for asset in project["assets"].values():
        asset["src"] = embed(asset["src"], asset.get("libraryPath", ""))
        asset.pop("file", None)
    html = (GAME / "index.html").read_text(encoding="utf-8")
    css = (GAME / "game-polish.css").read_text(encoding="utf-8")
    css = re.sub(r'url\("([^\"]+)"\)', lambda m: 'url("' + embed(m[1]) + '")', css)
    html = html.replace('<link rel="stylesheet" href="game-polish.css">', "<style>" + css + "</style>")
    html = html.replace('<script src="game.js"></script>', '<script>window.VN_GAME=' + json.dumps(project, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + ';</script>')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    manifest = {"entry":output.name, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                "bytes":output.stat().st_size, "assets":len(project["assets"]), "files":len(hashes),
                "lines":len(project["lines"]), "chapters":sum(bool(l.get("chapter")) for l in project["lines"]),
                "scope":"Complete story in one file; online chat uses the in-game AI model settings (no backend needed).", "media":hashes}
    if project_file:
        manifest["saved_project"] = {"name":project_file.name,
                                     "sha256":hashlib.sha256(project_file.read_bytes()).hexdigest()}
    if output.resolve() == DEFAULT_OUT.resolve():   # 根目录 游玩.html：不在仓库根放清单
        return manifest
    output.with_suffix(".manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--project", type=Path, help="Saved .vnproj.json with manual artwork adjustments; originals stay unchanged")
    args = ap.parse_args()
    report = build(args.output, args.project)
    print(json.dumps({k:report[k] for k in ["bytes","assets","files","lines","chapters"]}))
