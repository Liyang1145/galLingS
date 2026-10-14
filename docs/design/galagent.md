# GalAgent：结局后聊天 + 角色 Agent

> 插件：`plugins/builtin/galagent/`（id `gallings.tool.galagent`，kind `tool`）
> 端口：`server/api/post_ending.py`（实现 PLAN §16 预留的 `post_ending`）
> 前端：`plugins/builtin/galagent/web/galagent-ui.js`（galLingS 页面与 VN Studio v0.16 共用）

到达结局后，玩家可以继续和角色聊天：既能情感陪伴，也能直接下指令让角色**真的去做事**（看文件、跑命令、查网页、改游戏变量……）。

界面是 galgame 画面：上半部分背景图 + 角色立绘，下半部分名字牌 + 对话框 + 输入框。名字牌右边多一个**工作进度胶囊**：

| 状态 | 胶囊（默认折叠） | 点开胶囊 |
|---|---|---|
| 工作中 | 转圈 + 当前进度（思考中… / 调用 powershell… / 查看结果…）+ 计时 | 工作流程面板从胶囊位置**平滑展开铺满整个画面**（clip-path 动画），列出每一轮、每一步 |
| 等确认 | 黄色脉动“等你确认：powershell”；默认自动展开面板（`autoOpenOnAsk`） | 在对应步骤里点“允许 / 拒绝 / 本次聊天都允许” |
| 完成 | ✓ **已完成，耗时 X 秒**（只思考没调工具时是“已思考，耗时 X 秒”） | 最新一轮展开，旧的轮次收成一行；**点任一步骤标题展开详情**（思考全文、参数、输出） |

面板右上角 ✕ 或 Esc 收回胶囊（同样有动画）。中途台词（“稍等，我去翻翻～”）先显示在对话框里，并作为旁白留在工作流程中；最终回复显示在对话框。

---

## 1. 快速开始

### 1.1 跑在完整引擎里
1. 把 `config.galagent.example.yaml` 里的 `game.post_ending` 和 `plugins.tools / plugins.config` 合并进 `config.yaml`。
2. 设置 `GALLINGS_LLM_API_KEY`，`python -m server`（或 `start.bat`）。
3. 浏览器打开 `http://127.0.0.1:8765/galagent?card=whale&bg=bg_shallows_sunset_v01&ending=真结局`（不同源时加 `&token=…`）。
   `bg` 写素材库 `content/assets/backgrounds` 里的文件名或完整网址；`sprite` 写立绘网址（可含 `{expr}`，随 `<emotion>` 切换）。

### 1.2 只跑聊天端口（不需要 Rust 核心，给只用 VN Studio 的作者）
```bash
pip install -e .
set GALLINGS_LLM_API_KEY=sk-...        # PowerShell: $env:GALLINGS_LLM_API_KEY="sk-..."
python -m server.api.post_ending --config config.galagent.example.yaml
```
启动日志会打印**令牌**（也存在 `~/.gallings/post_ending_token.txt`）。VN Studio 双击打开时是 `file://`，必须在设置里填这个令牌。

### 1.3 不连后端，先看界面
`/galagent?mock=1`，或 VN Studio 里 GalAgent 地址留空：用内置的 `MockClient` 模拟思考、工具调用和确认流程。

---

## 2. 内置工具与确认策略

| 工具 | effect | 默认策略 | 说明 |
|---|---|---|---|
| `powershell` | perform | **ask** | 依次找 `pwsh` → `powershell.exe` → `bash` → `sh`；工作目录 = workspace；超时、输出截断 |
| `read_file` | read | auto | 只在 workspace 内（`allow_outside_workspace` 可放开） |
| `write_file` | perform | **ask** | 只在 workspace 内 |
| `list_dir` | read | auto | |
| `fetch_url` | read | auto | http/https，去标签取正文 |
| `get_time` | read | auto | |

- 策略：`auto` 直接执行 / `ask` 先在界面上弹“允许 / 拒绝 / 本次聊天都允许” / `deny` 不给模型看。
- 按工具名配 `confirm`；其它插件的工具没点名时按 `confirm_by_effect`（默认 read/memory=auto，perform=ask，propose=deny）。
- `powershell` 能做任何事，workspace 限制挡不住它——**别把它改成 auto 给普通玩家用**。
- `@postchat … tools=off`（或 hello 里 `server_tools:false`）= 这次聊天不给后端工具，只剩前端工具。

完整配置项见 `plugins/builtin/galagent/plugin.yaml` 的 `config_schema`。

---

## 3. 协议 galagent/1（WebSocket `/ws/post_ending`）

