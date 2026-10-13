# galLingS 插件格式 v1（插座规范）

> 状态：地基已实现（`server/plugins/`），格式进入 M0a 接口冻结范围。改动走 PR。
> 格式权威：`schemas/plugin.schema.json`。本文是给插件作者的说明。

## 1. 一句话

引擎是**插座**，一切可替换的能力都是**插件**：模型、生图、语音、记忆、Agent 工具、守卫、剧本导入导出。
每个插件就是一个目录，里面有一份 `plugin.yaml`；引擎按同一套流程发现、校验、启用、调用、关闭它们。

不是插件的东西：
- **剧本、角色卡、立绘、音乐**：这些是内容，各有 Schema（`card.schema.json` 等），不走插件。
- **Rust 核心 galcore**：状态机和裁决不开放给插件。插件只能"提议"，由引擎裁决（PLAN §0、§4）。

## 2. 目录与清单

```
my-plugin/
├── plugin.yaml        # 必需
├── plugin.py          # python 运行时的入口（文件名任意，由 runtime.entry 指定）
└── ...                # 其它模块，可用相对导入（from .sse import X）
```

```yaml
schema_version: 1                     # 清单格式版本
id: gallings.llm.openai-compat        # 全局唯一：<作者>.<kind>.<名字>，小写
name: OpenAI-compatible 模型网关
version: 0.1.0                        # 插件自身 SemVer
kind: llm                             # llm | image | tts | memory | tool | guard | importer
api: 1                                # 实现的 kind 接口主版本
description: ...
requires:
  gallings: ">=0.1,<0.2"              # 引擎版本范围（PEP 440）
  python: ">=3.11"
  plugins: {gallings.memory.lingshu: ">=0.1"}   # 依赖的插件
runtime:
  type: python                        # python = 进程内；mcp = MCP stdio 子进程
  entry: plugin.py:OpenAICompatLLM
capabilities: [stream, tools]         # 能力标签，导演按能力降级
config_schema: {...}                  # 配置的 JSON Schema；default 会被填入
secrets:                              # 密钥只从环境变量读
  - {name: api_key, env: GALLINGS_LLM_API_KEY, required: true}
permissions:                          # 声明式，进启动报告；Demo 阶段不做沙箱强制
  network: [api.deepseek.com]
  filesystem: ["${data_dir}"]
  subprocess: false
determinism: recorded                 # recorded（默认）| pure
```

MCP 运行时（目前只用于 `kind: tool`）：

```yaml
runtime:
  type: mcp
  command: [python3, -m, some_mcp_server]
  env: {SOME_ROOT: "${data_dir}/x"}   # 支持 ${data_dir} ${plugin_dir}
  startup_timeout_s: 20
  call_timeout_s: 30
provides:
  tools: [echo, add]                  # 白名单：MCP 服务上其它工具不导出
```

其它 kind 要接 MCP 服务（例如灵枢）时，用 python 运行时写一个薄适配器，在里面用
`server.plugins.mcp.MCPClient`（见内置的 `gallings.memory.lingshu`）。

## 3. 各 kind 的接口（`server/plugins/kinds.py`，api = 1）

所有插件继承 `Plugin`：`setup()`、`health()`、`close()`（都是 async，可选覆盖）；构造时拿到 `self.ctx`。

| kind | 基类 | 必须实现 | 选用方式 |
|---|---|---|---|
| llm | `LLMPlugin` | `stream(ChatRequest) → 异步产出 TextDelta / ToolCallDelta / ToolCallDone / Usage / Error` | 单例 + 降级链 |
| image | `ImagePlugin` | `generate(ImageRequest) → ImageResult` | 单例 + 降级链 |
| tts | `TTSPlugin` | `synthesize(SpeechRequest) → SpeechResult` | 单例 + 降级链 |
| memory | `MemoryPlugin` | `write(MemoryRecord) → id`；`recall(query, k, visible: list[Timeline]) → list[MemoryHit]` | 单例 + 降级链 |
| tool | `ToolPlugin` | `list_tools() → list[ToolSpec]`；`call(name, args, turn) → ToolResult` | 多个并存 |
| guard | `GuardPlugin` | `check(stage, text, turn) → GuardVerdict`；`stages` 声明 input / sentence / turn | 多个并存 |
| importer | `ImporterPlugin` | `import_(fmt, data) → Chapter JSON`；可选 `export` | 多个并存 |

约定：
- **llm** 出错时产出 `Error` 事件，不抛异常；各家流格式在插件内归一（PLAN §12）。
- **memory** 返回原文，必须按 `visible` 过滤时间线（读档后被放弃的分支、未来回合不可见，PLAN §13.3）。
- **tool** 的 `effect=propose` 工具只把提议放进 `ToolResult.proposals`，自己不改状态。`list_tools()` 的工具名必须和清单 `provides.tools` 完全一致；不同插件的工具不能重名。
- 接口有破坏性改动时，对应 kind 的主版本 +1；清单 `api` 不等于引擎支持的主版本就拒绝加载。

