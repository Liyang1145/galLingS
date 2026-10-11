"""插件管理器：发现 → 校验 → 兼容性 → 按配置选用 → 依赖排序 → 启动 → 路由 → 关闭。

config.yaml 里的 ``plugins`` 段（见 docs/plugin-format.md §5）::

    plugins:
      paths: [plugins/builtin, ~/.gallings/plugins]
      select:                       # 单例 kind：写一个 id，或按优先级写列表（后面的是降级备选）
        llm: [gallings.llm.openai-compat, gallings.llm.scripted]
        memory: gallings.memory.lingshu
      tools: [gallings.tool.dice]   # 多例 kind：全部启用
      guards: []
      importers: []
      config:
        gallings.llm.openai-compat: {base_url: https://api.deepseek.com, model: deepseek-chat}
"""
from __future__ import annotations

import logging
import platform
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

import jsonschema
from packaging.version import Version

from ..version import ENGINE_VERSION
from .context import EmitFn, PluginContext, Secrets
from .errors import (CompatibilityError, ConfigError, LoadError, ManifestError, PluginError,
                     SelectionError)
from .kinds import KIND_API, Plugin, ToolPlugin, ToolResult, ToolSpec
from .loader import instantiate
from .manifest import MANIFEST_NAME, Manifest, canonical_hash, load_manifest

log = logging.getLogger("gallings.plugins")

SINGLE_KINDS = ("llm", "image", "tts", "memory")       # 每种同一时刻只用一个（可带降级备选）
MULTI_KINDS = {"tools": "tool", "guards": "guard", "importers": "importer"}  # 全部启用


@dataclass
class PluginSettings:
    paths: list[Path] = field(default_factory=list)
    select: dict[str, list[str]] = field(default_factory=dict)
    multi: dict[str, list[str]] = field(default_factory=dict)  # kind -> ids
    config: dict[str, dict[str, Any]] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any] | None, base_dir: Path | None = None) -> "PluginSettings":
        d = d or {}
        base = base_dir or Path.cwd()
        unknown = set(d) - {"paths", "select", "config", *MULTI_KINDS}
        if unknown:
            raise ConfigError(f"plugins 段有未知键：{sorted(unknown)}")
        paths = []
        for p in d.get("paths") or []:
            pp = Path(str(p)).expanduser()
            paths.append(pp if pp.is_absolute() else (base / pp))
        select: dict[str, list[str]] = {}
        for kind, v in (d.get("select") or {}).items():
            if kind not in SINGLE_KINDS:
                raise ConfigError(f"select 只能用于 {SINGLE_KINDS}，{kind!r} 请写在 tools/guards/importers")
            select[kind] = [v] if isinstance(v, str) else list(v or [])
        multi = {MULTI_KINDS[k]: list(d.get(k) or []) for k in MULTI_KINDS}
        return cls(paths, select, multi, {k: dict(v or {}) for k, v in (d.get("config") or {}).items()})


@dataclass
class PluginState:
    manifest: Manifest
    status: str = "discovered"  # discovered | enabled | running | failed | stopped
    error: str | None = None
    instance: Plugin | None = None
    config: dict[str, Any] = field(default_factory=dict)


