# 游戏内 AI 模型接口（VN Studio「设置 → AI 模型」）

更新：2026-10-20。作品 `content/imports/vnstudio/海风与布丁/index.html`（VN Studio 引擎）。

## 1. 一句话

游戏自己就能直连大模型：玩家在 **设置 → AI 模型** 里选服务商、填密钥，结局后和鲸鱼小姐聊天（GalAgent）、灵枢手账的悄悄话、剧情 `@agent` 都能用真模型——**不用开 galLingS 后端**。双击 `游玩.html`、单文件试玩版、APK、桌面版都一样。在 galLingS 作品页里玩时仍然走 galLingS（模型和密钥由 galLingS 统一管理），这一节只显示一行说明。

## 2. 玩家界面

开始界面 / 游戏中 → 设置（“声音与阅读”面板），在「好感数值」下面、「灵枢」上面多一节 **AI 模型**：

| 行 | 说明 |
|---|---|
| 服务商 | DeepSeek、通义千问、硅基流动、Kimi、OpenRouter、OpenAI、Ollama（本机）、自定义。右边「获取密钥」直达服务商的密钥页 |
| 密钥 | 密码框；按服务商分开记，换回来不用重填。Ollama 不需要，这一行隐藏 |
| 模型 | 可直接输入，也有该服务商常用模型的下拉提示；留空 = 列表第一个（如 `deepseek-chat`） |
| 接口地址 | 留空 = 服务商默认地址；自定义 / 代理时填到 `/v1` 为止（填到 `/chat/completions` 也认） |
| 状态 | 「测试」发一句极短的请求，显示可用 / 耗时 / 出错原因（密钥不对、余额不足、地址或模型名不对、太频繁、连不上）；「清除」删掉本机保存的设置 |

灵枢「连接」从“离线 / galLingS”变成 **离线 / AI 模型 / galLingS**。玩家没手动选过时，填好 AI 模型后自动改用 AI 模型；悄悄话页底部显示连接状态，模型出错时自动退回离线回复。

结局卡的「和鲸鱼小姐聊聊」现在离线版也有（GalAgent 插件随作品打包，见 §5）：
- 填了 AI 模型 → 直连模型聊天，工作进度胶囊、思考步骤、工具调用、确认流程和连后端时完全一样；
- 都没填 → 离线模拟，开场一句提示「在设置 → AI 模型里填好密钥就能真的聊天」。

## 3. 存在哪里、安全

- 配置存 `localStorage['vnmodel:<作品id>']`（编辑器是 `vnmodel:studio`），**不进项目、不进 game.js、不随游戏导出**。
- 请求由玩家浏览器直接发给服务商（OpenAI 兼容 `POST {base}/chat/completions`，`stream: true`）。DeepSeek、通义、硅基流动、Kimi、OpenRouter、OpenAI 都允许网页直连（已核对 CORS，含 `file://` 的 `Origin: null`）。智谱等不允许直连的服务，用 galLingS 后端或自己的代理。
- Ollama 从 `file://` 打开时要设 `OLLAMA_ORIGINS=*`。
- 密钥只给玩家自己的设备用；作者不要把自己的密钥写进作品。

## 4. 谁在用它

| 用处 | 怎么接 |
|---|---|
| GalAgent 结局后聊天 / 剧情 @agent 选 GalAgent | 插件 `newClient`：有后端地址（或在作品页里）→ `GalAgent.Client`（galagent/1）；否则填了模型 → `GalAgent.ApiClient`（浏览器里跑 agent 循环）；都没有 → `MockClient` |
| 灵枢悄悄话 | `SOUL_BRAINS.api`：人设 + 手账记忆 + 最近 10 条悄悄话 → JSON `{text, emotion}` |
| 剧情 `@agent`，编辑器设置 → 机器人选「AI 模型」 | `VNAgent` 大脑 `model`：返回 vn-agent/1 的 `{text, emotion, set, end}` |
| 其他插件 | `vn.model`（§6） |

`ApiClient` 细节：流式台词 → `say_delta`；推理模型（`reasoning_content`）→ 「思考」步骤；OpenAI function calling → 前端工具（`get_vars`、`set_var`、`play_se` 和别的插件 `addClientTool` 加的），工具写 `ask: true` 会走确认流程；台词里的【表情】标记被拿掉并换立绘表情；服务商不支持工具时自动去掉工具重试；一轮被打断或出错时整轮从上下文里撤掉。电脑上的工具（powershell、读写文件）只有连 galLingS 后端才有。

## 5. GalAgent 随作品打包（修 B08）

`game.js` 的 `plugins` 里带一份 GalAgent（VN Studio 的“项目插件”），所以所有离线玩法结局卡都有入口；玩家可在开始界面「插件」里停用。在 galLingS 作品页里，`/api/vn/plugins` 托管的同 id 版本会覆盖它。

改了 GalAgent 前端之后：

```bash
python plugins/builtin/galagent/web/build_vnplugin.py      # 生成 galagent.vnplugin.js
python tools/embed_galagent_plugin.py                       # 写进作品 game.js 的 plugins（其余逐字不变）
```

## 6. 插件接口 `vn.model`

```js
vn.model.ready()          // 玩家填好了没有
vn.model.info()           // { ready, preset, provider, base, model, state, info }，不含密钥
vn.model.presets()        // 内置服务商列表
vn.model.openSettings()   // 打开设置（游戏）/ 设置弹窗（编辑器）
await vn.model.chat({ messages, tools?, temperature?, max_tokens?, onDelta?, onThink?, signal?, timeout? })
// → { content, reasoning, tool_calls: [{ id, name, args, raw }], finish }
vn.on('model:changed', info => {})
```

引擎内部同一个对象是 `window.VNModel`（`get/set/clear/conf/ready/describe/chat/test`），`MODEL_PRESETS` 是服务商表。

## 7. 验证（2026-10-20）

- 本地假 OpenAI 服务（SSE、推理流、function calling、401）+ Chromium 实测 20/20：设置面板填写 / 测试 / 错误提示 / 按服务商记密钥、灵枢自动切到 AI 模型、离线结局卡出现「和鲸鱼小姐聊聊」、直连聊天（思考步骤 → set_var 工具 → 表情标记去掉 → 好感真的改成 999）、第二轮带历史、悄悄话走模型、`describe()` 不含密钥、无页面报错。
- 没填模型时：离线模拟 + 提示；编辑器设置弹窗有「AI 模型」大脑与模型填写。
- `tools/check_full_regression.py`：3315 节点 nbad 0、nerrs 0，存读档一致。
- `pytest tests/plugins`：47 passed, 1 skipped；`tests/demo`、`tests/contract` 在沙箱只有 galcore 桩，结果与改动前完全相同（改动不涉及 Python）。
- **没有用真实服务商的密钥跑过**（没有团队账户）；真模型的人设听感待负责人验收（待办 B01）。