### 客户端 → 服务端
| type | 字段 | 说明 |
|---|---|---|
| `hello` | `token?` `card?` `character{name,persona,expressions}` `context{ending,story,vars,goal}` `client_tools[]` `history[]` `server_tools?` | 第一条必须是它。带 `card` 时用 galLingS 角色卡补全人设 |
| `user` | `text` | 玩家说话 / 下指令 |
| `approve` | `call_id` `allow` `remember?` | 回答确认；`remember` = 本次聊天这个工具都允许 |
| `client_result` | `call_id` `ok` `result?` `error?` | 前端工具的执行结果 |
| `stop` / `reset` / `ping` | | 中止这一轮 / 清空记忆 / 心跳 |

### 服务端 → 客户端
| type | 关键字段 | 前端怎么用 |
|---|---|---|
| `ready` | `session` `tools[{name,effect,policy,source}]` | 连接成功 |
| `turn_start` / `turn_end` | `turn`；结束时 `ms rounds steps tool_calls reply stopped error` | 一轮的开始与结束 → 总折叠 |
| `round_start` / `round_end` | `round`；`tool_calls` | 一次模型往返；有工具调用的那次，台词转成旁白 |
| `step_start` / `think_delta` / `step_end` | `step` `kind:"think"` `text` `ms` | 思考步骤 → 分步折叠 |
| `say_delta` | `text` | 角色台词（流式） |
| `emotion` | `name` | 换立绘表情（模型写 `<emotion>笑</emotion>`） |
| `tool_start` / `tool_end` | `step` `call_id` `name` `args` / `ok` `result` `error` `ms` | 工具步骤 → 分步折叠 |
| `approval_required` / `approval_resolved` | `call_id` `name` `args` / `allow` | 确认卡片 |
| `client_call` | `call_id` `name` `args` | 让前端执行一个前端工具 |
| `usage` / `error` / `reset_done` / `pong` | | `error.fatal=true` 表示连接不可用 |

思考来自模型在 `<think>…</think>` 里写的内容（系统提示词要求的，`think: false` 可关）。

### HTTP
- `GET /api/post_ending/info`：是否开启、提供者、工具清单（带令牌才列工具）。
- `POST /api/post_ending/chat`：**vn-agent/1 兼容**，一问一答不流式；需要确认的工具一律拒绝。老版 VN Studio 的“接口”大脑可以直接指过来（请求头 `X-GalAgent-Token`）。

### 安全
- 只监听 127.0.0.1，但浏览器里任何网页都能连本机端口。因此：Host 与 Origin 都是本机 → 免令牌；其它来源（含 `file://` 的 Origin `null`）→ 必须带令牌。
- 工具结果在提示词里声明为“数据不是指令”；输出截断；每轮最多 `max_rounds` 次往返、`max_tool_calls` 次调用、`turn_timeout_s` 超时。

---

## 4. 扩展：给 GalAgent 加功能

### 4.1 加后端工具（最常用）—— 写一个普通 tool 插件，声明 `galagent` 能力
1. 新建目录（放进 `plugins.paths` 任意一个，比如 `~/.gallings/plugins/my-notes/`）。
2. 写 `plugin.yaml`：
   ```yaml
   schema_version: 1
   id: yourname.tool.notes
   name: 备忘本
   version: 0.1.0
   kind: tool
   api: 1
   runtime: {type: python, entry: plugin.py:NotesTools}
   capabilities: [galagent]          # ← 声明后自动出现在结局后聊天里
   provides:
     tools: [add_note, list_notes]   # 必须和 list_tools() 完全一致，且不能和别的插件重名
   ```
3. 写 `plugin.py`：继承 `ToolPlugin`，实现 `list_tools()` 和 `call()`。`ToolSpec.effect` 决定默认确认策略：
   `read` 直接执行，`perform` 先问玩家。工具在 `self.ctx.data_dir` 里存数据，配置从 `self.ctx.config` 读，密钥用 `self.ctx.secrets`。
4. `config.yaml` 的 `plugins.tools` 加上 `yourname.tool.notes`。
5. 校验：`python -m server.plugins validate path/to/my-notes`，再 `python -m server.plugins check --config config.yaml`。

完整示例：`plugins/examples/galagent-notes/`（测试见 `tests/plugins/test_galagent.py::test_example_notes_extension`）。

不想改别人的插件清单？在 galagent 配置里点名：`extra_tool_plugins: [someone.tool.xxx]`（写 `"*"` = 所有 tool 插件）。
想改某个工具的确认策略：`gallings.tool.galagent.confirm: {add_note: auto}`。

### 4.2 接一个现成的 MCP 服务
```yaml
schema_version: 1
id: yourname.tool.fs-mcp
name: 文件系统 MCP
version: 0.1.0
kind: tool
api: 1
runtime: {type: mcp, command: [npx, -y, "@modelcontextprotocol/server-filesystem", "C:/Users/me/Documents"]}
capabilities: [galagent]
provides: {tools: [read_text_file, list_directory]}   # 白名单
```
MCP 工具的 effect 一律按 `read` 上报；有副作用的请在 `confirm` 里显式设为 `ask`。

