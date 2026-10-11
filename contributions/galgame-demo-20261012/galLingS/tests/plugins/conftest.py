from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[2]
BUILTIN = REPO / "plugins" / "builtin"


def write_plugin(root: Path, folder: str, manifest: dict, code: str | None = None, entry_file: str = "plugin.py") -> Path:
    d = root / folder
    d.mkdir(parents=True, exist_ok=True)
    (d / "plugin.yaml").write_text(yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8")
    if code is not None:
        (d / entry_file).write_text(textwrap.dedent(code), encoding="utf-8")
    return d


def base_manifest(pid: str, kind: str = "guard", cls: str = "P", **extra) -> dict:
    m = {"schema_version": 1, "id": pid, "name": pid, "version": "0.1.0", "kind": kind, "api": 1,
         "runtime": {"type": "python", "entry": f"plugin.py:{cls}"}}
    m.update(extra)
    return m


GUARD_CODE = """
from server.plugins import GuardPlugin, GuardVerdict
class P(GuardPlugin):
    async def check(self, stage, text, turn):
        return GuardVerdict(True)
"""


@pytest.fixture
def plugin_root(tmp_path: Path) -> Path:
    r = tmp_path / "plugins"
    r.mkdir()
    return r
