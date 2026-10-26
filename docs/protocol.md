# 辅助聊天 WebSocket 协议

2026-10-26 旧托管剧情与录制回放退役。本页和 `schemas/ws.schema.json` 只维护仍有消费者的 `vn-soul/1` 与 `galagent/1`；保留定义不改变消息字段。正式 TypeScript 本体及其宿主桥不使用这些 WebSocket 端点。

**兼容变化：** 原 `/ws`、`/ws/replay`、`/api/replays`、`/api/report` 和旧剧情 `/api/agent/*` 不再注册。原 OP/事件日志 Schema、旧会话录制器和回放器已删除，不把现有本机日志迁入新本体，也不删除其原文件。历史协议可从本次清理前的 Git 版本查看。

## 连接边界

- 每条消息是 UTF-8 文本帧中的 JSON 对象，使用 `type` 区分。
- 主辅助服务保留本机 Host/Origin 检查；`/ws/soul` 沿原规则接受 `Origin: null`，不因此把网络接入加入离线主线。
- 结局后聊天保留原同源/令牌检查，独立端口也沿原规则，不把旧聊天服务存在当成新游戏已解锁或已接入。
- 实现见 `server/soul.py`、`server/api/post_ending.py` 与 `plugins/builtin/galagent/loop.py`；原插件宿主和消息版本不变。
- `tests/contract/` 保留卡/插件和这两个端点的既有契约场景，移除退役故事端点的场景；本轮没有执行测试、服务、类型检查或构建，不宣称通过。

## `/ws/soul` 灵枢外部端口（vn-soul/1）

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

## `/ws/post_ending` 结局后聊天（galagent/1）

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