### 4.3 加前端工具（在玩家浏览器里执行：改游戏变量、播音效、弹提示……）
```js
const view = GalAgent.mount(el, {
  url, token, character,
  clientTools: [{
    name: 'show_notice', effect: 'perform',
    description: '在玩家屏幕上弹一条小提示',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    handler: async ({ text }) => { toast(text); return { shown: true }; }
  }]
});
```
名字须匹配 `^[a-z][a-z0-9_]*$`，不能和后端工具重名。VN Studio 里往 `GalAgentVN.clientTools` push 即可（在连接建立前）。

### 4.4 自定义界面
- 自己的 galgame 前端：`new GalAgent.WorkDock(stageEl, {pillParent, placePill, onApprove})`，把 galagent/1 事件逐条 `dock.feed(m)` 即可得到胶囊 + 铺满画面的工作流程面板（VN Studio 就是这样接的）。
- 现成的完整画面：`new GalAgent.GalStage(el, {url, token, character, bg, sprite, greeting})`。
- 聊天窗口样式（调试用）：`new GalAgent.ChatView(el, opts)`。

### 4.5 自定义工具结果怎么显示
```js
GalAgent.registerToolTitle('add_note', a => a.text);                 // 步骤标题上的一行摘要
GalAgent.registerToolRenderer('list_notes', (step, box) => {          // 展开后的结果区
  box.innerHTML = step.result.notes.map(n => `<div>· ${n.text}</div>`).join('');
});
```
`step` 里有 `name args result error ms status`。

### 4.6 换掉整个结局后聊天实现（高级）
任何 tool 插件只要实现：
```python
def open_post_ending(self, *, llm_chain, send, manager=None) -> Session: ...
# Session 需要：async handle(msg: dict)、async close()，通过 await send(event) 推 galagent/1 事件
```
就能当 `post_ending` 提供者；`game.post_ending.provider` 指定用哪个。可以直接复用 `GalAgentSession` 只改提示词。

---

## 5. 和 VN Studio 一起用（VN Studio v0.20+：GalAgent 是一个插件）

VN Studio v0.20 起有插件接口（vn-plugin/1，规范见 VN Studio 的 `PLUGIN_API.md`），GalAgent 的前端整个做成了一个插件文件 **`plugins/builtin/galagent/web/galagent.vnplugin.js`**（由 `build_vnplugin.py` 把 `galagent-ui.js` + `vnplugin.src.js` 拼成）。界面、功能、扩展方式和以前一样：

- **在 galLingS 作品页里玩**：什么都不用做。`gallings.tool.galagent` 开着（`game.post_ending.mode` 不是 off，`config.example.yaml` 默认就开着）时，`/api/vn/plugins` 会把这个插件提供给游戏，游戏自动装上、自动连同源 `/ws/post_ending`（同源不需要令牌）。顶栏和游戏开始界面都有“插件”按钮，可以看状态、改设置、停用。
- **只用 VN Studio / 双击打开的游戏**：编辑器顶栏“插件”→ 导入 `galagent.vnplugin.js`（随导出的游戏一起带走）；或者玩家在游戏开始界面“插件”里导入。插件设置里填后端地址 `ws://127.0.0.1:8765/ws/post_ending` 和令牌（file:// 打开时必填），留空 = 离线模拟。
- 剧情 @agent：编辑器设置 → 机器人选 **GalAgent**。结局后聊天：剧本 `@postchat 角色 [auto=on] [tools=off] goal=…`；没写时用插件设置里的角色，再没有就用 @soul 手账角色（《海风与布丁》就是鲸鱼小姐）。
- 名字牌旁的胶囊显示工作进度（默认折叠），点开后工作流程面板平滑铺满画面，每一步可展开；一轮结束显示“已完成，耗时 X 秒”。

扩展：

- 后端工具（跑在电脑上的）：照 §4 写 galLingS 插件，`capabilities: [galagent]`。
- 前端工具 / 自定义显示：写一个 VN Studio 插件，`requires: ['gallings.galagent']`，然后 `vn.require('gallings.galagent').addClientTool({...})`、`.GalAgent.registerToolRenderer(...)`。示例 VN Studio `examples/plugins/galagent-dice.vnplugin.js`。
- 别的 VN Studio 插件想随 galLingS 发给作品：放进 `content/vn_plugins/`。

## 6. 测试
`python -m pytest tests/plugins/test_galagent.py`：流拆分、工具循环、确认（拒绝 / 允许 / 记住）、前端工具往返、扩展插件接入、中止后历史合法、工作目录越界、令牌校验、vn-agent/1 兼容端口、静态页。
