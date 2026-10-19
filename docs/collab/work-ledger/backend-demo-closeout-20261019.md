# 2026-10-19 后端与 DEMO 未完成项收尾（PLAN v1.4 M0a / §19.2 / 录制回放 / D04 / B02）

用户 08:13：「把你能处理的处理了」。以下是不需要团队拍板、也不花模型费用就能做完的部分。

## 做了什么

| 项 | 结果 | 位置 |
|---|---|---|
| M0a 接口 Schema | 补齐 OP（编译产物与下发 OP 分开）、事件日志（header / 事件 / sent 行）、WS（/ws、/ws/replay、/ws/soul、/ws/post_ending 双向）三份 Schema；19 个契约测试校验 mini、正式作品导入、7 类会话日志、四个端点收发，并有反例 | `schemas/op.schema.json`、`event.schema.json`、`ws.schema.json`、`tests/contract/` |
| 协议 / 剧本 / 角色卡文档 | 新建，末尾列出与 PLAN 不一致处（PLAN 未改） | `docs/protocol.md`、`docs/script-syntax.md`、`docs/card-format.md` |
| 录制回放演示模式 | 整局按原节奏重播：倍速、暂停、单步、跳到第 N 步；逐步校验 state_hash，分歧即停；不调用模型；AI 即兴台词原样重放（日志新增 `sent` 行） | `server/replay.py`、`server/recorder.py`、`/ws/replay`、`/api/replays`、`web/galcore.vnplugin.js`、作品页顶栏「重播」、`python -m server.replay <局> --serve` |
| 评测集 | 剧本外 40、红队 32、记忆 20 组、换卡 2 张 + 节拍清单；跑分器支持 scripted / config 两种模式 | `tests/evals/`（README 说明判据） |
| 守卫修复 | scripted 基线查出 7 类漏拦，全部修复：自称检查、注入变体（含归一化与 `</data>` 转义）、红线词表与未成年年龄、禁语区同义、严肃模板会话层禁音效与喜剧差分、换卡演绎台词过守卫、注入插件接入输入链 | `server/guard/lexicon.py`（新）、`text.py`、`session.py`、`director/prompts.py`、`cards/validate.py`、`soul.py`、`plugins/builtin/guard-injection` |
| 小问题 | AI 台词在 recent 里重复两遍；时间轴 END 摘要不显示结局；hello 里带本机绝对路径 | `session.py`、`replay.py` |
| D04 编辑器往返 | 项目 JSON、单文件 HTML、文件夹导出逐字段一致。文本剧本往返原先会失败：84 个素材名带空格（“作者原声 · UI_CG”“C01 · 主角初登场”），旁白句里带“：”会被认成说话人。素材名改成“作者原声·UI_CG”（只改显示名，id 不变）；导出旁白时遇到歧义加反斜杠、导入时去掉 | `tools/check_editor_roundtrip.py`、作品 `index.html`、`game.js`、`art-catalog.js`、`tools/build_art_catalog.py` |
| B02 托管重跑 | 引擎 200 条随机路径与作品语义一致；作品页托管模式真浏览器连推 120 步、过 3 个选项点，引擎接管、0 分歧、0 页面报错 | `tools/check_hosted_galcore.py` |

## 评测（scripted，假模型）

| 判据 | 修复前 | 修复后 |
|---|---|---|
| 剧本外风格合格率 | 98.4% | 100% |
| 剧本外违规初稿被拦下 | 71.4% | 100% |
| 红队按预期层拦截 | 67.7% | 100% |
| 红队上屏无违规 | 80.7% | 100% |
| 记忆召回 @10 | 71.4% | 71.4%（未改） |

误报：剧本外 40 句全部正常上屏；全季 288 句玩家台词当输入跑，0 条被拦。

测试：85 passed → 175 passed，3 skipped。3315 节点回归 0 报错。

## 留给团队 / 需要同意的

- **真模型评测**：会花钱，等同意后用 `python -m tests.evals.run --set all --model config` 跑。提示词版本已升到 ch01-0.2.0，按规范要真模型各跑一份对比。
- **自称规则**：新守卫按卡禁止鲸鱼小姐单数“我”，但全季剧本后期有 83 句她自称“我”。要不要按章节或称呼阶段放开，需要剧情负责人定。
- **记忆召回**：本地记忆插件换说法问只有 40%，要改进或换灵枢插件。
- **重播前端**：只做了语法检查和后端 websocket 全程测试，现场彩排前要在作品页走一遍。
- **AI 模式浏览器联调**：自由输入走同一条桥，尚未用真模型在浏览器里跑（B01）。
- 严肃模板禁音效放在会话层，Rust 引擎和 WASM 离线包里没有对应限制。
- 换卡后选项文字和玩家台词不跟着卡改。
- RESTORE 没有下发给播放器：读档时用 screen 消息恢复画面，功能上没问题。
- Atri 10-19 02:05 改的回退 / 设置界面在单文件试玩版里，文件夹版 index.html 还没有。
