# WebSocket 协议

> 接口冻结文档（PLAN §14.1、§18 M0a）。机器可读定义：`schemas/ws.schema.json`（消息）、`schemas/op.schema.json`（`ops` 里的渲染指令）、`schemas/event.schema.json`（时间轴行、事件日志）。
> 本文与 Schema 都**以实际代码为准**：`server/session.py`、`server/api/app.py`、`server/replay.py`、`server/soul.py`、`plugins/builtin/galagent/loop.py`。
> 契约测试 `tests/contract/test_schemas.py` 把真实收发的每一条消息拿去校验，代码一改协议就会红。

## 0. 通则

- 每条消息是一个 JSON 对象（UTF-8 文本帧），用 `type` 区分种类。字段表里 `?` 表示可选。
- 服务只监听 127.0.0.1。`LocalOnlyGuard` 要求 Host 是本机名；有 Origin 时必须是本机网页（`/ws/soul` 额外放行 `Origin: null`，即双击打开的 `file://` 游戏）。不满足时 WebSocket 以 1008 关闭。
- 未知 `type` 一律回 `error`，连接不断。
- 前端是“哑渲染器”：不持有规则，状态以服务器推送为准。

| 端点 | 用途 | 协议名 | 实现 |
|---|---|---|---|
| `/ws?card=&mode=&start=&restore=&endings=` | 引擎会话：一个连接 = 一个会话 = 一个引擎 + 一份事件日志 | —（`hello` 里不带版本） | `server/session.py` |
| `/ws/replay?log=&speed=&max_gap=&paused=&from=`（也可 `/ws?replay=<id>`） | 录制回放演示模式：按原节奏重播一局，不调用模型 | — | `server/replay.py` `ReplayPlayer` |
| `/ws/soul?card=` | 灵枢外部端口：VN Studio 这类“剧本自己跑”的前端的手账记忆 / 悄悄话 | `vn-soul/1` | `server/soul.py` |
| `/ws/post_ending?card=` | 结局后自由聊天（GalAgent） | `galagent/1` | `plugins/builtin/galagent/loop.py` |

## 1. `/ws` 引擎会话

### 1.1 连接参数

| 参数 | 说明 |
|---|---|
| `card` | 角色卡 id，缺省 `game.default_card`。卡不存在 → 发 `error` 后关闭 |
| `mode` | `choice` / `ai`，缺省 `game.default_mode`；没配模型时 `ai` 自动降为 `choice` |
| `start` | VN Studio 作品的章节入口句 ID：服务端以 `start` 动作开局；不带则以 `advance` 开局 |
| `restore` | 非空 = 读档局：服务端不自己开局，等客户端发 `restore` |
| `endings` | 本机已收集的结局数（剧本只读变量 `结局数`） |

连接后服务端先发 `hello`，再自动走第一步（除非 `restore`）。服务器当前没有剧本时只发一条 `error` 就关闭。

### 1.2 客户端 → 服务端

| type | 字段 | 说明 | 写入事件 |
|---|---|---|---|
| `start` | `line_id` | 从某章开头开局（VN Studio：`CHAPTER` 的 `src = vn:<line_id>`）。只能是第一个动作；找不到入口回 `error` | `start{pc}` |
| `advance` | — | 下一句。停在选项点或已结束时回 `error` | `advance` |
| `choose` | `option_id` | 点选项 | `choice{option_id}`（+ `memory_write`） |
| `input` | `text` | AI 模式、选项点上打字（截 200 字）。其它时候回 `error`；本选项点即兴轮数用尽时引擎驳回 `input_closed` 并回 `error` | `player_input`、`text_verdict`、`memory_recall`、`intent`，进入 AI 回合时还有 `turn_begin`/`model_tool_call`…/`turn_commit` 或 `turn_abort`、`fallback` |
| `mode` | `mode`: `choice`\|`ai` | 切模式。没配模型时切 `ai` 回 `error`；停在选项点时重发一次当前 `CHOICE` | `mode_switch` |
| `save` | `slot?`（缺省 `"1"`） | 存到服务端内存槽位，回 `saved` | `save` |
| `load` | `slot?` | 读档 = 开新时间线 `<原线>.<n>`，回 `screen{live:true}`；空槽位回 `error` | `load{slot, snapshot, new_lineage}` |
| `snapshot` | — | 要一份可带走的引擎快照（播放器自己存档用），回 `snapshot`。不改状态、不记事件 | — |
| `restore` | `save`（上面 `snapshot.save` 原样） | 新会话从带走的快照接着跑（内部走 `load`）。`content_hash` 不符回 `error` | `load` |
| `seek` | `seq` | 调试时间轴拖动：从头回放到 `seq`，回 `screen{live:false}`。只看，不改进度 | — |
| `diary` | — | 打开日记本，回 `diary` | `diary_view` |

