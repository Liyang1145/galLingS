# 多模型插件 gallings.llm.router（作品页「设置 → 模型」）

> 状态：已实现（2026-10-20，分支 `fix/character-performance`）。插件目录 `plugins/builtin/llm-router/`。
> 作品内（离线 / 单文件 / APK）的直连模型是另一套，见 [ai-model.md](ai-model.md)。

## 1. 一句话

galLingS 原来只能配一个模型（服务地址 + 模型名 + 一把密钥）。这个插件把它换成**模型列表**：可以加多个 OpenAI 兼容模型，选一个**主模型**，再按**用途**分给不同模型，出错时按规则换备选。改完立即生效，不用重启。

## 2. 界面（作品页 → 设置 → 在线聊天与连接设置 → 模型）

| 部分 | 内容 |
|---|---|
| 主模型 | 下拉选一个；没单独分配的用途都用它 |
| 模型分配规则 › | 子页面：剧情即兴、手账悄悄话、结局后聊天、建卡 各选“跟随主模型”或某个模型；“失败时”= 换用主模型（默认）/ 按列表依次换 / 不换 |
| 模型列表 | 每行：云图标（本机服务是服务器图标；主模型实心）、显示名、模型名、标签（未填密钥 / 本机 / 被分配的用途）、⋯ 菜单（设为主模型、编辑、测试连接、复制一份、上移、下移、删除） |
| 排序按钮 | 主模型置顶 / 按名称 / 按服务商 / 可用的排前面（会改列表顺序，“按列表依次换”就按这个顺序） |
| 添加模型 | 弹窗：预设模型（DeepSeek、通义千问、硅基流动、Kimi、OpenRouter、OpenAI、Ollama、自定义，自动填 Base URL 和模型名）、模型显示名、Base URL、API Key（眼睛按钮显示）、Model Name（输入框可选预设模型，右侧按钮从服务商拉 `/models` 列表）、高级参数（温度、Top P、最大输出、超时、思考模式）；底部 测试 / 取消 / 保存 |

配色、按钮、对话框跟设置面板同一套深青色。插件没运行时，设置里照旧显示原来的单模型输入框。

## 3. 引擎里怎么用

- `Runtime.llm_chain(purpose)`：`purpose` = `story`（剧本会话：即兴、意图、改写）/ `soul`（手账悄悄话）/ `chat`（结局后聊天 GalAgent）/ `cards`（建卡）/ 不传（主模型，设置里的“测试模型”）。
- 路由有可用模型时：链 = 分到的模型 → 按“失败时”规则补备选 → 其余非 openai-compat 的 llm 插件（如 scripted）。旧的单模型插件不再悄悄兜底，配的就是用的。
- 路由还没配模型时：照旧走 `gallings.llm.openai-compat`。
- 链里每一项和普通 llm 插件一样有 `stream()` 和 `ctx.plugin_id`（= `gallings.llm.router`，另有 `ctx.profile` 是模型 id），录制回放不受影响。
- 正在进行的剧本会话下次开局才换模型；手账和结局后聊天每次现取。

## 4. 存在哪里、安全

- `<数据根>/plugins/gallings.llm.router/models.json`：模型列表、主模型、规则，不含密钥。
- 同目录 `keys.json`：每个模型的密钥，权限 600，只在本机。网页只拿得到“有没有 + 末 4 位”（短于 8 位连末 4 位也不给）。这是 PLAN §17“密钥只从环境变量读”的例外：模型数量不固定，没法在清单里一个个声明；密钥仍然不进配置、不进日志、不进网页。
- 第一次启动：如果旧设置里已经有密钥（`GALLINGS_LLM_API_KEY` 或网页旧设置），自动导入成第一条并设为主模型，只导一次。
- 本机地址（127.0.0.1 / localhost）不要求密钥，也不走系统代理（Ollama 不会被代理拦住）。
- 设置接口 `POST /api/plugin/gallings.llm.router/<action>` 受本机来源保护；action：`state` `save` `delete` `duplicate` `main` `order` `rules` `test` `models`。

## 5. 配置

`config.example.yaml`：`plugins.select.llm: [gallings.llm.router, gallings.llm.openai-compat]`。不想用就把 router 去掉，回到单模型。

## 6. 验证（2026-10-20）

- `tests/plugins/test_llm_router.py`（5 项）：旧设置导入、增删改、主模型、规则、三种降级、密钥文件 600 且不外泄、草稿测试、拉模型列表、本机免密钥、`Runtime.llm_chain` 组合。`pytest tests/plugins` 53 passed 1 skipped。
- 真 galLingS 服务 + 假 OpenAI 兼容服务 + Chromium 端到端 28/28：面板挂载、预设、错误密钥提示、眼睛按钮、拉列表、草稿测试、三条模型、主模型下拉、规则、⋯ 菜单、设置“测试模型”走主模型、结局后聊天走分配的模型、手账走主模型且高级参数生效、删除、编辑回填、保存设置重启插件后数据还在、手机宽度、无脚本错误。
- 其余测试与改动前一致（沙箱没有 galcore 的那批照旧失败，名单相同）。
- 没有用真服务商密钥测。
