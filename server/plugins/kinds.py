"""各 kind 的接口（插件 API）。

规则：
- 每个 kind 有一个主版本号（KIND_API）。破坏性改动升主版本；清单里 ``api`` 必须等于引擎支持的主版本。
- 插件类继承对应基类，实现标了 @abstractmethod 的方法；加载器会检查。
- 插件**不碰 C++ 核心状态**。会改状态的东西（好感、分支、结局……）一律以"提议"返回，由引擎裁决
  （PLAN §0「模型提议，引擎裁决」、§4 确定性契约）。插件输出由记录器写成事件，回放时不再调用插件。
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, ClassVar, Literal, Union

from .context import PluginContext

KIND_API: dict[str, int] = {
    "llm": 1, "image": 1, "tts": 1, "memory": 1, "tool": 1, "guard": 1, "importer": 1,
}


class Plugin(abc.ABC):
    """所有插件的公共生命周期。由 PluginManager 按 setup → (使用) → close 驱动。"""

    kind: ClassVar[str] = ""

    def __init__(self, ctx: PluginContext) -> None:
        self.ctx = ctx

    async def setup(self) -> None:  # noqa: B027 - 可选覆盖
        """建立连接、拉起子进程等。失败抛异常，管理器会把插件标为 failed。"""

    async def health(self) -> dict[str, Any]:
        """健康检查，返回可序列化字典；``ok`` 为必填键。"""
        return {"ok": True}

    async def close(self) -> None:  # noqa: B027 - 可选覆盖
        """释放资源。必须幂等。"""


# ---------------------------------------------------------------- llm（PLAN §12 五种内部事件）
@dataclass(frozen=True)
class ChatMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict[str, Any]] | None = None


@dataclass(frozen=True)
class ChatRequest:
    messages: list[ChatMessage]
    tools: list[dict[str, Any]] = field(default_factory=list)  # OpenAI function 形式，来自工具注册表
    temperature: float | None = None
    max_tokens: int | None = None
    stop: list[str] | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class TextDelta:
    text: str
    type: Literal["text_delta"] = "text_delta"


@dataclass(frozen=True)
class ToolCallDelta:
    index: int
    id: str | None = None
    name: str | None = None
    arguments_delta: str = ""
    type: Literal["tool_call_delta"] = "tool_call_delta"


@dataclass(frozen=True)
class ToolCallDone:
    index: int
    id: str
    name: str
    arguments: dict[str, Any]
    type: Literal["tool_call_done"] = "tool_call_done"


@dataclass(frozen=True)
class Usage:
    prompt_tokens: int
    completion_tokens: int
    latency_ms: float | None = None
    type: Literal["usage"] = "usage"


@dataclass(frozen=True)
class Error:
    code: str  # timeout | rate_limit | auth | bad_response | network | unknown
    message: str
    retryable: bool = False
    type: Literal["error"] = "error"


LLMEvent = Union[TextDelta, ToolCallDelta, ToolCallDone, Usage, Error]


class LLMPlugin(Plugin):
    kind = "llm"

    @abc.abstractmethod
    def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        """流式生成。各家流格式在插件内归一成五种事件；出错时产出 Error 而不是抛异常。"""


# ---------------------------------------------------------------- image / tts（接口预留，PLAN §16）
@dataclass(frozen=True)
class ImageRequest:
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    seed: int | None = None
    reference_images: list[str] = field(default_factory=list)  # 角色卡 appearance 参考图路径
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ImageResult:
    path: str  # 落在 ctx.data_dir 下的文件
    mime: str = "image/png"
    meta: dict[str, Any] = field(default_factory=dict)


class ImagePlugin(Plugin):
    kind = "image"

    @abc.abstractmethod
    async def generate(self, request: ImageRequest) -> ImageResult: ...


@dataclass(frozen=True)
class SpeechRequest:
    text: str
    voice: str  # SAY.voice
    emotion: str | None = None
    speed: float = 1.0
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SpeechResult:
    path: str
    mime: str = "audio/wav"
    duration_ms: int | None = None
    meta: dict[str, Any] = field(default_factory=dict)


class TTSPlugin(Plugin):
    kind = "tts"

    @abc.abstractmethod
    async def synthesize(self, request: SpeechRequest) -> SpeechResult: ...


# ---------------------------------------------------------------- memory（PLAN §13，含时间线）
@dataclass(frozen=True)
class Timeline:
    """记忆时间线标记（PLAN §13.3）：lineage = 时间线 id，turn = 回合序号。"""
    lineage: str
    turn: int


@dataclass(frozen=True)
class MemoryRecord:
    content: str  # 原文，零 LLM 改写
    timeline: Timeline
    kind: str = "event"  # fact | event | diary | dialogue | note（fact 只能由剧本 / 引擎落账写，见 server/memory/provenance.py）
    tags: tuple[str, ...] = ()
    importance: float = 0.5
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MemoryHit:
    id: str
    content: str  # 原文
    score: float
    source: str  # 召回来源，供调试时间轴显示（如 lingshu / agm_fill）
    timeline: Timeline | None = None
    meta: dict[str, Any] = field(default_factory=dict)


class MemoryPlugin(Plugin):
    kind = "memory"

    @abc.abstractmethod
    async def write(self, record: MemoryRecord) -> str:
        """写入一条记忆，返回记忆 id。"""

    @abc.abstractmethod
    async def recall(self, query: str, k: int, visible: list[Timeline]) -> list[MemoryHit]:
        """召回。``visible`` 是当前可见的时间线前缀（读档后被放弃的分支不在其中），插件必须据此过滤。
        被标成 ``superseded``（已被修订作废）的条目默认不返回；``MemoryHit.meta`` 尽量带回写入时的 meta（source 等）。"""

    async def mark(self, ids: list[str], status: str, by: str | None = None) -> int:
        """给已有条目打状态（整合方案 W2）：``status="superseded"`` 表示被 ``by`` 这条新记忆修订作废。
        只打标、不删原文（原文仍可在时间轴 / dump 里查到）。返回实际打上的条数。
        旧插件没实现就抛 NotImplementedError，网关据此拒绝修订并记一条 verdict。"""
        raise NotImplementedError(f"{type(self).__name__} 不支持 mark")


# ---------------------------------------------------------------- tool（PLAN §11 Agent 工具）
@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema
    effect: Literal["read", "perform", "propose", "memory"] = "read"


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    content: Any = None
    # effect=propose 的工具把提议放这里，由引擎裁决；插件自己不能改状态
    proposals: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


class ToolPlugin(Plugin):
    kind = "tool"

    @abc.abstractmethod
    async def list_tools(self) -> list[ToolSpec]: ...

    @abc.abstractmethod
    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        """``turn`` 是本轮只读上下文（会话 id、回合号、当前节拍等）。"""


# ---------------------------------------------------------------- guard（PLAN §10 文本守卫）
@dataclass(frozen=True)
class GuardVerdict:
    allow: bool
    rule: str = ""
    reason: str = ""
    rewrite_hint: str | None = None  # 给重生成用的提示


class GuardPlugin(Plugin):
    kind = "guard"

    #: 守卫阶段：input = 玩家输入，sentence = 按句闸门（§5.3），turn = 整轮提交前
    stages: ClassVar[tuple[str, ...]] = ("sentence",)

    @abc.abstractmethod
    async def check(self, stage: str, text: str, turn: dict[str, Any]) -> GuardVerdict: ...


# ---------------------------------------------------------------- importer（剧本 / 卡 导入导出）
class ImporterPlugin(Plugin):
    kind = "importer"

    #: 例如 ("letsgal-json",)；方向由实现了哪个方法决定
    formats: ClassVar[tuple[str, ...]] = ()

    @abc.abstractmethod
    async def import_(self, fmt: str, data: bytes) -> dict[str, Any]:
        """外部格式 → 内部 Chapter JSON（按 schemas/ 校验由引擎做）。"""

    async def export(self, fmt: str, chapter: dict[str, Any]) -> bytes:
        raise NotImplementedError(f"{self.ctx.plugin_id} 不支持导出 {fmt}")


BASE_CLASS: dict[str, type[Plugin]] = {
    "llm": LLMPlugin, "image": ImagePlugin, "tts": TTSPlugin, "memory": MemoryPlugin,
    "tool": ToolPlugin, "guard": GuardPlugin, "importer": ImporterPlugin,
}
assert set(BASE_CLASS) == set(KIND_API)
