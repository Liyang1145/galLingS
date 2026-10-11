"""plugin.yaml 解析与校验。

格式权威是 schemas/plugin.schema.json；这里先按 Schema 校验，再做 Schema 表达不了的语义检查
（kind 与 provides 的搭配、入口文件存在、版本范围可解析等）。
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import jsonschema
import yaml
from packaging.specifiers import InvalidSpecifier, SpecifierSet
from packaging.version import Version

from .errors import ManifestError

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "schemas" / "plugin.schema.json"
MANIFEST_NAME = "plugin.yaml"


@lru_cache(maxsize=1)
def plugin_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class SecretSpec:
    name: str
    env: str
    required: bool = False
    description: str = ""


@dataclass(frozen=True)
class Manifest:
    """校验通过的清单。``raw`` 保留原始字典，``sha256`` 是规范化 JSON 的哈希（写进事件日志头）。"""

    id: str
    name: str
    version: Version
    kind: str
    api: int
    runtime: dict[str, Any]
    root: Path
    raw: dict[str, Any] = field(repr=False)
    sha256: str = ""
    description: str = ""
    capabilities: frozenset[str] = frozenset()
    provides_tools: tuple[str, ...] = ()
    requires_gallings: SpecifierSet | None = None
    requires_python: SpecifierSet | None = None
    requires_plugins: dict[str, SpecifierSet] = field(default_factory=dict)
    config_schema: dict[str, Any] | None = None
    secrets: tuple[SecretSpec, ...] = ()
    permissions: dict[str, Any] = field(default_factory=dict)
    determinism: str = "recorded"

    @property
    def runtime_type(self) -> str:
        return self.runtime["type"]

    def summary(self) -> dict[str, Any]:
        return {"id": self.id, "version": str(self.version), "kind": self.kind, "api": self.api,
                "runtime": self.runtime_type, "manifest_sha256": self.sha256}


def _spec(value: str, what: str, pid: str) -> SpecifierSet:
    try:
        return SpecifierSet(value)
    except InvalidSpecifier as e:
        raise ManifestError(f"{what} 版本范围不合法：{value!r}（{e}）", pid) from None


def canonical_hash(data: Any) -> str:
    blob = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def parse_manifest(data: dict[str, Any], root: Path) -> Manifest:
    """校验一个已读入的清单字典。root 是插件目录。"""
    if not isinstance(data, dict):
        raise ManifestError(f"{root / MANIFEST_NAME} 顶层必须是映射")
    pid = data.get("id") if isinstance(data.get("id"), str) else None
    validator = jsonschema.Draft202012Validator(plugin_schema())
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
    if errors:
        lines = [f"{'/'.join(map(str, e.absolute_path)) or '<根>'}: {e.message}" for e in errors[:8]]
        raise ManifestError("清单不符合 schemas/plugin.schema.json：\n  " + "\n  ".join(lines), pid)

    kind = data["kind"]
    provides = (data.get("provides") or {}).get("tools") or []
    if kind == "tool" and not provides:
        raise ManifestError("kind=tool 必须在 provides.tools 里列出导出的工具名", pid)
    if kind != "tool" and provides:
        raise ManifestError(f"只有 kind=tool 可以写 provides.tools（当前 kind={kind}）", pid)

    rt = data["runtime"]
    if rt["type"] == "python":
        rel = rt["entry"].split(":", 1)[0]
        path = (root / rel).resolve()
        if root.resolve() not in path.parents:
            raise ManifestError(f"入口文件必须在插件目录内：{rel}", pid)
        if not path.is_file():
            raise ManifestError(f"入口文件不存在：{rel}", pid)
    elif rt["type"] == "mcp" and kind != "tool":
        # 其它 kind 需要接口语义映射：用 python 运行时写薄适配器，内部用 server.plugins.mcp.MCPClient
        raise ManifestError(f"runtime.type=mcp 目前只支持 kind=tool（当前 kind={kind}）；"
                            "其它 kind 请用 python 运行时并在内部用 MCPClient", pid)

    cfg_schema = data.get("config_schema")
    if cfg_schema is not None:
        try:
            jsonschema.Draft202012Validator.check_schema(cfg_schema)
        except jsonschema.SchemaError as e:
            raise ManifestError(f"config_schema 本身不是合法 JSON Schema：{e.message}", pid) from None

    secrets = tuple(SecretSpec(s["name"], s["env"], bool(s.get("required", False)), s.get("description", ""))
                    for s in data.get("secrets") or [])
    names = [s.name for s in secrets]
    if len(names) != len(set(names)):
        raise ManifestError("secrets 里有重名项", pid)

    req = data.get("requires") or {}
    return Manifest(
        id=data["id"], name=data["name"], version=Version(data["version"]), kind=kind, api=data["api"],
        runtime=dict(rt), root=root, raw=data, sha256=canonical_hash(data),
        description=data.get("description", ""),
        capabilities=frozenset(data.get("capabilities") or []),
        provides_tools=tuple(provides),
        requires_gallings=_spec(req["gallings"], "requires.gallings", pid) if "gallings" in req else None,
        requires_python=_spec(req["python"], "requires.python", pid) if "python" in req else None,
        requires_plugins={k: _spec(v, f"requires.plugins.{k}", pid) for k, v in (req.get("plugins") or {}).items()},
        config_schema=cfg_schema, secrets=secrets, permissions=dict(data.get("permissions") or {}),
        determinism=data.get("determinism", "recorded"),
    )


def load_manifest(plugin_dir: str | Path) -> Manifest:
    root = Path(plugin_dir)
    path = root / MANIFEST_NAME
    if not path.is_file():
        raise ManifestError(f"缺少 {path}")
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise ManifestError(f"{path} 不是合法 YAML：{e}") from None
    return parse_manifest(data, root)
