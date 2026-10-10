"""插件命令行。

  python -m server.plugins validate <插件目录>...       校验清单（+ python 入口能否导入、是否实现接口）
  python -m server.plugins list [--path DIR]...         列出发现的插件
  python -m server.plugins check --config config.yaml   按配置启动全部插件、打印报告与插件锁，然后关闭
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import tempfile
from pathlib import Path

import yaml

from .errors import PluginError
from .loader import load_class
from .manager import PluginManager, PluginSettings
from .manifest import load_manifest

DEFAULT_PATHS = ["plugins/builtin"]


def cmd_validate(args) -> int:
    bad = 0
    for d in args.dirs:
        try:
            m = load_manifest(d)
            if m.runtime_type == "python":
                load_class(m)
            print(f"OK   {m.id} {m.version} ({m.kind}, {m.runtime_type})")
        except PluginError as e:
            bad += 1
            print(f"FAIL {d}: {e}")
    return 1 if bad else 0


def cmd_list(args) -> int:
    mgr = PluginManager(PluginSettings(paths=[Path(p) for p in (args.path or DEFAULT_PATHS)]), Path("."))
    found = mgr.discover()
    for pid, m in sorted(found.items()):
        print(f"{pid:36} {str(m.version):8} {m.kind:9} {m.runtime_type:6} {m.name}")
    for e in mgr.discovery_errors:
        print("ERR ", e, file=sys.stderr)
    return 1 if mgr.discovery_errors else 0


def cmd_check(args) -> int:
    cfg_path = Path(args.config)
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    settings = PluginSettings.from_dict(cfg.get("plugins"), base_dir=cfg_path.parent)

    async def run() -> int:
        with tempfile.TemporaryDirectory() as tmp:
            mgr = PluginManager(settings, Path(args.data_dir or tmp))
            try:
                report = await mgr.start()
                print(json.dumps({"report": report, "lock": mgr.lock()}, ensure_ascii=False, indent=2))
                return 1 if mgr.failed() or report["discovery_errors"] else 0
            finally:
                await mgr.stop()

    return asyncio.run(run())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m server.plugins")
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate"); v.add_argument("dirs", nargs="+"); v.set_defaults(fn=cmd_validate)
    li = sub.add_parser("list"); li.add_argument("--path", action="append"); li.set_defaults(fn=cmd_list)
    c = sub.add_parser("check"); c.add_argument("--config", required=True); c.add_argument("--data-dir")
    c.set_defaults(fn=cmd_check)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
