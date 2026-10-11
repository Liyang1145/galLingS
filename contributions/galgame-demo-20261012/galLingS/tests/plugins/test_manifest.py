from __future__ import annotations

import pytest

from server.plugins import ManifestError, load_manifest
from server.plugins.manifest import parse_manifest

from .conftest import BUILTIN, GUARD_CODE, base_manifest, write_plugin


@pytest.mark.parametrize("d", sorted(p for p in BUILTIN.iterdir() if (p / "plugin.yaml").exists()))
def test_builtin_manifests_valid(d):
    m = load_manifest(d)
    assert m.sha256 and len(m.sha256) == 64
    assert m.id.split(".")[1] == m.kind  # 内置插件命名约定：<作者>.<kind>.<名字>


def test_hash_is_stable(plugin_root):
    d = write_plugin(plugin_root, "g", base_manifest("t.guard.g"), GUARD_CODE)
    assert load_manifest(d).sha256 == load_manifest(d).sha256


@pytest.mark.parametrize("patch, msg", [
    ({"id": "Bad_ID"}, "id"),
    ({"id": "two.parts"}, "id"),
    ({"version": "1.0"}, "version"),
    ({"kind": "renderer"}, "kind"),
    ({"schema_version": 2}, "schema_version"),
    ({"unknown_key": 1}, "unknown_key"),
    ({"runtime": {"type": "python", "entry": "plugin:P"}}, "runtime"),
    ({"secrets": [{"name": "k", "env": "lowercase"}]}, "secrets"),
])
def test_schema_rejects(plugin_root, patch, msg):
    m = base_manifest("t.guard.g")
    m.update(patch)
    d = write_plugin(plugin_root, "g", m, GUARD_CODE)
    with pytest.raises(ManifestError, match=msg):
        load_manifest(d)


def test_tool_requires_provides(plugin_root):
    d = write_plugin(plugin_root, "t", base_manifest("t.tool.x", kind="tool"), "")
    with pytest.raises(ManifestError, match="provides.tools"):
        load_manifest(d)


def test_provides_only_for_tool(plugin_root):
    d = write_plugin(plugin_root, "g", base_manifest("t.guard.g", provides={"tools": ["a"]}), GUARD_CODE)
    with pytest.raises(ManifestError, match="只有 kind=tool"):
        load_manifest(d)


def test_entry_must_exist_and_stay_inside(plugin_root, tmp_path):
    d = write_plugin(plugin_root, "g", base_manifest("t.guard.g"))
    with pytest.raises(ManifestError, match="入口文件不存在"):
        load_manifest(d)
    (tmp_path / "evil.py").write_text("x=1")
    m = base_manifest("t.guard.g", runtime={"type": "python", "entry": "../../evil.py:P"})
    with pytest.raises(ManifestError, match="插件目录内"):
        parse_manifest(m, d)


def test_mcp_only_for_tool(plugin_root):
    m = base_manifest("t.llm.x", kind="llm", runtime={"type": "mcp", "command": ["x"]})
    d = write_plugin(plugin_root, "x", m)
    with pytest.raises(ManifestError, match="只支持 kind=tool"):
        load_manifest(d)


def test_bad_config_schema_and_version_spec(plugin_root):
    d = write_plugin(plugin_root, "g", base_manifest("t.guard.g", config_schema={"type": "nonsense"}), GUARD_CODE)
    with pytest.raises(ManifestError, match="config_schema"):
        load_manifest(d)
    d = write_plugin(plugin_root, "h", base_manifest("t.guard.h", requires={"gallings": "~~1"}), GUARD_CODE)
    with pytest.raises(ManifestError, match="版本范围"):
        load_manifest(d)
