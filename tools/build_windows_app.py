"""把作品 + galLingS 后端 + 自带 Python 打成 Windows 免安装游戏程序（文件夹，双击 exe 就玩）。

    python tools/build_windows_app.py --exe path/to/gallings-desktop.exe
    python tools/build_windows_app.py --exe ... --galcore-wheel wheels/galcore-0.1.0-cp311-abi3-win_amd64.whl
    python tools/build_windows_app.py --exe ... --zip            # 顺便打 zip

输出（默认 dist/windows-app/<作品名>/）：

    <作品名>.exe            Tauri 外壳（desktop/）：起后端、开窗口，关窗口时后端一起退出
    python/                Windows 嵌入式 Python 3.11 + requirements.txt 依赖 + galcore 轮子
    galLingS/              server/ compiler/ plugins/ web/ schemas/ content/ 配置 —— 和仓库同样的布局，
                           插件、作品、角色卡照旧往这里放（扩展性不变）
    调试-用控制台启动后端.bat  出问题时看后端报错用

不带 content/assets（2 GB 素材库，只有独立聊天页用）；要带加 --with-art-library。
在 Linux 上交叉打包：Python 依赖用 pip --platform win_amd64 下载，galcore 用
`maturin build --target x86_64-pc-windows-gnu --features python,pyo3/generate-import-lib` 编。
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

PY_VER = "3.11.9"
PY_URL = f"https://www.python.org/ftp/python/{PY_VER}/python-{PY_VER}-embed-amd64.zip"
# 仓库里后端运行要用的东西（和 start.bat 起的完全一样）
COPY_DIRS = ["server", "compiler", "plugins", "web", "schemas", "content"]
COPY_FILES = ["config.example.yaml", "config.galagent.example.yaml", "requirements.txt", "README.md", "LICENSE"]
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", ".gitignore")

PTH = """python311.zip
.
Lib\\site-packages
..\\galLingS
import site
"""

DEBUG_BAT = """@echo off
rem 用控制台启动 galLingS 后端（平时不用：双击 {exe} 就会自己在后台启动）。
rem 游戏打不开、AI 没反应时，先关掉游戏，再双击这个文件看报错。
chcp 65001 >nul
cd /d "%~dp0galLingS"
"%~dp0python\\python.exe" -X utf8 -m server
pause
"""


def fetch_python(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    z = cache / f"python-{PY_VER}-embed-amd64.zip"
    if not z.is_file():
        print(f"下载 {PY_URL}")
        urllib.request.urlretrieve(PY_URL, z)
    return z


def build_galcore_wheel(out: Path) -> Path:
    cmd = ["maturin", "build", "--release", "--out", str(out)]
    if sys.platform != "win32":
        cmd += ["--target", "x86_64-pc-windows-gnu", "--features", "python,pyo3/generate-import-lib"]
    subprocess.run(cmd, cwd=ROOT / "core", check=True)
    return next(out.glob("galcore-*win_amd64.whl"))


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    from server.runtime import load_config

    cfg = load_config()
    name = str((cfg.get("game") or {}).get("vn_game") or "galLingS")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--exe", required=True, help="desktop/ 编出来的 gallings-desktop.exe")
    ap.add_argument("--out", default=str(ROOT / "dist" / "windows-app" / name))
    ap.add_argument("--galcore-wheel", default="", help="galcore 的 win_amd64 轮子；不给就用 wheels/ 里的，没有就现编")
    ap.add_argument("--with-art-library", action="store_true", help="带上 content/assets 素材库（约 2 GB）")
    ap.add_argument("--zip", action="store_true", help="再打一个 zip（和输出文件夹同名）")
    a = ap.parse_args(argv)

    out = Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    (out / "python").mkdir(parents=True)

    # 1. 嵌入式 Python
    with zipfile.ZipFile(fetch_python(ROOT / "dist" / "cache")) as z:
        z.extractall(out / "python")
    (out / "python" / "python311._pth").write_text(PTH, encoding="utf-8")

    # 2. 依赖 + galcore
    wheel = Path(a.galcore_wheel) if a.galcore_wheel else next(iter(sorted((ROOT / "wheels").glob("galcore-*win_amd64.whl"))), None)
    if wheel is None:
        wheel = build_galcore_wheel(ROOT / "wheels")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check",
                    "--target", str(out / "python" / "Lib" / "site-packages"),
                    "--platform", "win_amd64", "--python-version", "3.11", "--implementation", "cp",
                    "--only-binary=:all:", "-r", str(ROOT / "requirements.txt"), str(wheel)], check=True)
    shutil.rmtree(out / "python" / "Lib" / "site-packages" / "bin", ignore_errors=True)

    # 3. galLingS 本体（和仓库同样布局）
    gl = out / "galLingS"
    for d in COPY_DIRS:
        ignore = IGNORE
        if d == "content" and not a.with_art_library:
            ignore = lambda src, names: set(IGNORE(src, names)) | ({"assets"} if Path(src) == ROOT / "content" else set())  # noqa: E731
        shutil.copytree(ROOT / d, gl / d, ignore=ignore)
    for f in COPY_FILES:
        if (ROOT / f).is_file():
            shutil.copy2(ROOT / f, gl / f)
    # 不带本机的 config.yaml（可能有私人设置）：程序用 config.example.yaml，玩家改的设置存在 %USERPROFILE%\\.gallings
    (gl / "content" / "assets").mkdir(exist_ok=True)

    # 4. 外壳 + 调试脚本
    exe_name = f"{name}.exe"
    shutil.copy2(a.exe, out / exe_name)
    # MinGW 交叉编译的外壳要带 WebView2Loader.dll（MSVC 编的是静态链接，没有这个文件）
    loader = Path(a.exe).with_name("WebView2Loader.dll")
    if loader.is_file():
        shutil.copy2(loader, out / loader.name)
    (out / "调试-用控制台启动后端.bat").write_bytes(DEBUG_BAT.format(exe=exe_name).replace("\n", "\r\n").encode("utf-8"))

    n = sum(1 for p in out.rglob("*") if p.is_file())
    mb = sum(p.stat().st_size for p in out.rglob("*") if p.is_file()) / 1e6
    print(f"Windows 程序：{out}（{n} 个文件，{mb:.1f} MB）")
    if a.zip:
        z = shutil.make_archive(str(out), "zip", root_dir=out.parent, base_dir=out.name)
        print(f"zip：{z}（{Path(z).stat().st_size / 1e6:.1f} MB）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