### 1.3 服务端 → 客户端

| type | 字段 | 说明 |
|---|---|---|
| `hello` | `session` `card{id,name}` `mode` `llm` `memory` `chapter{id,title}` `seed` `header` | 连接后第一条。`header` = 事件日志头去掉整张卡（`event.schema.json#/$defs/header_fields`） |
| `ops` | `ops[]` | 一批渲染指令（`op.schema.json#/$defs/render_op`），通常以 `STATE` 结尾。见 §1.4 |
| `timeline` | `row` | 每个事件提交后一条：事件行（`seq kind source payload verdicts state_hash wall_ms`）+ `out[]` 指令摘要（≤12 条）+ `state{affection,tails,lineage,turn,wait,mode,vars}`；`choice` 行带 `option_text`；`load` 行的 payload 只剩 `slot`、`new_lineage` |
| `busy` | `on` | AI 回合开始 / 结束（输入框据此禁用） |
| `notice` | `message` | 给玩家的提示：引回选项、连续失败退回纯选项、日记写好了 |
| `saved` | `slot` `turn` | 存档成功 |
| `snapshot` | `save{snapshot,content_hash,seq,recent[],choice_op}` | `snapshot` 是引擎快照的 JSON **字符串** |
| `screen` | `screen{scene,bgm,sprite,say,choice,state,tail}` `live` + 见右 | `live:true`：读档完成，带 `state`（STATE op）；`live:false`：时间轴预览，带 `seq` `replay_ok` `line_id`（VN 句子 ID 或 null）。`restore` 后 `screen` 为 `{}` |
| `diary` | `entries[{text,turn,lineage}]` | 日记本（只读） |
| `error` | `message` | 引擎拒绝 / 参数不对 / 未知消息 |

> 与 PLAN §14.1 的差异：没有 `say_stream`（即兴台词按句以 `ops` 里的 `SAY` 下发）、没有 `state` 消息（状态是 `ops` 里的 `STATE`）、服务器消息不带递增 `seq`、没有 `last_seq` 断线补发；多了 `hello` `notice` `saved` `snapshot` `screen` `diary` 与客户端的 `start` `snapshot` `restore` `diary`。

### 1.4 `ops` 里的渲染指令

完整字段见 `schemas/op.schema.json`。控制流 OP（`JUMP` `JUMP_IF` `MERGE` `BEAT` `FLAG`）只在引擎里执行，不下发。