class PluginManager:
    def __init__(self, settings: PluginSettings, data_root: Path, emit: EmitFn | None = None,
                 engine_version: str = ENGINE_VERSION, environ: dict[str, str] | None = None) -> None:
        self.settings = settings
        self.data_root = Path(data_root)
        self.emit: EmitFn = emit or (lambda _t, _p: None)
        self.engine_version = Version(engine_version)
        self.environ = environ
        self.states: dict[str, PluginState] = {}
        self.discovery_errors: list[str] = []
        self._order: list[str] = []
        self._tool_owner: dict[str, str] = {}

    # ------------------------------------------------------------------ 发现
    def discover(self) -> dict[str, Manifest]:
        """扫描 paths 下每个含 plugin.yaml 的子目录。坏清单不中断扫描，记进 discovery_errors。"""
        found: dict[str, Manifest] = {}
        for root in self.settings.paths:
            if not root.is_dir():
                continue
            for d in sorted(p for p in root.iterdir() if (p / MANIFEST_NAME).is_file()):
                try:
                    m = load_manifest(d)
                except ManifestError as e:
                    self.discovery_errors.append(f"{d}: {e}")
                    continue
                if m.id in found:
                    self.discovery_errors.append(
                        f"插件 id 重复：{m.id}（{found[m.id].root} 与 {d}），保留前者")
                    continue
                found[m.id] = m
        self.states = {pid: PluginState(m) for pid, m in found.items()}
        return found

    # ------------------------------------------------------------------ 兼容性
    def check_compat(self, m: Manifest) -> None:
        if KIND_API.get(m.kind) != m.api:
            raise CompatibilityError(f"kind={m.kind} 接口主版本不符：清单 {m.api}，引擎 {KIND_API.get(m.kind)}", m.id)
        if m.requires_gallings is not None and self.engine_version not in m.requires_gallings:
            raise CompatibilityError(f"需要引擎 {m.requires_gallings}，当前 {self.engine_version}", m.id)
        if m.requires_python is not None and Version(platform.python_version()) not in m.requires_python:
            raise CompatibilityError(f"需要 Python {m.requires_python}，当前 {platform.python_version()}", m.id)

    # ------------------------------------------------------------------ 选用
    def wanted(self) -> list[str]:
        """配置点名的插件 + 它们的传递依赖。"""
        ids: list[str] = []
        for kind, chain in self.settings.select.items():
            for pid in chain:
                self._expect(pid, kind)
                ids.append(pid)
        for kind, lst in self.settings.multi.items():
            for pid in lst:
                self._expect(pid, kind)
                ids.append(pid)
        stack, seen = list(dict.fromkeys(ids)), set()
        while stack:
            pid = stack.pop()
            if pid in seen:
                continue
            seen.add(pid)
            m = self.states[pid].manifest
            for dep, spec in m.requires_plugins.items():
                if dep not in self.states:
                    raise CompatibilityError(f"依赖的插件 {dep} 不存在", pid)
                if self.states[dep].manifest.version not in spec:
                    raise CompatibilityError(
                        f"依赖 {dep}{spec}，实际 {self.states[dep].manifest.version}", pid)
                stack.append(dep)
        return self._toposort(seen)

    def _expect(self, pid: str, kind: str) -> None:
        st = self.states.get(pid)
        if st is None:
            raise SelectionError(f"配置引用的插件不存在：{pid}（可用：{sorted(self.states)}）")
        if st.manifest.kind != kind:
            raise SelectionError(f"{pid} 的 kind 是 {st.manifest.kind}，不能用作 {kind}")

    def _toposort(self, ids: Iterable[str]) -> list[str]:
        ids = sorted(ids)
        order, temp, done = [], set(), set()

        def visit(pid: str, path: list[str]) -> None:
            if pid in done:
                return
            if pid in temp:
                raise CompatibilityError("插件依赖成环：" + " → ".join(path + [pid]))
            temp.add(pid)
            for dep in sorted(self.states[pid].manifest.requires_plugins):
                visit(dep, path + [pid])
            temp.discard(pid)
            done.add(pid)
            order.append(pid)

        for pid in ids:
            visit(pid, [])
        return order

    # ------------------------------------------------------------------ 配置
    def resolve_config(self, m: Manifest) -> dict[str, Any]:
        cfg = dict(self.settings.config.get(m.id) or {})
        if m.config_schema is not None:
            # 先用 Schema 的 default 填缺省值（只处理顶层 properties），再校验
            for k, prop in (m.config_schema.get("properties") or {}).items():
                if k not in cfg and isinstance(prop, dict) and "default" in prop:
                    cfg[k] = prop["default"]
            errs = list(jsonschema.Draft202012Validator(m.config_schema).iter_errors(cfg))
            if errs:
                raise ConfigError("配置不合法：" + "；".join(
                    f"{'/'.join(map(str, e.absolute_path)) or '<根>'}: {e.message}" for e in errs[:5]), m.id)
        elif cfg:
            raise ConfigError("清单没有 config_schema，却在 config.yaml 里给了配置", m.id)
        return cfg

    # ------------------------------------------------------------------ 启动 / 关闭
    async def start(self) -> dict[str, Any]:
        if not self.states:
            self.discover()
        self._order = self.wanted()
        for pid in self._order:
            st = self.states[pid]
            m = st.manifest
            try:
                self.check_compat(m)
                st.config = self.resolve_config(m)
                secrets = Secrets(pid, m.secrets, self.environ)
                missing = secrets.missing_required()
                if missing:
                    raise ConfigError(f"缺少必填密钥环境变量：{missing}", pid)
                failed_deps = [d for d in m.requires_plugins if self.states[d].status != "running"]
                if failed_deps:
                    raise CompatibilityError(f"依赖未就绪：{failed_deps}", pid)
                data_dir = self.data_root / "plugins" / pid
                data_dir.mkdir(parents=True, exist_ok=True)
                ctx = PluginContext(
                    plugin_id=pid, config=st.config, secrets=secrets, data_dir=data_dir, plugin_dir=m.root,
                    log=logging.getLogger(f"gallings.plugin.{pid}"),
                    emit=self._emitter(pid),
                    deps={d: self.states[d].instance for d in m.requires_plugins})
                st.status = "enabled"
                inst = instantiate(m, ctx)
                try:
                    await inst.setup()
                except BaseException:
                    # setup 半途失败也要释放已拉起的资源（子进程、连接）
                    try:
                        await inst.close()
                    except Exception:
                        log.exception("插件 setup 失败后 close 异常：%s", pid)
                    raise
                st.instance, st.status, st.error = inst, "running", None
                self.emit("plugin.started", {**m.summary(), "config_sha256": canonical_hash(st.config)})
            except PluginError as e:
                st.status, st.error = "failed", str(e)
                log.warning("插件启动失败：%s", e)
                self.emit("plugin.failed", {"id": pid, "error": str(e)})
            except Exception as e:  # setup() 里插件自己的异常
                st.status, st.error = "failed", f"{type(e).__name__}: {e}"
                log.exception("插件 setup 异常：%s", pid)
                self.emit("plugin.failed", {"id": pid, "error": st.error})
        await self._index_tools()
        return self.report()

    def _emitter(self, pid: str) -> EmitFn:
        def emit(event_type: str, payload: dict[str, Any]) -> None:
            self.emit(f"plugin.{pid}.{event_type}", payload)
        return emit

    async def _index_tools(self) -> None:
        self._tool_owner.clear()
        for pid in self.settings.multi.get("tool", []):
            st = self.states[pid]
            if st.status != "running":
                continue
            assert isinstance(st.instance, ToolPlugin)
            specs = await st.instance.list_tools()
            names = [s.name for s in specs]
            if set(names) != set(st.manifest.provides_tools):
                st.status, st.error = "failed", (f"list_tools() 与清单 provides.tools 不一致："
                                                 f"{sorted(names)} vs {sorted(st.manifest.provides_tools)}")
                continue
            for n in names:
                if n in self._tool_owner:
                    st.status, st.error = "failed", f"工具名冲突：{n} 已由 {self._tool_owner[n]} 提供"
                    break
            else:
                for n in names:
                    self._tool_owner[n] = pid

    async def stop(self) -> None:
        for pid in reversed(self._order):
            st = self.states[pid]
            if st.instance is not None and st.status == "running":
                try:
                    await st.instance.close()
                except Exception:  # 关闭失败不影响其它插件
                    log.exception("插件 close 异常：%s", pid)
                st.status = "stopped"

    async def __aenter__(self) -> "PluginManager":
        await self.start()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.stop()

    # ------------------------------------------------------------------ 取用
    def chain(self, kind: str) -> list[Plugin]:
        """单例 kind 的可用实例，按配置优先级排列（第一个是主用，其余为降级备选）。"""
        if kind not in SINGLE_KINDS:
            raise SelectionError(f"{kind} 不是单例 kind，用 all({kind!r})")
        return [self.states[p].instance for p in self.settings.select.get(kind, [])
                if self.states[p].status == "running" and self.states[p].instance is not None]

    def get(self, kind: str) -> Plugin | None:
        c = self.chain(kind)
        return c[0] if c else None

    def all(self, kind: str) -> list[Plugin]:
        return [self.states[p].instance for p in self.settings.multi.get(kind, [])
                if self.states[p].status == "running" and self.states[p].instance is not None]

    async def tool_specs(self) -> list[ToolSpec]:
        out: list[ToolSpec] = []
        for inst in self.all("tool"):
            out.extend(await inst.list_tools())
        return out

    async def call_tool(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        pid = self._tool_owner.get(name)
        if pid is None:
            return ToolResult(False, error=f"未知工具：{name}")
        inst = self.states[pid].instance
        assert isinstance(inst, ToolPlugin)
        res = await inst.call(name, arguments, turn)
        # 工具调用全部进调试时间轴（PLAN §11.1）；裁决由引擎另行记录
        self.emit("tool.called", {"plugin": pid, "tool": name, "arguments": arguments, "ok": res.ok,
                                  "proposals": res.proposals, "error": res.error})
        return res

    # ------------------------------------------------------------------ 报告 / 锁
    def report(self) -> dict[str, Any]:
        return {
            "engine": str(self.engine_version),
            "plugins": {pid: {"status": st.status, "kind": st.manifest.kind,
                              "version": str(st.manifest.version), "error": st.error}
                        for pid, st in sorted(self.states.items())},
            "discovery_errors": list(self.discovery_errors),
            "tools": dict(sorted(self._tool_owner.items())),
        }

    def lock(self) -> dict[str, Any]:
        """写进事件日志头的插件锁：回放时用来确认插件集合与配置一致（PLAN §4）。"""
        running = [pid for pid in self._order if self.states[pid].status == "running"]
        entries = [{**self.states[p].manifest.summary(),
                    "config_sha256": canonical_hash(self.states[p].config)} for p in running]
        return {"engine": str(self.engine_version), "plugins": entries,
                "select": {k: [p for p in v if p in running] for k, v in self.settings.select.items()},
                "lock_sha256": canonical_hash(entries)}

    def failed(self) -> dict[str, str]:
        return {pid: st.error or "" for pid, st in self.states.items() if st.status == "failed"}