## 4. 上下文 `ctx`

| 字段 | 内容 |
|---|---|
| `ctx.config` | 校验过、填好默认值的配置 |
| `ctx.secrets.get(name)` / `.require(name)` | 只能读清单里声明过的密钥；`repr` 不泄露值 |
| `ctx.data_dir` | 插件独占的数据目录 `<数据根>/plugins/<id>/` |
| `ctx.plugin_dir` | 插件自己的目录 |
| `ctx.log` | `logging.Logger`（`gallings.plugin.<id>`） |
| `ctx.emit(type, payload)` | 写调试时间轴，事件名自动加前缀 `plugin.<id>.` |
| `ctx.deps` | `requires.plugins` 里声明的依赖插件实例 |

## 5. 怎么装、怎么选（config.yaml）

```yaml
plugins:
  paths: [plugins/builtin, ~/.gallings/plugins]   # 扫描这些目录下的每个子目录
  select:                                          # 单例 kind：主用 + 降级备选
    llm: [gallings.llm.openai-compat, gallings.llm.scripted]
    memory: gallings.memory.lingshu
  tools: [gallings.tool.proposals]                 # 多例 kind：全部启用
  guards: [gallings.guard.injection]
  importers: []
  config:
    gallings.llm.openai-compat: {base_url: https://api.deepseek.com, model: deepseek-flash}
```

- 安装 = 把插件目录放进任一 `paths`。只有被 `select / tools / guards / importers` 点名的插件和它们的依赖才会加载。
- 同一 id 出现两次：保留先扫描到的，另一份进启动报告的 `discovery_errors`。
- 单例 kind 的主用插件启动失败（缺密钥、不兼容、setup 报错）时，`manager.get(kind)` 自动给出下一个。

## 6. 生命周期

```
发现(plugin.yaml) → Schema + 语义校验 → 依赖解析/拓扑排序 → 兼容性(api / 引擎 / Python)
  → 配置校验 + 密钥检查 → 导入入口 + 接口检查 → setup() → running
  → ……调用……（工具调用写 tool.called 事件）
  → close()（按启动的逆序）
```

任何一步失败，插件进入 `failed`，原因写进启动报告和 `plugin.failed` 事件，**不影响其它插件**。
setup 中途失败时引擎会调用一次 `close()` 回收子进程和连接。

## 7. 确定性与回放

- `manager.lock()` 输出插件锁：每个运行中插件的 id、版本、清单哈希、配置哈希，以及实际生效的选择。写进事件日志头；回放前比对。
- `determinism: recorded`（默认）：插件输出先由记录器写成事件，回放读事件，不再调用插件（模型、记忆召回、生图都是这种）。
- `determinism: pure`：同输入同输出，回放时允许重算（守卫的正则、提议工具的参数校验）。

## 8. 命令行

```bash
python -m server.plugins list                              # 列出发现的插件
python -m server.plugins validate path/to/my-plugin        # 校验清单 + 入口
python -m server.plugins check --config config.yaml        # 按配置全部启动一遍，打印报告与插件锁
```

## 9. 内置插件（`plugins/builtin/`，也是参考实现）

| id | kind | 说明 |
|---|---|---|
| gallings.llm.openai-compat | llm | DeepSeek 等 OpenAI 兼容接口，SSE → 五种事件 |
| gallings.llm.scripted | llm | 按脚本回放，测试 / CI / 离线彩排 |
| gallings.memory.lingshu | memory | 灵枢 MCP 子进程；时间线标签 `tl:<lineage>@<turn>` 与可见性过滤 |
| gallings.tool.proposals | tool | `propose_affection`、`propose_mood`，只出提议 |
| gallings.guard.injection | guard | 玩家输入的提示注入检测 |
| gallings.tool.galagent | tool | 结局后聊天（post_ending）的 Agent：powershell / 文件 / 网页等基础工具 + galagent/1 会话，见 [galagent.md](galagent.md) |

能力标签 `galagent`：tool 插件在 `capabilities` 里写上它，工具就会出现在结局后聊天里（确认策略见 galagent.md §2、§4）。

> 另：VN Studio（前端游戏）有自己的插件格式 vn-plugin/1（一个 .js 文件），见 VN Studio 的 `PLUGIN_API.md`；GalAgent 两边都有：后端是这里的 tool 插件，前端是 `plugins/builtin/galagent/web/galagent.vnplugin.js`。

## 10. 尚未做（按需再加）

- 沙箱：`permissions` 目前只声明不强制；第三方插件上线前要么跑在 MCP 子进程里，要么加进程隔离。
- 插件 SDK 独立成包（现在插件 `from server.plugins import ...`）。
- 热重载、插件市场 / 签名校验。
- 前端侧插件（Live2D 渲染器、播放器皮肤）：另起 `web/` 侧规范，不和后端插件混用。
- AGM 补位目前是引擎内能力，不是 memory 插件；以后可抽成 memory 的"包装插件"。
