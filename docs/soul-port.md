# 灵枢外部端口（vn-soul/1）

给“剧本自己跑”的外部前端（VN Studio 导出的《海风与布丁》）用：galLingS 不接管剧情，只负责**记忆**和**手账悄悄话**。

- 地址：`WS ws://127.0.0.1:8765/ws/soul?card=whale`（端口见 config.yaml 的 server.port；card = 角色卡 id）
- 只接受本机网页（Origin 是 127.0.0.1 / localhost）或 `Origin: null`（双击打开的 file:// 游戏）；别的网站连进来直接断开（1008）。
- 角色卡要在 galLingS 里（内容包的 `content/cards/whale.yaml`，或建卡页建一张同 id 的卡）；没有卡时回 `{"type":"error"}` 并断开，前端用离线回复。
- 一个连接 = 一个前端游戏窗口。所有消息都是 JSON，前端自带 `id`，回复原样带回。

## 消息
| 前端 → galLingS | 回复 |
|---|---|
| `{"type":"hello"}` | `{"type":"hello","protocol":"vn-soul/1","card":{id,name},"llm":bool,"memory":bool,"expressions":[立绘差分]}` |
| `{"type":"remember","id":1,"ev":{"type":"choice","text":"玩家选择了：…"},"tl":{"lineage":"L1","turn":3}}` | `{"type":"remembered","id":1,"mid":"m00001"}` |
| `{"type":"whisper","id":2,"input":"还记得鱼干吗","talk":"short|mid|long","chapter":"第一话","history":[{me,t}],"tl":{…},"vis":[{lineage,turn}…]}` | `{"type":"whisper","id":2,"text":"…","lines":[…],"emotion":"得意","source":"llm","recall":3}`；无模型 `{"fallback":true,"reason":"no_llm"}`；输入触红线 `{"blocked":true}` |

## 规则
- **时间线由前端维护**：前端有自己的存读档。每条写入带 `tl`；召回带 `vis`（可见时间线前缀，读档后被放弃的分支不在里面），记忆插件按 PLAN §13.3 过滤。前端读档时开新 lineage，把旧 lineage 截到存档回合放进 `vis`。
- **守卫照旧**：玩家输入先过 `check_input`（注入 / 红线）；模型每句过 `check_sentence`，不合格带原因整体重写一次，仍不合格的句子丢掉；一句都不剩 → `fallback`。
- **模型只说话、不改状态**：手账回复不改好感、不改剧情；输出 JSON `{"lines":[…],"emotion":"…"}`，表情只能是卡里的立绘差分。
- **记忆**：选项 / 结局写成 event，悄悄话一来一回写成 dialogue，都带 tag `vn`。AGM 补位需要 Rust 引擎会话，这个端口暂不做。
- 测试：`tests/demo/test_soul.py`（脚本化模型，不联网）。
