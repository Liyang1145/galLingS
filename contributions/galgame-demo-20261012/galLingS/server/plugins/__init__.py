"""galLingS 统一插件系统。格式说明见 docs/plugin-format.md，清单 Schema 见 schemas/plugin.schema.json。"""
from .context import PluginContext, Secrets
from .errors import (CompatibilityError, ConfigError, LoadError, ManifestError, MCPError, PluginError,
                     SelectionError)
from .kinds import (KIND_API, ChatMessage, ChatRequest, Error, GuardPlugin, GuardVerdict, ImagePlugin,
                    ImageRequest, ImageResult, ImporterPlugin, LLMEvent, LLMPlugin, MemoryHit, MemoryPlugin,
                    MemoryRecord, Plugin, SpeechRequest, SpeechResult, TextDelta, Timeline, ToolCallDelta,
                    ToolCallDone, ToolPlugin, ToolResult, ToolSpec, TTSPlugin, Usage)
from .manager import PluginManager, PluginSettings
from .manifest import Manifest, load_manifest, parse_manifest

__all__ = [n for n in dir() if not n.startswith("_")]
