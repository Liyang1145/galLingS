"""把清单里的入口变成插件类。python 运行时按包导入（插件目录内可用相对导入）。"""
from __future__ import annotations

import importlib
import importlib.util
import inspect
import re
import sys
import types
from typing import Any

from .context import PluginContext
from .errors import LoadError
from .kinds import BASE_CLASS, Plugin
from .manifest import Manifest
from .mcp import MCPToolPlugin

_PKG_ROOT = "_gallings_plugins"


def _package_name(m: Manifest) -> str:
    return f"{_PKG_ROOT}.{re.sub(r'[^a-zA-Z0-9_]', '_', m.id)}"


def _ensure_package(name: str, path: str | None) -> None:
    if name in sys.modules:
        return
    mod = types.ModuleType(name)
    mod.__path__ = [path] if path else []  # type: ignore[attr-defined]
    sys.modules[name] = mod


def load_class(m: Manifest) -> type[Plugin]:
    if m.runtime_type != "python":
        raise LoadError(f"load_class 只处理 python 运行时（当前 {m.runtime_type}）", m.id)
    file_rel, cls_name = m.runtime["entry"].split(":", 1)
    _ensure_package(_PKG_ROOT, None)
    pkg = _package_name(m)
    _ensure_package(pkg, str(m.root.resolve()))
    mod_name = pkg + "." + file_rel[:-3].replace("/", ".")
    try:
        module = importlib.import_module(mod_name)
    except Exception as e:  # 插件代码的任意异常都要包成 LoadError
        raise LoadError(f"导入 {file_rel} 失败：{type(e).__name__}: {e}", m.id) from e
    cls = getattr(module, cls_name, None)
    if not inspect.isclass(cls):
        raise LoadError(f"{file_rel} 里没有类 {cls_name}", m.id)
    base = BASE_CLASS[m.kind]
    if not issubclass(cls, base):
        raise LoadError(f"{cls_name} 必须继承 {base.__module__}.{base.__name__}（kind={m.kind}）", m.id)
    abstract = sorted(getattr(cls, "__abstractmethods__", ()))
    if abstract:
        raise LoadError(f"{cls_name} 没有实现 {m.kind} 接口方法：{abstract}", m.id)
    return cls


def instantiate(m: Manifest, ctx: PluginContext) -> Plugin:
    if m.runtime_type == "mcp":
        return MCPToolPlugin(ctx, m.runtime, m.provides_tools)
    cls = load_class(m)
    try:
        return cls(ctx)
    except Exception as e:
        raise LoadError(f"构造 {cls.__name__} 失败：{type(e).__name__}: {e}", m.id) from e


def unload(m: Manifest) -> None:
    """测试与热重载用：移除插件包的已导入模块。"""
    pkg = _package_name(m)
    for name in [n for n in sys.modules if n == pkg or n.startswith(pkg + ".")]:
        del sys.modules[name]


def describe(obj: Any) -> str:
    return f"{type(obj).__module__}.{type(obj).__name__}"
