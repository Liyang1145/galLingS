# 多模型插件 gallings.llm.router（游戏「设置 → 在线聊天与连接 → 模型」）

> 状态：已实现（2026-10-20，分支 `fix/character-performance`）。插件目录 `plugins/builtin/llm-router/`。
> 作品内（离线 / 单文件 / APK）的直连模型是另一套，见 [ai-model.md](ai-model.md)。

## 1. 一句话

galLingS 原来只能配一个模型。这个插件把它换成**模型列表**：可以存多个 OpenAI 兼容模型，点一行就切换**正在用**的那个；每个模型有自己的**思考等级**（关 / 中 / 高）。改完立即生效，不用重启。

## 2. 界面（游戏 → 设置 → 灵枢“连接”下面的“在线聊天与连接” → 模型）

2026-10-20 起整块在线设置从作品页外框挪进了游戏自己的设置（作品 index.html 的 `GL_ONLINE`；颜色字号由 `game-polish.css` 换成游戏设置的青色样式）。写法：标签 + 输入框的行、分段开关、状态圆点，不用弹窗、不用下拉。

| 部分 | 内容 |
|---|---|
| 模型列表 | 一行一个模型：左边单选圈（正在用的实心、左侧亮条、“正在用”标签），名称 + 服务商标签，第二行是模型名（等宽字）· 思考等级 · 状态（密钥末 4 位 / 还没填密钥 / 本机服务 / 测试结果）。点一行 = 改用它 |
| 行尾按钮 | 测试（结果直接写在这一行）、编辑、删除（要确认） |
| 添加模型 | 列表下面的虚线整行。点开后**在列表里就地展开**表单：服务商标签（DeepSeek、通义千问、硅基流动、Kimi、OpenRouter、OpenAI、Ollama、自定义，点了自动填地址和模型）、名称、服务地址、密钥（显示 / 隐藏、申请链接）、模型（可选预设，“拉取列表”从服务商取 `/models`）、思考等级 关 / 中 / 高（下面一句说明快慢）；底部 测试 / 取消 / 保存。Esc 收起 |

插件没运行时，设置里照旧显示原来的单模型输入框。

## 3. 思考等级怎么发给各家

| 服务 | 关 | 中 | 高 |
|---|---|---|---|
| DeepSeek | `thinking: {type: disabled}` | `thinking: {type: enabled}` | 同中（DeepSeek 只有开 / 关） |
| 通义千问 / 硅基流动 | `enable_thinking: false` | `enable_thinking: true` + `thinking_budget: 4096` | `thinking_budget: 16384` |
| OpenRouter | `reasoning: {enabled: false}` | `reasoning: {effort: medium}` | `effort: high` |
| Kimi | 不发 | 不发 | 不发（模型自己决定） |
| 其它（OpenAI、Ollama、自定义） | 不发 | `reasoning_effort: medium` | `reasoning_effort: high` |

开着思考时，调用方给的输出上限会自动加余量（中 +2048、高 +8192），超时放宽到 180 秒，免得只剩思考、正文为空。默认等级是关（和旧版对 DeepSeek 关掉思考一致）。

## 4. 引擎里怎么用

- `Runtime.llm_chain(purpose)`：剧情即兴、手账悄悄话、结局后聊天、建卡、设置里的“测试模型”都用正在用的那个模型（`purpose` 仍然传，只标明调用方）。
- 插件有可用模型时：链 = 正在用的模型 → 其余非 openai-compat 的 llm 插件（如 scripted）。旧的单模型插件不再悄悄兜底。
- 插件还没配模型时：照旧走 `gallings.llm.openai-compat`。
- 链里每一项都有 `stream()` 和 `ctx.plugin_id`（= `gallings.llm.router`，另有 `ctx.profile` 是模型 id），录制回放不受影响。
- 正在进行的剧本会话下次开局才换模型；手账和结局后聊天每次现取。

## 5. 存在哪里、安全

- `<数据根>/plugins/gallings.llm.router/models.json`：模型列表和正在用的模型，不含密钥。
- 同目录 `keys.json`：每个模型的密钥，权限 600，只在本机。网页只拿得到“有没有 + 末 4 位”（短于 8 位连末 4 位也不给）。这是 PLAN §17“密钥只从环境变量读”的例外：模型数量不固定，没法在清单里一个个声明；密钥仍然不进配置、不进日志、不进网页。
- 第一次启动：旧设置里已经有密钥（`GALLINGS_LLM_API_KEY` 或网页旧设置）时，自动导入成第一条，只导一次。
- 本机地址（127.0.0.1 / localhost）不要求密钥，也不走系统代理。
- 设置接口 `POST /api/plugin/gallings.llm.router/<action>` 受本机来源保护；action：`state` `save` `delete` `main` `test` `models`（另有 `duplicate` `order`，界面暂不用）。

## 6. 配置

`config.example.yaml`：`plugins.select.llm: [gallings.llm.router, gallings.llm.openai-compat]`。不想用就把 router 去掉，回到单模型。

## 7. 验证（2026-10-20）

- `tests/plugins/test_llm_router.py`（6 项）：旧设置导入、增删改、切换、各用途都走正在用的模型、思考等级在各家的参数、密钥文件 600 且不外泄、草稿测试、拉模型列表、本机免密钥、分配规则接口已删除、`Runtime.llm_chain` 组合。`pytest tests/plugins` 54 passed 1 skipped。
- 真 galLingS 服务 + 假 OpenAI 兼容服务 + Chromium 端到端 27/27：面板挂载、没有规则 / 下拉 / 弹窗、行内添加、切服务商自动填、错误密钥提示、显示密钥、拉列表、思考等级与说明、草稿测试、三条模型、行内测试、结局后聊天走正在用的模型、点一行切换后手账跟着换且带上思考等级、编辑回填、Esc 收起、删除、保存设置重启插件后数据还在、手机宽度、无脚本错误。
- 其余测试与改动前一致（沙箱没有 galcore 的那批照旧失败，名单相同）。
- 没有用真服务商密钥测；各家思考参数按公开文档写，真服务上还要验。
