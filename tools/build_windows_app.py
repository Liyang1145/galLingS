"""组装正式播放器 + Python 后端的 Windows 便携文件夹，不复制制作库或试用引擎。

  python tools/build_windows_app.py --plan dist/windows-plan.json
  python tools/build_windows_app.py --exe desktop/src-tauri/target/release/gallings-desktop.exe \
      --galcore-wheel wheels/galcore-0.1.0-cp311-abi3-win_amd64.whl --zip
  python tools/build_windows_app.py --exe ... --python-dir prepared/python

输出目录必须不存在，不删除已有文件。计划模式不下载、安装、构建或复制游戏资源。
默认读取仓库根的海风与布丁/；保留现有多模型插件及正式播放器，不带 rebuild。
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
GAME_NAME = "海风与布丁"
PY_VERSION = "3.11.9"
PY_URL = f"https://www.python.org/ftp/python/{PY_VERSION}/python-{PY_VERSION}-embed-amd64.zip"
CODE_DIRS = ("server", "compiler", "plugins/builtin", "web", "schemas", "content/cards", "content/vn_plugins")
PUBLIC_FILES = ("config.example.yaml", "config.galagent.example.yaml", "requirements.txt", "LICENSE")
EXCLUDED_PARTS = {".git", "__pycache__", ".pytest_cache", "node_modules", "target", "dist", "art-candidates", "cg-animations", "whale-girl-live2d-base", "A素材库", "contributions"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".mp4", ".webm", ".mov", ".moc3", ".model3.json"}
EXCLUDED_NAMES = {".env", "config.yaml", "secrets.json", "settings.json", "userdata.json"}
REFS = re.compile(r"(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]|url\(\s*['\"]?([^)'\"\s]+)", re.I)


def allowed_path(path: PurePosixPath) -> bool:
    return (not any(part in EXCLUDED_PARTS or part.startswith(".env") for part in path.parts)
            and path.name not in EXCLUDED_NAMES
            and path.suffix.lower() not in EXCLUDED_SUFFIXES
            and not path.name.lower().endswith(".model3.json"))


def local_ref(value: str) -> PurePosixPath | None:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme in ("data", "blob"):
        return None
    if parsed.scheme or parsed.netloc:
        raise ValueError(f"运行包不接受外部资源：{value[:120]}")
    raw = urllib.parse.unquote(parsed.path).replace("\\", "/")
    if not raw or raw.startswith("#"):
        return None
    path = PurePosixPath(raw)
    if path.is_absolute() or ".." in path.parts or any(":" in p for p in path.parts):
        raise ValueError(f"资源越过作品目录：{value[:120]}")
    if not allowed_path(path):
        raise ValueError(f"正式资源仍引用已排除的制作资源或视频：{value[:120]}")
    return path


def load_game(game_dir: Path) -> dict:
    text = (game_dir / "game.js").read_text(encoding="utf-8-sig")
    match = re.fullmatch(r"\s*window\.VN_GAME\s*=\s*(.*?)\s*;?\s*", text, re.S)
    if not match:
        raise ValueError("game.js 必须是 window.VN_GAME 的纯 JSON 导出")
    data = json.loads(match.group(1))
    if not isinstance(data.get("assets"), dict) or not isinstance(data.get("lines"), list):
        raise ValueError("作品缺少 assets 或 lines")
    return data


def game_files(game_dir: Path) -> set[PurePosixPath]:
    data = load_game(game_dir)
    files = {PurePosixPath("index.html"), PurePosixPath("game.js")}
    # 根文件仅取播放器实际随包脚本/样式。制作库、归档、候选子目录不作递归复制。
    files.update(PurePosixPath(p.name) for p in game_dir.iterdir()
                 if p.is_file() and p.suffix.lower() in {".js", ".css", ".woff", ".woff2", ".ttf", ".ico"})
    for asset in data["assets"].values():
        if not isinstance(asset, dict):
            raise ValueError("素材条目必须是对象")
        src = asset.get("src")
        if isinstance(src, str) and src:
            ref = local_ref(src)
            if ref:
                files.add(ref)
    # 继续保留 HTML/CSS 的静态图形、字体等依赖，不只猜 assets/ 目录。
    pending = list(files)
    checked: set[PurePosixPath] = set()
    while pending:
        ref = pending.pop()
        if ref in checked:
            continue
        checked.add(ref)
        path = game_dir.joinpath(*ref.parts)
        if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(game_dir.resolve()):
            raise ValueError(f"作品资源缺失或路径不安全：{ref}")
        if ref.suffix.lower() not in {".html", ".css"}:
            continue
        for match in REFS.finditer(path.read_text(encoding="utf-8-sig")):
            value = match.group(1) or match.group(2)
            if value.startswith(("#", "http:", "https:", "//", "javascript:", "mailto:")):
                continue  # 页面按钮的外部链接不是随包依赖。
            nested = local_ref(value)
            if nested:
                nested = ref.parent / nested
                if nested not in files:
                    files.add(nested)
                    pending.append(nested)
    return files


def payload_plan(source: Path, game_dir: Path) -> dict[str, Path]:
    plan: dict[str, Path] = {}
    for relative in CODE_DIRS:
        folder = source / relative
        if not folder.exists() and relative == "content/vn_plugins":
            continue
        if not folder.is_dir():
            raise ValueError(f"后端目录缺失：{relative}")
        for path in folder.rglob("*"):
            rel = PurePosixPath(path.relative_to(source).as_posix())
            if not allowed_path(rel) or not path.is_file():
                continue
            if path.is_symlink() or not path.resolve().is_relative_to(source.resolve()):
                raise ValueError(f"后端文件越界：{rel}")
            plan[f"galLingS/{rel}"] = path
    for name in PUBLIC_FILES:
        path = source / name
        if path.is_file():
            plan[f"galLingS/{name}"] = path
    for required in ("galLingS/server/__main__.py", "galLingS/requirements.txt", "galLingS/config.example.yaml"):
        if required not in plan:
            raise ValueError(f"后端入口缺失：{required}")
    for ref in game_files(game_dir):
        plan[f"galLingS/{GAME_NAME}/{ref}"] = game_dir.joinpath(*ref.parts)
    return dict(sorted(plan.items()))


def describe_plan(plan: dict[str, Path], source: Path) -> dict:
    return {
        "format": "gallings.windows-portable/1",
        "game": GAME_NAME,
        "player": "official-vnstudio",
        "rebuildIncluded": False,
        "nnnVideosIncluded": False,
        "nnnLive2DIncluded": False,
        "fileCount": len(plan),
        "bytes": sum(p.stat().st_size for p in plan.values()),
        "files": [{"path": name, "bytes": p.stat().st_size,
                   "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                  for name, p in plan.items()],
    }


def extract_python(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            path = PurePosixPath(item.filename.replace("\\", "/"))
            if path.is_absolute() or ".." in path.parts or any(":" in part for part in path.parts):
                raise ValueError("Python 压缩包存在越界文件")
            if ((item.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("Python 压缩包不接受符号链接")
        z.extractall(destination)
    if not (destination / "python.exe").is_file():
        raise ValueError("Python 压缩包不是 Windows 嵌入式运行时")


def remove_local_install_sources(python_dir: Path) -> int:
    """移除 pip 的本机安装来源；保留版本、许可证和公共下载来源。"""
    site_packages = python_dir / "Lib/site-packages"
    removed = 0
    for metadata in site_packages.glob("*.dist-info/direct_url.json"):
        origin = json.loads(metadata.read_text(encoding="utf-8"))
        if not isinstance(origin, dict) or not isinstance(origin.get("url"), str):
            raise ValueError("Python 安装来源记录格式无效")
        if urllib.parse.urlsplit(origin["url"]).scheme.lower() != "file":
            continue
        record = metadata.with_name("RECORD")
        if record.is_file():
            relative = metadata.relative_to(site_packages).as_posix()
            with record.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.reader(handle))
            retained = [row for row in rows if not row or
                        PurePosixPath(row[0].replace("\\", "/")).as_posix() != relative]
            contents = io.StringIO(newline="")
            csv.writer(contents, lineterminator="\n").writerows(retained)
            with record.open("w", encoding="utf-8", newline="") as handle:
                handle.write(contents.getvalue())
        metadata.unlink()
        removed += 1
    return removed


def install_python(args: argparse.Namespace, out: Path, source: Path) -> None:
    dest = out / "python"
    if args.python_dir:
        prepared = Path(args.python_dir).resolve()
        if not (prepared / "python.exe").is_file():
            raise ValueError("--python-dir 缺少 python.exe")
        shutil.copytree(prepared, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    else:
        if not args.galcore_wheel:
            raise ValueError("新装嵌入式 Python 时必须提供 --galcore-wheel，不自动编译 Rust")
        wheel = Path(args.galcore_wheel).resolve()
        if not wheel.is_file() or "win_amd64" not in wheel.name or wheel.suffix != ".whl":
            raise ValueError("galcore 需要 Windows x64 的 wheel")
        archive = Path(args.python_zip).resolve() if args.python_zip else source / "dist/cache" / f"python-{PY_VERSION}-embed-amd64.zip"
        if not archive.is_file():
            archive.parent.mkdir(parents=True, exist_ok=True)
            temporary = archive.with_suffix(".download")
            urllib.request.urlretrieve(PY_URL, temporary)
            temporary.replace(archive)
        extract_python(archive, dest)
        subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check",
                        "--target", str(dest / "Lib/site-packages"), "--platform", "win_amd64",
                        "--python-version", "3.11", "--implementation", "cp", "--only-binary=:all:",
                        "-r", str(source / "requirements.txt"), str(wheel)], check=True)
    # 两条安装路径都会带入 pip 来源记录；它不参与运行，也不应公开本机目录。
    remove_local_install_sources(dest)
    # 嵌入式 Python 的导入根固定为这个便携包，既不带作者 venv，也不读取系统 site-packages。
    pth_files = list(dest.glob("python*._pth"))
    if len(pth_files) != 1:
        raise ValueError("嵌入式 Python 必须且只能有一个 python*._pth")
    version = pth_files[0].stem
    pth_files[0].write_text(f"{version}.zip\n.\nLib\\site-packages\n..\\galLingS\nimport site\n", encoding="utf-8")
    if sys.platform == "win32":
        subprocess.run([str(dest / "python.exe"), "-c", "import galcore, fastapi, uvicorn, yaml, jsonschema, httpx, websockets"], check=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=str(ROOT), help="仓库根目录")
    parser.add_argument("--game", default="", help="正式作品目录；默认仓库根的海风与布丁")
    parser.add_argument("--exe", default="", help="已编译的当前模块化宿主 exe")
    parser.add_argument("--out", default="", help="新的输出目录，必须不存在")
    parser.add_argument("--plan", default="", help="只输出清单；不下载/安装/构建")
    parser.add_argument("--python-dir", default="", help="已经装好依赖的嵌入式 Windows Python")
    parser.add_argument("--python-zip", default="", help="已下载的官方嵌入式 Python 压缩包")
    parser.add_argument("--galcore-wheel", default="", help="Windows x64 galcore wheel")
    parser.add_argument("--zip", action="store_true")
    args = parser.parse_args(argv)
    source = Path(args.source).resolve()
    game_dir = Path(args.game).resolve() if args.game else source / GAME_NAME
    plan = payload_plan(source, game_dir)
    report = describe_plan(plan, source)
    if args.plan:
        target = Path(args.plan).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"运行资源清单：{target}（{len(plan)} 文件）")
        return 0
    if not args.exe or not Path(args.exe).is_file():
        parser.error("组装便携包需要 --exe；只看清单使用 --plan")
    if not args.python_dir and not args.galcore_wheel:
        parser.error("需要 --python-dir 或 --galcore-wheel")
    out = Path(args.out).resolve() if args.out else source / "dist/windows-app" / GAME_NAME
    if out.exists() or out == source or out in source.parents:
        raise ValueError("输出目录已存在或覆盖仓库，已停止；请选择一个新目录")
    zip_path = out.with_suffix(".zip")
    if args.zip and zip_path.exists():
        raise ValueError("zip 已存在；请选择新目录")
    out.mkdir(parents=True)
    install_python(args, out, source)
    for relative, path in plan.items():
        dest = out.joinpath(*PurePosixPath(relative).parts)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        if hashlib.sha256(dest.read_bytes()).hexdigest() != hashlib.sha256(path.read_bytes()).hexdigest():
            raise ValueError(f"复制后校验失败：{relative}")
    exe = Path(args.exe).resolve()
    shutil.copy2(exe, out / f"{GAME_NAME}.exe")
    loader = exe.with_name("WebView2Loader.dll")
    if loader.is_file():
        shutil.copy2(loader, out / loader.name)
    (out / "galLingS/desktop-runtime.json").write_text(json.dumps({"format": report["format"], "game": GAME_NAME, "player": "official-vnstudio"}, ensure_ascii=False), encoding="utf-8")
    (out / "运行资源清单.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    debug = '@echo off\nchcp 65001 >nul\ncd /d "%~dp0galLingS"\n"%~dp0python\\python.exe" -X utf8 -m server --no-browser\npause\n'
    (out / "调试-启动后端.bat").write_bytes(debug.replace("\n", "\r\n").encode("utf-8"))
    if args.zip:
        shutil.make_archive(str(out), "zip", root_dir=out.parent, base_dir=out.name)
    print(f"正式播放器完整便携包：{out}（资源已逐文件核对；未编译 Rust）")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"构建未完成：{error}", file=sys.stderr)
        raise SystemExit(1)
