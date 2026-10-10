"""python -m compiler content/scripts/ch01 [--appendix 附录E.md]

读取目录下的 <chapter>.md 与 beats.yaml，写出 chapter.json 与 report.md。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .compile import CompileError, canonical, compile_chapter


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m compiler")
    ap.add_argument("chapter_dir", type=Path)
    ap.add_argument("--appendix", type=Path, default=None, help="附录 E（制作 ID 登记表）所在文件")
    a = ap.parse_args(argv)
    d: Path = a.chapter_dir
    scripts = [p for p in d.glob("*.md") if p.name not in ("report.md", "README.md")]
    if len(scripts) != 1:
        print(f"{d} 下应恰好有一个剧本 .md，找到 {[p.name for p in scripts]}", file=sys.stderr)
        return 2
    try:
        ch, report = compile_chapter(scripts[0], d / "beats.yaml", a.appendix)
    except CompileError as e:
        print(f"编译失败：{e}", file=sys.stderr)
        return 1
    (d / "chapter.json").write_text(canonical(ch) + "\n", encoding="utf-8", newline="\n")
    (d / "report.md").write_text(report, encoding="utf-8", newline="\n")
    sys.stdout.reconfigure(encoding="utf-8")  # Windows 控制台
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
