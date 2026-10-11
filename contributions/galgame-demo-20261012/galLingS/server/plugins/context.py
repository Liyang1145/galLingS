"""交给插件的运行上下文：配置、声明过的密钥、数据目录、日志、事件出口。"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .errors import ConfigError
from .manifest import SecretSpec

EmitFn = Callable[[str, dict[str, Any]], None]


class Secrets:
    """只读密钥视图：只能取清单里声明过的项，值只从环境变量读，``repr`` 不泄露。"""

    def __init__(self, plugin_id: str, specs: tuple[SecretSpec, ...], environ: dict[str, str] | None = None):
        self._pid = plugin_id
        self._specs = {s.name: s for s in specs}
        self._env = os.environ if environ is None else environ

    def get(self, name: str) -> str | None:
        spec = self._specs.get(name)
        if spec is None:
            raise ConfigError(f"读取未在清单 secrets 中声明的密钥：{name}", self._pid)
        v = self._env.get(spec.env)
        return v if v else None

    def require(self, name: str) -> str:
        v = self.get(name)
        if v is None:
            raise ConfigError(f"缺少密钥 {name}（环境变量 {self._specs[name].env}）", self._pid)
        return v

    def missing_required(self) -> list[str]:
        return [s.env for s in self._specs.values() if s.required and not self._env.get(s.env)]

    def __repr__(self) -> str:
        return f"<Secrets {self._pid}: {sorted(self._specs)}>"


@dataclass
class PluginContext:
    plugin_id: str
    config: dict[str, Any]
    secrets: Secrets
    data_dir: Path
    plugin_dir: Path
    log: logging.Logger
    #: 写调试时间轴 / 事件日志的出口：emit(event_type, payload)。真正落盘由事件记录器做。
    emit: EmitFn = field(default=lambda _t, _p: None)
    #: 已启动的其它插件（只含清单 requires.plugins 里声明的依赖）
    deps: dict[str, Any] = field(default_factory=dict)