| op | 关键字段 | 说明 |
|---|---|---|
| `SAY` | `speaker` `text` `layer` `origin` `voice?` `src?` `id?` `name?` `hash?` `slots?` `pause?` | `layer`：`line` / `narration` / `action`。`origin`：`locked` 锁定台词、`script` 剧本、`performed` 演绎层改写、`improvised` AI 即兴、`fallback` 降级默认台词。AI 即兴的句子没有 `src`。播放器不区分 origin（只在调试时间轴显示） |
| `CHOICE` | `id` `beat_id` `options[{id,label,nature?,set?,cond?}]` `default_line?` `line_id?` `timeout?{seconds,default_option}` | 条件不满足的选项已滤掉，`target` 已去掉 |
| `SCENE` | `id` `bg` `time?` `event?` `name?` | 换场 |
| `BGM` | `id`（null = 停） `fade_in?` `fade_out?` `file?` | |
| `SPRITE` | `card` `expr`（null = 退场） `pos` `kind`（`static`/`live2d`） | |
| `TAIL` | `signal_id` `count` `desc?` `noticed?` `source`（`script`/`ai`） `meaning?` | 诚实信号（尾鳍） |
| `AFFECT` | `surface` `inner` `reason` `source` | 剧本好感标记（数字是否显示由前端“作弊”开关决定） |
| `SET` | `set[{var,op,value}]` | VN Studio 变量修改 |
| `CHAPTER` | `id` `title` | 章节开头 |
| `CG` / `SAVEPOINT` / `END` | `id` `desc?` / `id` `name` / `ending_id` `kind` | `END.kind`：`chapter` / `ending` / `script_end` |
| `STATE` | `affection` `tails` `mood` `address_stage` `wound` `mode` `input_open` `lineage` `turn` `wait` | 每步末尾的显示用状态；`input_open` 决定输入框是否开放 |
| `RESTORE` | — | 读档后引擎吐出（目前只出现在回放 / 预览的 op 流里） |

## 2. `/ws/replay` 录制回放演示模式

服务器不调用模型，只把日志里的事件按录制节奏喂给引擎，逐条比对 `state_hash`；画面消息取日志里的 `sent` 行（旧日志没有时按事件重建）。

连接参数：`log`（会话 id，`/ws?replay=` 等价）、`speed`（倍速，0.1–1000）、`max_gap`（两步最大间隔秒数，缺省 8）、`paused`（`1`/`true` 开局暂停）、`from`（开局先跳到第 N 步）。日志不存在 / 剧本对不上 → 发 `error` 后关闭。

### 2.1 客户端 → 服务端

| type | 字段 | 说明 |
|---|---|---|
| `pause` / `resume`（= `play`） | — | 暂停 / 继续 |
| `step` | — | 暂停状态下走一步 |
| `speed` | `speed` | 改倍速 |
| `jump`（= `seek`） | `step`（或 `at`） | 跳到“已走 step 步”那一刻，回 `screen{replay:true,live:true,at}` |
| `stop` | — | 结束重播 |
| `/ws` 的玩家操作 | | 照收不生效，回 `replay{event:"ignored"}` |

### 2.2 服务端 → 客户端

`hello`（多一个 `replay{id,steps,at,speed,paused,recorded_screen}`，`session` 为 `replay-<id>`，`llm`/`memory` 为 false）、`timeline`、`ops`、`screen`、`notice`、`error` 与 `/ws` 相同，另加：

| `replay.event` | 字段 | 说明 |
|---|---|---|
| `step` | `at` `steps` `seq` `kind` | 走完一步 |
| `choose` | `option_id` `label` `seq` | 即将重放玩家的选择（先高亮） |
| `input` | `text` `seq` | 即将重放玩家打的字 |
| `done` | `steps` `ok` | 放完 |
| `diverged` | `seq` `step` `kind` `expected` `got` `message` | 第一处分歧（日志被改过或引擎变了），之后不再下发 |
| `control` | `id` `steps` `at` `speed` `paused` `recorded_screen` | 控制消息回执 |
| `ignored` | `message` `of` | 重播中玩家操作不生效 |

## 3. `/ws/soul` 灵枢外部端口（vn-soul/1）

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

## 4. `/ws/post_ending` 结局后聊天（galagent/1）

详细设计见 `docs/design/galagent.md` §3。第一条必须是 `hello`；本机网页（Host 与 Origin 都是本机）免令牌，其它来源必须带 `token`。

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

## 5. 事件日志与 sent 行（供对照）

`/ws` 的每个动作都先变成事件喂给引擎，再由 `server/recorder.py` 写进 `data_dir/sessions/<会话id>/events.jsonl`（`schemas/event.schema.json`）：第 1 行 `header`；之后每个事件一行 `{seq,kind,source,payload,verdicts,state_hash,wall_ms,display?}`；以及 `{kind:"sent",after_seq,msg}` 行——那一刻发给前端的 `ops` / `screen` / `notice`，只给 `/ws/replay` 原样重放画面用，不进引擎。`timeline` 消息就是事件行加上显示用的摘要。
