"""插件系统的错误类型。所有错误都带插件 id，便于在调试时间轴和启动报告里定位。"""
from __future__ import annotations


class PluginError(Exception):
    """插件系统基础错误。"""

    def __init__(self, message: str, plugin_id: str | None = None) -> None:
        self.plugin_id = plugin_id
        super().__init__(f"[{plugin_id}] {message}" if plugin_id else message)


class ManifestError(PluginError):
    """plugin.yaml 不合法（Schema、语义、文件缺失）。"""


class CompatibilityError(PluginError):
    """引擎版本、kind 接口版本、Python 版本或插件依赖不满足。"""


class LoadError(PluginError):
    """入口无法导入，或入口类没有实现该 kind 的接口。"""


class ConfigError(PluginError):
    """config.yaml 里给插件的配置不合法，或缺少必填密钥。"""


class SelectionError(PluginError):
    """config.yaml 的选择段引用了不存在 / 未启用 / 类型不符的插件。"""


class MCPError(PluginError):
    """MCP 子进程启动、握手或调用失败。"""
