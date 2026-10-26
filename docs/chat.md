# 通关后聊天与保留的辅助服务

本文维护现行接口、职责与失败边界。实际已执行的验证、历史产物及未完成事项统一见[项目总览](<README.md#status>)，协作约束见[工程规则](<engineering.md>)。命令只供按用户安排手动使用，不构成自动测试、构建、服务或发布授权。

[已提交通关的只读上下文](<chat.md#chat>) · [独立无工具聊天](<chat.md#agent>) · [独立聊天验证证据](<chat.md#agent-verification>)

<a id="chat"></a>

## 已提交通关的只读上下文

### 当前能力

浏览器开发入口的“开发工具”提供“通关后入口准备”，只在点击后加载本地模块。2026-10-25 的[正式配置](<delivery.md#run-profile>)已在随包构建移除该开发入口及 DOM，正式 `game/main` 不开放此面板；标题六项普通入口也没有正式聊天按钮。开发面板先等待本页已有全局事实提交，再读取隔离记录，读取失败不阻断主线。Windows 构建成功不代表正式聊天已接入。

面板列出已提交的每一条通关事实，用户显式选择一条后再次读取确认，展示只读上下文。相同结局的不同实际通关仍是不同条目；列表顺序是全局账本顺序，不是准确时间排序，不自动挑“最新路线”。

只读上下文已接入下节开发工具中的独立无工具聊天；正式 game/main 仍不开放聊天发送。**满足哪个结局、与哪个角色聊天、多个通关如何接续、供应与费用模式仍待决定**。开发工具中的按钮可在无通关时打开空态，不能据此理解为已解锁正式聊天，也没有把“任意一个结局”写成正式解锁规则。

### 事实来源与能力边界

`PlayerRepository.readCompletions()` 通过现有 `read()` 重新读取、校验已提交全局记录，再返回最小投影：

```text
haifeng.committed-clears/1
  workId
  scope
  unlockedEndingIds
  clears[] { factId, endingId }
```

它不读取进度槽位，不从当前会话的结局状态、待写批次、已读节点、CG、存档内 player 投影或旧 localStorage 推断成果。已有全局存储格式仍为 `haifeng.player-records/1`，键、计次、写入及幂等交付不变；本片没有增加存储或迁移。

`packages/chat/src/context.ts` 的 `ClearedContextReader` 只接收 `CompletionSource.read(): Promise<unknown>`，不持有 `PlayerRepository` 本体、记录写入口、进度仓库、剧情会话或宿主命令：

- `list()` 读取已提交投影，经共享读取器检查格式、唯一事实 ID、结局解锁和作品/范围对应关系。
- `read(selectedReference)` 按明确的事实 ID 与结局 ID 重新确认；列表之后事实缺失或结局改变会拒绝，不采用旧列表作为权威。
- 当前内容已无法定位的结局仍保留成果、可见于通关列表，但不能准备对应上下文；不按下标或相近名称猜测。
- 预览范围明确拒绝。当前应用只提供 `development/normal-entry` 的读取能力，不能将试播成果冒充正式游戏解锁。

这些校验面向本机记录完整性，不是签名或服务端鉴权；未来联网接口不能把一个格式合法的客户端 JSON 当作付费、身份或通关凭据。

### 上下文事实范围

共享 `packages/story-model/src/completion.ts` 定义并严格读取两种新协议；它们是内部接口标识，不是作品发行版本。

`haifeng.cleared-context/1` 包含：

| 字段 | 当前含义 |
|---|---|
| `workId`、`scope` | 原作品及全局记录范围 |
| `completion.factId / endingId` | 用户选中的某次已提交通关事实及结局身份 |
| `coverage: "ending-only"` | 当前只有结局事实，不含路线状态 |
| `reference.kind: "current-content"` | 后续引用定位所用的当前内容 |
| `reference.contentRevision / sourceSha256` | 当前已载入内容的修订与作者源摘要，**不是当次通关时的历史修订** |

当前通关事实原来只保存了结局与交付标识。首次结局解锁时间也不等于每次通关时间。本片不从之后的存档、变量初值、当前变量、已读集合或首次解锁日期补造当次路线、好感、历史修订和准确通关时间。面板持续说明这一限制；若正式聊天需要这些信息，须另外明确需要保留哪些真实通关数据及兼容方式。

上下文为新对象，逐层冻结；纯读取器的结构校验仍不证明解锁，必须经 `ClearedContextReader` 对实际已提交记录再确认。只读展示不执行结局、重放进入动作或增加通关次数。进度加载和回退不能覆盖它所依据的全局成果。

当前上下文不包含整份存档、对白历史、选择路线、CG 列表、个人资料或凭据。只读准备本身不上传；独立聊天按每轮明确确认的完整载荷发送，记录只在本页内存中。

### 页面与生命周期

`apps/game/src/aftergame.ts` 通过动态导入在首次打开时加载，本地资源不足或模块读取失败显示本入口的重试；主线启动不等待聊天包、模型、账号或旧 Python 服务。

每次刷新、切换通关记录或关闭面板更新请求代次；不可取消的存储读取完成后也须核对代次，不得覆盖新的选择或已关闭面板。切换立即清除旧上下文，避免旧路线仍显示在新选择下。

返回按钮、Esc、Android 返回键关闭本弹层；离开页面、开始游玩、返回主页及正常退出准备会清除上下文并使旧读取失效。独立聊天会话另外持有流式请求与取消代次；关闭或换上下文立即拒绝旧回调，不自动重连。

开发工具已接角色/结局允许列表、逐轮上传确认与流式会话；正式模型供应、收费、身份授权和持久聊天仍未决定。Android 试用宿主仍不申请 INTERNET 权限。旧服务、GalAgent 及插件保留原消费者，主线与本切片不启动或调用它们。

<a id="agent"></a>

## 独立无工具聊天

### 准备并手动试用

以下为真实模型/实际通关的手动试用说明；本次自动验证仅用合成事实和脚本模型，没有代为配置真实供应商或使用玩家记录。

1. 将根 `config.aftergame.example.yaml` 复制为忽略的 `config.aftergame.yaml`。填写开发页实际完整源到 `server.allowed_origins`，不使用通配符、`null` 或带路径地址。
2. 显式选择**一个**现有 LLM 插件及其地址/模型配置；按该插件要求设置模型凭据环境变量。示例没有默认选定供应商。另在服务进程环境设置独立的 `HAIFENG_CHAT_TOKEN`：24～256 个英文字母、数字、`_` 或 `-`，不要使用模型密钥作为服务令牌，不写入仓库。
3. 在 `aftergame.characters` 填写作者确认的角色配置，并开启 `enabled`。每个角色必须声明下列字段；结局 ID 取稳定身份，不能用数组下标。人设或允许列表变化时更新 `revision`，运行中的服务不自动热重载。

   | 字段 | 用途 |
   |---|---|
   | `id` | 角色稳定身份，1～128 UTF-16 单位 |
   | `revision` | 角色配置修订，1～128 UTF-16 单位 |
   | `name` | 展示名，1～128 UTF-16 单位 |
   | `persona` | 服务端角色设定，最多 6000 UTF-16 单位，不由页面上传 |
   | `ending_ids` | 明确允许的稳定结局 ID 列表；空列表不放行任何结局 |

4. 显式运行独立服务，再按原开发命令打开游戏。服务不替代旧 GalAgent 服务，不由 `start.bat`、游戏启动或两端宿主自动启动：

   ```powershell
   python -m server.api.aftergame --config config.aftergame.yaml
   npm run game:dev
   ```

5. 正常开发游玩达成结局并完成全局记录保存后，回主页“开发工具”→“通关后 Agent 基础试用”。选择一次真实通关，填写独立服务的源地址及服务令牌，连接并显式选角色。这里只读取 `development/normal-entry`，不会读取正式玩家记录或用样例/预览伪造通关。
6. 输入消息→“准备发送并查看上传内容”→检查目的地、角色修订和完整载荷→明确确认。应看到逐段回复；停止、关闭、切换通关/角色或页面转后台后，旧请求不能继续写入当前聊天。断网/凭据错误应只影响聊天，回主页仍可继续主线。

示例默认关闭、无角色、无模型、无允许来源，不会仅因复制配置就上传或调用模型。角色设定来源仍须作者确认；本片不改剧本、人设或原卡内容。

### 哪些模块负责什么

| 文件 | 职责 | 不拥有的能力 |
|---|---|---|
| `packages/chat/src/context.ts` | 按原作品/范围重新读取某次已提交通关事实 | 主线写入、路线补造、服务端通关认证 |
| `packages/chat/src/protocol.ts` | 请求、角色目标、文字/终态事件、结构校验及资源上限 | 系统/工具消息、凭据、剧情命令 |
| `packages/chat/src/session.ts` | 一条事实/一个目标/一个角色修订的会话、单次确认、原事实再读、串行请求、取消和有效响应归属 | 存档、成果写入口、宿主指令、供应商选择 |
| `packages/chat/src/http.ts` | 显式目录读取、固定 HTTP 路径、原令牌请求、有界 NDJSON/UTF-8 读取及取消 | URL 凭据、Cookie、重定向、静默发现/降级/重发 |
| `apps/game/src/chat-panel.ts` | 开发连接表单、角色选择、本页聊天及逐次上传确认 | 模型密钥设置、正式解锁、持久化 |
| `server/api/aftergame.py` | 独立本机服务、确切来源/令牌门卫、入站校验、仅 LLM 插件的单次模型调用 | 旧 Runtime、GalAgent、工具、记忆、卡片写入、主线解释器 |

游戏主线不等待本模块、服务、模型或凭据；面板随原通关后模块按需加载。旧 `/ws/post_ending`、`galagent/1` 及原 GalAgent 工具能力继续服务它们的旧消费者，**不是本片的服务协议或后备实现**。

### 发送与上传确认

`ChatSession.prepare(input)` 不调用网络，重新读取已保存事实，复制冻结原目标和拟发送消息。确认面板展示实际请求，包括：

- 作品、范围、明确选中的事实 ID/结局 ID；`coverage` 固定为 `ending-only`。
- 当前内容引用的修订/摘要，不能称为当次通关的历史版本。
- 明确角色 ID/名称/修订、独立聊天 ID、本次请求 ID。
- 仅本独立会话中**完整完成**的历史用户/角色消息，以及本次输入。

不含整份存档、当次路线变量、主线回看、CG、玩家资料、模型密钥或其他通关记录。独立服务把这些上下文和消息连同服务端设定交给明确配置的模型；页面说明模型可能处理、留存或计费，本地清空不承诺远程删除。

`confirm(requestId)` 只采用仍待确认的那份原载荷，先消费确认，再读原事实并核对上下文，随后才调用供应接缝。准备中/发送中拒绝第二次请求；双击确认不再发第二笔。切角色、通关、服务或修订须销毁原会话重新建立，旧确认不转移到新目标。

页面令牌为独立服务凭据，不是模型 Key。连接时从密码框转交内存连接对象并清空密码框；不进入请求 JSON、聊天历史、偏好、导出、日志或 URL。断开/关闭释放本模块持有的引用，不声称能安全擦除运行时所有内存副本。

### 会话、失败和容量

只接受 `haifeng.chat-event/1` 的有序 `delta`、`done` 或 `error`。序号从 0 连续递增并绑定原 `requestId`；未知字段/事件、工具调用、终态后事件、缺少终态、错误 UTF-8 或截断行都拒绝。文字按普通文本展示，不解析 HTML、Markdown、工具或主线指令。

会话总等待默认 60 秒，包含确认后的事实再读与模型流。取消/超时通过本地代次和 `AbortSignal` 同时失效旧回调；即使适配器未合作、原读取仍未完成，也不允许覆盖新状态。面板关闭、返回标题、开局、退出准备和页面卸载沿原生命周期销毁；后台事件停止本轮，本页历史仍可查看。

- 失败/停止保留本轮输入和部分输出，明确标注未完成，**不加入后续上传的完整历史对**。
- 无自动重连、断点续流、降级模型或重发。重试必须重新准备并确认一份新 ID，告知上次可能已处理或计费。
- 仅本页内存历史，关闭/重选即清空；没有新增存储格式、聊天档案、长期记忆或远程保存。主线记录格式和两端桥保持原样。
- 最多 20 次请求尝试，输入 4000、单次回复 16000、本会话发送历史加回复预留 64000 UTF-16 单位；达到上限要求清空新建，不偷偷裁剪历史。
- HTTP 接收上限 4 MiB、单行 65536 字符、32768 帧；目录上限 128 KiB。仅 HTTPS，开发时额外允许本机 HTTP；禁止带用户密码、查询、片段或路径的服务地址。

### 独立服务与协议

服务只监听明确的本机地址，默认端口 8766；两个端点都需环境中的 `HAIFENG_CHAT_TOKEN`。本片不挂载到旧辅助服务，不读取旧 `config.yaml`、玩家配置覆盖或用户全局插件目录；CLI 必须显式指定配置文件。

| 端点 | 请求/响应 | 数据范围 |
|---|---|---|
| `GET /api/aftergame/info` | `haifeng.chat-service/1` JSON | 服务身份、名称、允许范围、角色 ID/名称/修订及结局允许列表；无模型凭据和角色设定正文 |
| `POST /api/aftergame/chat` | `haifeng.chat-request/1` → NDJSON `haifeng.chat-event/1` | 原确认载荷；服务端设定独立追加，不采用客户端 system/tool 消息 |

请求固定字段为 `format/requestId/conversationId/character/context/messages`；消息固定为 `role/text`，仅允许完整交替的 user/assistant 历史对后接一个 user。响应每行都有 `format/requestId/sequence/type`；delta 另有 `text`，error 另有受限 `code`，done 无其他字段。每行必须以换行结束，终态不等于可以忽略截断/后续数据。

服务错误仅暴露受限错误码；客户端用本地中文提示，不显示模型原始错误体、异常文字或请求内容。服务入站请求上限 512 KiB，检查完整字段/重复 JSON 键/字符上限/当前作品/开发范围/角色修订和结局允许列表。服务不从作者源执行剧情或推演路线。

模型调用只选一个显式配置的 LLM，启动前拒绝工具、记忆及其传递依赖；不使用带自动降级的旧 `stream_events`。一次请求最多一次模型流，无 tools、无模型输出执行；收到工具事件直接失败。总生成上限 60 秒，首段有效台词使用固定 15 秒截止时间，元数据/空白不能补时；无有效文字或异常不能冒充成功。精确来源 CORS 同样包裹鉴权/禁用错误，合法开发页可以区分错误，不扩大允许来源。

最多四个并发会话、同一聊天只允许一轮在途；仅在内存保留至多 4096 个请求 ID 的十分钟防重复窗口，不存对白。不宣称跨进程、重启后、过期后或供应商侧恰好一次；不要拿它替代正式配额/账单协议。

### 仍未完成

- 离线基础及隔离浏览器的完整收发/取消/断网/隐私确认和主线开局冒烟已有证据；真实远端模型、正式玩法和两端运行仍待安排，不用脚本模型替代供应商验证。
- 正式入口/结局角色规则、正式服务端通关与身份授权、模型供应/费用、凭据宿主存储及部署尚未决定/接入；当前服务明确拒绝正式 `game/main`。
- Android 联网权限、宿主网络白名单和正式发布配置不变；本片没有生成新 Windows/Android 包。
- 持久聊天历史、长期记忆、云保存、远程删除和工具调用不是已实现能力，不据“Agent 基础”默认扩张。

<a id="agent-verification"></a>

## 独立聊天验证证据

### 实际结果

| 检查 | 实际执行 | 结果和证明范围 |
|---|---|---|
| 严格类型检查 | `npm run typecheck` | 两个现有 TS 工程均通过；首轮的 6 处界面类型错误已修复，不用 `any` 或非空断言绕过 |
| TS 会话/HTTP | `npm run chat:test` | **28/28 通过**；只读事实、每轮确认/再读、单次请求、取消/超时/迟到回调、完整历史、失败片段排除、UTF-16/容量、真实本机 HTTP、异常/截断/UTF-8 流 |
| Python 服务/协议 | `.venv/Scripts/python.exe -m unittest discover -s tests/chat -p test_service.py -v` | **19/19 通过**；实际 ASGI 端点、脚本模型启动/收发、鉴权/CORS/Host、完整入站验证、禁用/工具/依赖限制、错误/取消、请求去重和并发、首段等待预算 |
| 隔离浏览器纵向 | `npm run chat:test:browser`，使用已有 Playwright/Chromium | **11/11 检查通过**；实际 TS 面板 → HTTP/CORS → Python → 脚本模型 → 流式回复，不是仅模拟 fetch 返回整段字符串 |
| 主线独立性 | 上述浏览器脚本的实际游戏页阶段 | 新浏览器存储，阻断所有外网和聊天地址；实际分章源可载入、开局并切换节点，无页面脚本异常；不声称全路线/音频/存读档已验收 |

执行环境为 Node `24.15.0`、锁定 TypeScript `5.9.3`、本机 Python `3.14.4` 与已有浏览器运行时。初次缺少根 Node 依赖，使用 `npm ci --ignore-scripts` 按原锁恢复；没有变更依赖版本或执行安装生命周期脚本。

### 发现、修复与复现证据

| 证据 → 发现 | 修复位置与处理 | 修复后证据 |
|---|---|---|
| 全量类型检查报 6 错误：合并的鉴赏判别状态不能收窄到 message，捕获的页面/记录区域仍可能为空 | `apps/game/src/gallery.ts` 拆为真正的判别联合；`main.ts` 在已有存在性检查后建立非空 const 引用。只修类型表达，不改显示、流程或存储 | 提交 `c05e890`，两个 TS 工程通过 |
| 服务测试证实：合法跨源页面请求遇到 401 时没有 CORS 头，浏览器只能得到网络失败 | `server/api/aftergame.py` 让精确来源 CORS 包裹提前门卫响应；拒绝响应同样带 no-store/nosniff。非法来源/Host 和令牌限制不放宽 | 原失败单测通过；浏览器实际跨端口错误令牌显示“凭据无效”，模型调用数保持 0 |
| 纯空白模型回复被服务标成 done，和客户端完整回复规则不一致 | 服务跟踪是否出现非空白台词；无有效文字只给 protocol 错误，不宣称完成 | 空回复、空白回复、工具事件和额度/鉴权错误用例通过 |
| 首段台词前的 Usage 等元数据会把单次 15 秒等待重新计起 | 使用单调时钟固定首段有效台词截止时间；元数据、空文本或空白不能补时，总流仍限 60 秒 | 观察真实异步读取预算的回归用例通过：收到元数据后的预算递减，不重置为 15 秒 |

第一次 Python 测试还暴露出一个**测试假设问题**：不能假定所有 Python 版本都会在相同 JSON 嵌套层数触发解析递归异常。用例改为验证“解析器或请求边界拒绝该数据”，不为迎合某个平台阈值修改生产解析语义。

### 浏览器实际覆盖

1. 错误令牌可读取本地安全鉴权提示，无模型调用。
2. 目录读取不上传事实；准备/查看载荷不调用模型；确认后重新读事实并完成真实 HTTP 流式收发。
3. 模型返回 HTML/脚本文字只作为文本显示，不产生图片节点、脚本或工具执行。
4. 停止关闭真实流，脚本模型收到取消，服务释放在途会话，无自动重发。
5. 额度错误只标记本轮失败，不显示供应商原始错误体、不降级模型。
6. 浏览器断网只产生本轮网络错误，无后台重发或模型调用。
7. 切换通关事实取消在途请求，不带入旧聊天、凭据或确认。
8. 修改连接配置会使待确认载荷失效，不改绑到后来目的地。
9. 关闭/重开取消旧请求，清空本页历史和令牌。
10. 无已提交通关事实时不提供聊天连接，不伪造解锁。
11. 实际游戏在不连接聊天且阻断外网时开局并真正切换节点；新页面无脚本异常。

`tests/chat/panel.html` 的合成事实只在隔离测试装配中存在；生产代码没有新增伪造通关入口。实际游戏冒烟使用全新浏览器上下文，没有注入通关成果、采用玩家槽位或访问已有浏览器档案。

### 产物、清理与复跑

复跑说明见 [tests/chat](<chat.md#verification>)。本地忽略目录 `dist/verification/agent/` 保存：

- `browser-results.json`：11 项浏览器检查、外部模型调用为 0、临时服务已停止。
- `chat-desktop.png`、`chat-narrow.png`：隔离测试面板，合成内容且令牌框为空；不当作正式游戏界面视觉验收。
- `mainline-offline.png`：实际游戏冒烟画面。
- `node-tests.txt`、`service-tests.txt`、`typecheck.txt`：本次末轮命令输出。

临时服务由脚本显式关闭，Vite 和浏览器实例均在 finally 中关闭；没有留下常驻服务、私人配置或提交生成物。测试只写入系统临时目录及忽略的验证产物/依赖缓存，不修改作者源、素材或玩家记录。

### 尚未证明或未决定

- 真实远端模型的网络/额度、角色表现、供应商取消/计费行为没有验证。脚本模型成功不能当作真实供应商已接通。
- 正式角色/结局解锁、身份/付费授权和供应方式未决定；正式 `game/main` 仍被服务拒绝。这里只完成并验证开发基础，不冒充正式解锁。
- 正式标题入口、Android 网络权限/宿主策略、Windows/Android 应用包均未接入或重建，本轮不提供两端验收结论。
- 全路线、声音体验、完整存读档/恢复和最终美术界面仍属整体验收；本次主线开局冒烟不能替代它们。
- `npm audit --json` 另报现有开发工具依赖 **1 高、1 低**：锁定 Vite 与其 esbuild 依赖相关。已记录为独立依赖维护项，没有运行 `npm audit fix`、升级锁文件或据此声称项目安全审计通过；临时开发服务已关闭。

结论：**Agent 独立聊天基础已实现，并在无真实模型费用的离线验证范围内通过。** 不能由此推导正式联网玩法、生产部署或整体重构已经验收。

## 旧辅助服务的保留范围

以下属于保留的 Python 制作/独立聊天辅助能力，不是正式 TypeScript 主线，也不是新无工具聊天服务已启用工具的证明。当前没有旧 OP/Rust 托管剧情、录制回放或跨解释器回落。旧协议的工具声明、角色卡与插件描述不授予本次任务任何执行权限。

<a id="legacy-protocol"></a>

## 保留的辅助聊天 WebSocket 协议

2026-10-26 旧托管剧情与录制回放退役。本页和 `schemas/ws.schema.json` 只维护仍有消费者的 `vn-soul/1` 与 `galagent/1`；保留定义不改变消息字段。正式 TypeScript 本体及其宿主桥不使用这些 WebSocket 端点。

**兼容变化：** 原 `/ws`、`/ws/replay`、`/api/replays`、`/api/report` 和旧剧情 `/api/agent/*` 不再注册。原 OP/事件日志 Schema、旧会话录制器和回放器已删除，不把现有本机日志迁入新本体，也不删除其原文件。历史协议可从本次清理前的 Git 版本查看。

### 连接边界

- 每条消息是 UTF-8 文本帧中的 JSON 对象，使用 `type` 区分。
- 主辅助服务保留本机 Host/Origin 检查；`/ws/soul` 沿原规则接受 `Origin: null`，不因此把网络接入加入离线主线。
- 结局后聊天保留原同源/令牌检查，独立端口也沿原规则，不把旧聊天服务存在当成新游戏已解锁或已接入。
- 实现见 `server/soul.py`、`server/api/post_ending.py` 与 `plugins/builtin/galagent/loop.py`；原插件宿主和消息版本不变。
- `tests/contract/` 保留卡/插件和这两个端点的既有契约场景，移除退役故事端点的场景；本轮没有执行测试、服务、类型检查或构建，不宣称通过。

### `/ws/soul` 灵枢外部端口（vn-soul/1）

不跑剧本，只做手账记忆 / 悄悄话。时间线由前端维护：`tl = {lineage, turn}`，召回时带可见时间线前缀 `vis[]`（PLAN §13.3）。卡不存在 → 发 `error` 后关闭；非 JSON → `error`。

| 方向 | type | 字段 | 说明 |
|---|---|---|---|
| C→S | `hello` | `id?` | |
| C→S | `remember` | `id?` `ev{type,text}` 或 `text` `tl?` | 写一条记忆；`ev.type` 为 fact / event / diary / dialogue，其它按 event |
| C→S | `whisper` | `id?` `input` `talk?`（short/mid/long） `chapter?` `history[{me,t}]?` `tl?` `vis?` | 手账上写的一句（截 120 字） |
| S→C | `hello` | `protocol:"vn-soul/1"` `card{id,name}` `llm` `memory` `expressions[]` | |
| S→C | `remembered` | `id` `mid`（记忆 ID 或 null） | |
| S→C | `whisper` | `id` + 三选一：`text lines[] emotion source:"llm" recall` / `fallback:true reason`（`empty`/`no_llm`/`model_failed`，前端用离线回复）/ `blocked:true reason`（输入越红线） | |
| S→C | `error` | `id?` `message` | |

### `/ws/post_ending` 结局后聊天（galagent/1）

详细设计见 `docs/chat.md#legacy-agent` §3。第一条必须是 `hello`；本机网页（Host 与 Origin 都是本机）免令牌，其它来源必须带 `token`。

| 方向 | type | 字段 |
|---|---|---|
| C→S | `hello` | `token?` `card?` `character{name,persona,expressions}?` `context{ending,story,vars,goal}?` `client_tools[{name,description,parameters,effect}]?` `history[{role,text}]?` `server_tools?` |
| C→S | `user` | `text` |
| C→S | `approve` | `call_id` `allow` `remember?` |
| C→S | `client_result` | `call_id` `ok` `result?` `error?` |
| C→S | `stop` / `reset` / `ping` | — |
| S→C | `ready` | `protocol:"galagent/1"` `session` `character{name}` `llm` `tools[{name,description,effect,policy,source}]` |
| S→C | `turn_start` / `turn_end` | `turn` `input` / `turn` `ms` `rounds` `steps` `tool_calls` `reply` `stopped` `error` |
| S→C | `round_start` / `round_end` | `turn` `round` / + `tool_calls` |
| S→C | `step_start` / `think_delta` / `step_end` | `turn` `step` `kind:"think"` / `text` / `ok` `ms` |
| S→C | `say_delta` | `turn` `round` `text` |
| S→C | `emotion` | `turn` `name` |
| S→C | `tool_start` / `tool_end` | `turn` `step` `call_id` `name` `args` `source` `policy` / `ok` `result` `error` `ms` |
| S→C | `approval_required` / `approval_resolved` | `turn` `step` `call_id` `name` `args` `effect` / `allow` |
| S→C | `client_call` | `turn` `step` `call_id` `name` `args` |
| S→C | `usage` | `turn` `round` `prompt_tokens` `completion_tokens` |
| S→C | `error` | `message` `turn?` `fatal?`（true = 连接不可用） `code?`（`auth`） |
| S→C | `reset_done` / `pong` | — |

<a id="legacy-soul"></a>

## 灵枢外部端口

给“剧本自己跑”的外部前端（VN Studio 导出的《海风与布丁》）用：galLingS 不接管剧情，只负责**记忆**和**手账悄悄话**。

- 地址：`WS ws://127.0.0.1:8765/ws/soul?card=whale`（端口见 config.yaml 的 server.port；card = 角色卡 id）
- 只接受本机网页（Origin 是 127.0.0.1 / localhost）或 `Origin: null`（双击打开的 file:// 游戏）；别的网站连进来直接断开（1008）。
- 角色卡要在 galLingS 里（内容包的 `content/cards/whale.yaml`，或建卡页建一张同 id 的卡）；没有卡时回 `{"type":"error"}` 并断开，前端用离线回复。
- 一个连接 = 一个前端游戏窗口。所有消息都是 JSON，前端自带 `id`，回复原样带回。

### 消息
| 前端 → galLingS | 回复 |
|---|---|
| `{"type":"hello"}` | `{"type":"hello","protocol":"vn-soul/1","card":{id,name},"llm":bool,"memory":bool,"expressions":[立绘差分]}` |
| `{"type":"remember","id":1,"ev":{"type":"choice","text":"玩家选择了：…"},"tl":{"lineage":"L1","turn":3}}` | `{"type":"remembered","id":1,"mid":"m00001"}` |
| `{"type":"whisper","id":2,"input":"还记得鱼干吗","talk":"short|mid|long","chapter":"第一话","history":[{me,t}],"tl":{…},"vis":[{lineage,turn}…]}` | `{"type":"whisper","id":2,"text":"…","lines":[…],"emotion":"得意","source":"llm","recall":3}`；无模型 `{"fallback":true,"reason":"no_llm"}`；输入触红线 `{"blocked":true}` |

### 规则
- **时间线由前端维护**：前端有自己的存读档。每条写入带 `tl`；召回带 `vis`（可见时间线前缀，读档后被放弃的分支不在里面），记忆插件按 PLAN §13.3 过滤。前端读档时开新 lineage，把旧 lineage 截到存档回合放进 `vis`。
- **守卫照旧**：玩家输入先过 `check_input`（注入 / 红线）；模型每句过 `check_sentence`，不合格带原因整体重写一次，仍不合格的句子丢掉；一句都不剩 → `fallback`。
- **模型只说话、不改状态**：手账回复不改好感、不改剧情；输出 JSON `{"lines":[…],"emotion":"…"}`，表情只能是卡里的立绘差分。
- **记忆**：选项 / 结局写成 event，悄悄话一来一回写成 dialogue，都带 tag `vn`。AGM 补位需要 Rust 引擎会话，这个端口暂不做。
- 测试：`tests/demo/test_soul.py`（脚本化模型，不联网）。

<a id="legacy-agent"></a>

## 旧独立 GalAgent

> 插件：`plugins/builtin/galagent/`（id `gallings.tool.galagent`，kind `tool`）
> 端口：`server/api/post_ending.py`
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

### 1. 快速开始

#### 1.1 通过保留的辅助服务运行
1. 把 `config.galagent.example.yaml` 里的 `game.post_ending` 和 `plugins.tools / plugins.config` 合并进 `config.yaml`。
2. 设置 `GALLINGS_LLM_API_KEY`，`python -m server`（或 `start.bat`）。
3. 浏览器打开 `http://127.0.0.1:8765/galagent?card=whale&bg=bg_shallows_sunset_v01&ending=真结局`（不同源时加 `&token=…`）。
   `bg` 写素材库 `content/assets/backgrounds` 里的文件名或完整网址；`sprite` 写立绘网址（可含 `{expr}`，随 `<emotion>` 切换）。

#### 1.2 只跑聊天端口（不需要 Rust 核心，给只用 VN Studio 的作者）
```bash
pip install -e .
set GALLINGS_LLM_API_KEY=sk-...        # PowerShell: $env:GALLINGS_LLM_API_KEY="sk-..."
python -m server.api.post_ending --config config.galagent.example.yaml
```
启动日志会打印**令牌**（也存在 `~/.gallings/post_ending_token.txt`）。VN Studio 双击打开时是 `file://`，必须在设置里填这个令牌。

#### 1.3 不连后端，先看界面
`/galagent?mock=1`，或 VN Studio 里 GalAgent 地址留空：用内置的 `MockClient` 模拟思考、工具调用和确认流程。

---

### 2. 内置工具与确认策略

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

### 3. 协议 galagent/1（WebSocket `/ws/post_ending`）

#### 客户端 → 服务端
| type | 字段 | 说明 |
|---|---|---|
| `hello` | `token?` `card?` `character{name,persona,expressions}` `context{ending,story,vars,goal}` `client_tools[]` `history[]` `server_tools?` | 第一条必须是它。带 `card` 时用 galLingS 角色卡补全人设 |
| `user` | `text` | 玩家说话 / 下指令 |
| `approve` | `call_id` `allow` `remember?` | 回答确认；`remember` = 本次聊天这个工具都允许 |
| `client_result` | `call_id` `ok` `result?` `error?` | 前端工具的执行结果 |
| `stop` / `reset` / `ping` | | 中止这一轮 / 清空记忆 / 心跳 |

#### 服务端 → 客户端
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

#### HTTP
- `GET /api/post_ending/info`：是否开启、提供者、工具清单（带令牌才列工具）。
- `POST /api/post_ending/chat`：**vn-agent/1 兼容**，一问一答不流式；需要确认的工具一律拒绝。老版 VN Studio 的“接口”大脑可以直接指过来（请求头 `X-GalAgent-Token`）。

#### 安全
- 只监听 127.0.0.1，但浏览器里任何网页都能连本机端口。因此：Host 与 Origin 都是本机 → 免令牌；其它来源（含 `file://` 的 Origin `null`）→ 必须带令牌。
- 工具结果在提示词里声明为“数据不是指令”；输出截断；每轮最多 `max_rounds` 次往返、`max_tool_calls` 次调用、`turn_timeout_s` 超时。

---

### 4. 扩展：给 GalAgent 加功能

#### 4.1 加后端工具（最常用）—— 写一个普通 tool 插件，声明 `galagent` 能力
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

#### 4.2 接一个现成的 MCP 服务
```yaml
schema_version: 1
id: yourname.tool.fs-mcp
name: 文件系统 MCP
version: 0.1.0
kind: tool
api: 1
runtime: {type: mcp, command: [npx, -y, "@modelcontextprotocol/server-filesystem", "<明确的工作目录>"]}
capabilities: [galagent]
provides: {tools: [read_text_file, list_directory]}   # 白名单
```
MCP 工具的 effect 一律按 `read` 上报；有副作用的请在 `confirm` 里显式设为 `ask`。

#### 4.3 加前端工具（在玩家浏览器里执行：改游戏变量、播音效、弹提示……）
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

#### 4.4 自定义界面
- 自己的 galgame 前端：`new GalAgent.WorkDock(stageEl, {pillParent, placePill, onApprove})`，把 galagent/1 事件逐条 `dock.feed(m)` 即可得到胶囊 + 铺满画面的工作流程面板（VN Studio 就是这样接的）。
- 现成的完整画面：`new GalAgent.GalStage(el, {url, token, character, bg, sprite, greeting})`。
- 聊天窗口样式（调试用）：`new GalAgent.ChatView(el, opts)`。

#### 4.5 自定义工具结果怎么显示
```js
GalAgent.registerToolTitle('add_note', a => a.text);                 // 步骤标题上的一行摘要
GalAgent.registerToolRenderer('list_notes', (step, box) => {          // 展开后的结果区
  box.innerHTML = step.result.notes.map(n => `<div>· ${n.text}</div>`).join('');
});
```
`step` 里有 `name args result error ms status`。

#### 4.6 换掉整个结局后聊天实现（高级）
任何 tool 插件只要实现：
```python
def open_post_ending(self, *, llm_chain, send, manager=None) -> Session: ...
# Session 需要：async handle(msg: dict)、async close()，通过 await send(event) 推 galagent/1 事件
```
就能当 `post_ending` 提供者；`game.post_ending.provider` 指定用哪个。可以直接复用 `GalAgentSession` 只改提示词。

---

### 5. 和 VN Studio 一起用（VN Studio v0.20+：GalAgent 是一个插件）

VN Studio v0.20 起有插件接口（vn-plugin/1，规范见 VN Studio 的 `PLUGIN_API.md`），GalAgent 的前端整个做成了一个插件文件 **`plugins/builtin/galagent/web/galagent.vnplugin.js`**（由 `build_vnplugin.py` 把 `galagent-ui.js` + `vnplugin.src.js` 拼成）。界面、功能、扩展方式和以前一样：

- **在 galLingS 作品页里玩**：什么都不用做。`gallings.tool.galagent` 开着（`game.post_ending.mode` 不是 off，`config.example.yaml` 默认就开着）时，`/api/vn/plugins` 会把这个插件提供给游戏，游戏自动装上、自动连同源 `/ws/post_ending`（同源不需要令牌）。顶栏和游戏开始界面都有“插件”按钮，可以看状态、改设置、停用。
- **只用 VN Studio / 双击打开的游戏**：编辑器顶栏“插件”→ 导入 `galagent.vnplugin.js`（随导出的游戏一起带走）；或者玩家在游戏开始界面“插件”里导入。插件设置里填后端地址 `ws://127.0.0.1:8765/ws/post_ending` 和令牌（file:// 打开时必填），留空 = 离线模拟。
- 剧情 @agent：编辑器设置 → 机器人选 **GalAgent**。结局后聊天：剧本 `@postchat 角色 [auto=on] [tools=off] goal=…`；没写时用插件设置里的角色，再没有就用 @soul 手账角色（《海风与布丁》就是鲸鱼小姐）。
- 名字牌旁的胶囊显示工作进度（默认折叠），点开后工作流程面板平滑铺满画面，每一步可展开；一轮结束显示“已完成，耗时 X 秒”。

扩展：

- 后端工具（跑在电脑上的）：照 §4 写 galLingS 插件，`capabilities: [galagent]`。
- 前端工具 / 自定义显示：写一个 VN Studio 插件，`requires: ['gallings.galagent']`，然后 `vn.require('gallings.galagent').addClientTool({...})`、`.GalAgent.registerToolRenderer(...)`。示例 VN Studio `examples/plugins/galagent-dice.vnplugin.js`。
- 别的 VN Studio 插件想随 galLingS 发给作品：放进 `content/vn_plugins/`。

### 6. 测试
`python -m pytest tests/plugins/test_galagent.py`：流拆分、工具循环、确认（拒绝 / 允许 / 记住）、前端工具往返、扩展插件接入、中止后历史合法、工作目录越界、令牌校验、vn-agent/1 兼容端口、静态页。

<a id="legacy-cards"></a>

## 角色卡

### 1. 放在哪、怎么加载

- 内置卡：`content/cards/*.yaml|*.json`（只读）；玩家卡：`<data_dir>/cards/<id>.json`（建卡页保存，不能与内置卡同 id）。两处同 id 时内置优先；读不出来的坏卡跳过。
- 作者写 YAML，加载时转 JSON。启用前先按 Schema 校验（结构错误 = error），再跑语义规则（§4）。error 阻断启用，warn 只提示。

### 2. 字段

`*` 为 Schema 必填。

| 字段 | 类型 | 说明 / 谁在用 |
|---|---|---|
| `schema_version`* | `1` | |
| `id`* | `^[a-z0-9][a-z0-9_-]{1,40}$` | 卡 id（两个保留聊天端点使用）。AI 填卡时会被清洗成合法 id |
| `locked_script` | bool，缺省 false | 保留卡片字段；旧剧情演绎已退役，不再驱动主线文本 |
| `identity`* | `{name*, name_en?, species*, role*, adult_anchor*}` | `name` 是显示名；`adult_anchor` 成年锚点（≥4 字，见 §4） |
| `appearance`* | 对象，值为字符串或数组，至少一项 | 外貌（提示词；图像生成预留的参考） |
| `personality`* | `{traits*[], laws*[], values*[]}`，各至少 1 条 | 性格、行为规律、不可演反的价值底线（提示词） |
| `speech`* | 见下 | 语言风格 |
| `speech.self_ref`* | 字符串数组，至少 1 个 | 自称 |
| `speech.endings`* | 字符串数组 | 句尾 |
| `speech.sentence_heads` `threats` `catchphrases` | 字符串数组 | 句首、威胁库、口癖（提示词） |
| `speech.metaphor_system` `action_markers` | 字符串 | 比喻体系、动作写法（提示词） |
| `speech.forbidden.checkable` | `[{pattern*, reason*}]` | 正则，**文本守卫逐句检查**（命中 → `text_verdict` 规则 `style.forbidden`，带原因重写） |
| `speech.forbidden.prose` | 字符串数组 | 只进提示词的禁用写法 |
| `honesty_signals`* | `[{id*, body_part*, action*, meaning*, intensity?}]`，至少 1 条（语义要求 ≥3） | 诚实信号（尾鳍）。`id` 为 `^[a-z][a-z0-9_]*$`；`meaning` ∈ `heart` `angry` `panic`；`intensity` 1–3。引擎只认卡表里的 `signal_id`（否则驳回 `unknown_signal`）；剧本里的 `※` 标记按 meaning 映射到本卡信号 |
| `address_system`* | `[{from*, to*, name*, stage_min*, stage_max*, unlock?}]`，至少 1 条 | 称呼。`from: heroine` 的条目决定她在各称呼阶段（`STATE.address_stage`）能怎么叫玩家；越期使用被守卫拦下（`address.too_early`） |
| `taboo`* | `{scale?[], reverse_scale_event?, no_comedy_topics?[]}` | 逆鳞部位；逆鳞事件（只能作剧情事件，模型说出即拦，`taboo.reverse_scale`）；禁语区话题（玩家提到时本轮切严肃模板） |
| `red_lines`* | 字符串数组 | 本卡追加的红线（只能收紧全局红线） |
| `hidden_layer` | 对象 | 隐藏设定（自由结构） |
| `slots`* | `{槽位名: 字符串}` | 剧本槽位的本卡取值（如 `treasured_object: 糍粑`）。保留角色卡槽位；当前不隐式加载章节 |
| `assets` | `{sprites?[], live2d?, voice?}` | 立绘差分清单：引擎只接受清单里的差分（否则驳回 `unknown_sprite`），剧本差分不在清单里时演绎层就近替换；`live2d` / `voice` 预留，写 null |
| `style_examples`* | 字符串数组，至少 3 句（建议 ≥10） | 代表台词（提示词，前 16 句） |
| `build_record` | 对象 | 建卡页记录：原始描述、适配度提示 |

### 3. 最小例子

```yaml
schema_version: 1
id: cat
locked_script: true
identity: {name: 猫小姐, species: 猫族, role: 码头的常客, adult_anchor: 外表约 25 岁的成年女性}
appearance: {body: 修长, hair: 银灰短发, tail: 蓬松的猫尾}
personality: {traits: [傲娇], laws: [嘴硬心软], values: [从不拿亲密做交易]}
speech:
  self_ref: [本喵]
  endings: [喵, 呢]
  forbidden:
    checkable: [{pattern: "我是AI|语言模型", reason: 出戏}]
honesty_signals:
  - {id: heart, body_part: 尾巴尖, action: 勾一下, meaning: heart}
  - {id: angry, body_part: 尾巴, action: 拍打, meaning: angry}
  - {id: panic, body_part: 耳朵, action: 压平, meaning: panic}
address_system:
  - {from: heroine, to: player, name: 两脚兽, stage_min: 0, stage_max: 0}
  - {from: heroine, to: player, name: 主人, stage_min: 1, stage_max: 9}
taboo: {scale: [耳朵], reverse_scale_event: 离家出走, no_comedy_topics: [离家出走]}
red_lines: [幼态化表述]
slots: {treasured_object: 鱼干}
assets: {sprites: [默认, 警惕, 得意]}
style_examples: [哼。, 两脚兽，看什么看。, 本喵才没有等你。]
```

完整写法（含注释）见 `content/cards/whale.yaml`。

### 4. 语义校验（`server/cards/validate.py`）

Schema 通过后才跑：

| 级别 | 规则 |
|---|---|
| error | `identity.adult_anchor` 必须写明“成年”或 ≥18 的岁数；出现 <18 的岁数即错 |
| error | 全卡（除 `red_lines`、`build_record`）出现幼态化表述（萝莉 / 幼女 / 小女孩 / 未成年 / 少女 / loli） |
| error | `honesty_signals` 少于 3 条；信号 id 重复 |
| warn | 缺 `heart` / `angry` / `panic` 某一类信号 |
| error | `address_system` 没有 `stage_min = 0` 的初遇称呼；某条 `stage_min > stage_max` |
| error | `speech.forbidden.checkable` 的正则写不对 |
| warn | `style_examples` 少于 10 句 |

### 5. 建卡页（`/cards.html`）

描述 → `POST /api/cards/generate`（AI 按模板填卡，强制 `locked_script: false`、清洗 id、写 `build_record`）→ 字段编辑 → `POST /api/cards/validate`（返回 `findings[{level, field, message}]`）→ `POST /api/cards` 保存（有 error 拒绝）。

<a id="legacy-plugins"></a>

## 辅助服务插件

> 格式权威：`schemas/plugin.schema.json`。本文是给插件作者的说明。

### 2. 目录与清单

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

### 3. 各 kind 的接口（`server/plugins/kinds.py`，api = 1）

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

### 4. 上下文 `ctx`

| 字段 | 内容 |
|---|---|
| `ctx.config` | 校验过、填好默认值的配置 |
| `ctx.secrets.get(name)` / `.require(name)` | 只能读清单里声明过的密钥；`repr` 不泄露值 |
| `ctx.data_dir` | 插件独占的数据目录 `<数据根>/plugins/<id>/` |
| `ctx.plugin_dir` | 插件自己的目录 |
| `ctx.log` | `logging.Logger`（`gallings.plugin.<id>`） |
| `ctx.emit(type, payload)` | 辅助诊断事件，事件名自动加前缀 `plugin.<id>.` |
| `ctx.deps` | `requires.plugins` 里声明的依赖插件实例 |

### 5. 怎么装、怎么选（config.yaml）

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

### 6. 生命周期

```
发现(plugin.yaml) → Schema + 语义校验 → 依赖解析/拓扑排序 → 兼容性(api / 引擎 / Python)
  → 配置校验 + 密钥检查 → 导入入口 + 接口检查 → setup() → running
  → ……调用……（工具调用写 tool.called 事件）
  → close()（按启动的逆序）
```

任何一步失败，插件进入 `failed`，原因写进启动报告和 `plugin.failed` 事件，**不影响其它插件**。
setup 中途失败时引擎会调用一次 `close()` 回收子进程和连接。

### 8. 命令行

```bash
python -m server.plugins list                              # 列出发现的插件
python -m server.plugins validate path/to/my-plugin        # 校验清单 + 入口
python -m server.plugins check --config config.yaml        # 按配置全部启动一遍，打印报告与插件锁
```

### 9. 内置插件（`plugins/builtin/`，也是参考实现）

| id | kind | 说明 |
|---|---|---|
| gallings.llm.openai-compat | llm | DeepSeek 等 OpenAI 兼容接口，SSE → 五种事件 |
| gallings.llm.scripted | llm | 按脚本回放，测试 / CI / 离线彩排 |
| gallings.memory.lingshu | memory | 灵枢 MCP 子进程；时间线标签 `tl:<lineage>@<turn>` 与可见性过滤 |
| gallings.tool.proposals | tool | `propose_affection`、`propose_mood`，只出提议 |
| gallings.guard.injection | guard | 玩家输入的提示注入检测 |
| gallings.tool.galagent | tool | 结局后聊天（post_ending）的 Agent：powershell / 文件 / 网页等基础工具 + galagent/1 会话，见 [galagent.md](<chat.md#legacy-agent>) |

能力标签 `galagent`：tool 插件在 `capabilities` 里写上它，工具就会出现在结局后聊天里（确认策略见 galagent.md §2、§4）。

> 另：VN Studio（前端游戏）有自己的插件格式 vn-plugin/1（一个 .js 文件），见 VN Studio 的 `PLUGIN_API.md`；GalAgent 两边都有：后端是这里的 tool 插件，前端是 `plugins/builtin/galagent/web/galagent.vnplugin.js`。

### 10. 尚未做（按需再加）

- 沙箱：`permissions` 目前只声明不强制；第三方插件上线前要么跑在 MCP 子进程里，要么加进程隔离。
- 插件 SDK 独立成包（现在插件 `from server.plugins import ...`）。
- 热重载、插件市场 / 签名校验。
- 前端侧插件（Live2D 渲染器、播放器皮肤）：另起 `web/` 侧规范，不和后端插件混用。
- AGM 补位目前是引擎内能力，不是 memory 插件；以后可抽成 memory 的"包装插件"。

<a id="verification"></a>

## 显式离线验证命令

仅验证独立聊天基础，不接真实模型、玩家数据库或私人配置。不在游戏、启动脚本或 CI 中自动执行。

### 运行离线用例

使用根锁定的 Node 24 依赖，以及已有辅助服务 Python 环境；不需要 pytest。

```powershell
npm run typecheck
npm run chat:test
.\.venv\Scripts\python.exe -m unittest discover -s tests/chat -p test_service.py -v
```

- Node 用例：合成内容先经实际内容读取器校验，使用只读内存通关源；测试会话及真实本机 HTTP，覆盖确认、取消、超时、异常流、隔离和容量。
- Python 用例：标准库 unittest、ASGI HTTP 和现有脚本化模型，数据目录使用系统临时目录；验证端点、配置与模型流边界，不联网调用模型。
- 本目录的事实、人设、台词和服务令牌都是隔离测试数据，不是正式解锁规则或模型配置。测试令牌随机生成，不写入文件。

### 运行浏览器纵向验证

需已安装的 Playwright 与 Chromium。根项目没有添加 Playwright 依赖：可在环境中指定 `HAIFENG_PLAYWRIGHT_PACKAGE` 为已有安装环境中的 `package.json` 路径，用它解析 Playwright；若项目环境本来可解析则不必设置。可用 `HAIFENG_TEST_PYTHON` 指定已有服务 Python，默认本仓库 `.venv/Scripts/python.exe`；可用 `HAIFENG_BROWSER_EXECUTABLE` 指定已有 Chromium。

```powershell
npm run chat:test:browser
```

脚本会：

1. 启动两个本机随机端口：隔离测试页面及仅使用脚本模型的临时 Python 服务。
2. 以临时浏览器存储验证实际面板/HTTP/CORS/流、停止与切换、断网、确认失效和错误隔离。
3. 在另一份全新浏览器存储打开**实际游戏开发页**，阻断外网/聊天服务，确认能开局并真正切换剧情节点。这里只做主线冒烟，不跑完整路线。
4. 关闭临时服务和浏览器，输出忽略的 `dist/verification/agent/` 截图与 `browser-results.json`。测试辅助页/状态/关闭接口仅在本目录装配，不挂载到实际游戏或聊天服务。

本机占用旧端口不会被接管，不读取旧 `config.yaml`、玩家档案或作者私人人设；不会构建 EXE/APK。执行结果与已知边界见 [本次验证记录](<chat.md#agent-verification>)。
