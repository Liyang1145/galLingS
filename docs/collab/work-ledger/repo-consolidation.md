# 仓库收敛：只留一个 galgame / galagent

- 负责人 / 执行 agent：@TanPowasd / Hark
- 状态：运行层收敛完成（唯一引擎接管作品剧情、存读档对齐）；目录已在 tanpowasd/dev 按 inventory §4.1 迁移，合入 main 前待音乐与美术编辑器负责人确认；AI 模式浏览器联调延后
- 更新时间：2026-10-14
- 任务分支：`tanpowasd/dev`
- 基线提交：`f45ec51`，期间合入 `main` `22d231f`（PR #5）
- 交付提交 / PR / 附件：本分支

## 本次目标与影响范围

按 PLAN 把仓库收敛成一个引擎、一份内容、一个画面。盘点见 [inventory.md](../handoff/仓库盘点_20261014_历史.md)。第二步（本次）：剧情交给 galcore 运行。

- `compiler/vnstudio.py`（新）：VN Studio `game.js` → 章节 JSON / OP 程序 + 导入报告；确定性。
- `core/src/engine.rs`：`State.vars`（空时不序列化）、`Config.vars_init`、OP `SET` / `JUMP_IF`、选项 `set` / `cond`、事件 `start`。
- `server/runtime.py`、`server/session.py`、`server/api/app.py`：`game.source: vnstudio` + `game.vn_game`；`/ws?start=<章节入口句ID>&endings=<本机结局数>`；托管时向作品提供 `gallings.galcore` 插件。
- `web/galcore.vnplugin.js`（新）：作品页里接管“下一句 / 选项 / 结局”，按引擎给的句子 ID 渲染；AI 模式在选项点加“（自己说）”交给导演。
- `content/cards/whale.yaml`：鲸鱼小姐卡入库（当时仓库为私有，引擎会话需要；2026-10-16 起仓库已公开）。
- `config.example.yaml`：默认游戏改为《海风与布丁》。

## 兼容变化与交叉点

- 作者原件 `content/imports/vnstudio/海风与布丁/` 未改；句子 ID、素材 ID 原样。离线 `游玩.html` 不经过服务器，行为不变。
- 第一话 Markdown 编译路径保留（`game.source: script`），旧章节 state_hash 不变（vars 为空不序列化）。
- 存读档：作品存档时附带引擎快照（存档对象新增 `galcore` 字段，作品自己不读它）；读这样的存档会开新会话 `/ws?restore=1` 并发 `restore`，引擎按 PLAN §13.3 开新时间线接着跑。快照的 content_hash 与当前剧本不同（作品更新过）或旧存档没有快照时，这一局由作品自身运行。从非章节开头开始的局同样交还作品。
- WS 新消息：`snapshot`（只读，不记事件）、`restore`；`start` 只能是会话第一个事件。

## 实际验证与交付

- `cargo test` 通过；`pytest` 82 通过、2 跳过。
- 导入《海风与布丁》：3308 句、18 章、58 选项点、4 结局，两次导入字节一致；好感可达区间 [0, 571]。
- 200 条随机选项路径：引擎句序、结局、好感、尾鳍与按作品运行时规则写的参照实现逐句一致（`tests/demo/test_vnstudio.py`）。
- 真实浏览器（Chromium）作品页：开始游戏 → 4 个选项点，引擎接管、无分歧告警；该局事件日志回放 96 个事件 state_hash 逐条相同。本地 sparse clone 缺图片，画面素材显示未在本机核对。
- 存读档：会话级测试（存 → 新会话恢复 → 结局、好感、尾鳍、变量与不中断一致，日志回放一致，剧本不符时拒绝）；真实浏览器在第 2 个选项点存档，回标题读档后选同一项，走到下一个选项点的句子与数值与不中断那局相同；读档局日志回放 37 个事件逐条一致。pytest 83 通过、2 跳过。
- 未测：AI 模式“自己说”的浏览器流程（需模型）。

## 调试时间轴（2026-10-14，用户“开始接着开发”）

- PLAN §14 的调试时间轴回到唯一播放器：作品页外框 `web/vn.html` 右侧栏（`web/timeline.js` + `vn-polish.css`），默认常开、可收起并记住。
- 数据路径：服务器 `timeline` 消息 → 作品页里的 galcore 桥（同源 `postMessage`）→ 外框侧栏。每行 = 事件日志一条：事件、来源（引擎/玩家/模型）、裁决（放行/限幅/驳回/降级着色）、好感/尾鳍变化、state_hash 前 8 位、本步上屏台词与选项原文；顶部显示当前好感、尾鳍、时间线、回合、作品变量。
- 点一行 = `seek`：服务器从头回放到该条，回传那一刻的台词 ID、画面状态与回放校验结果；侧栏显示那一刻的背景缩略图、台词与状态，"回到现在"关闭，不改当前进度。
- 服务器端只加显示字段（`out`、`state`、`option_text`、seek 的 `line_id`），不进日志、不影响回放。
- 验证：pytest 83 通过、2 跳过（新增时间轴行与 seek 断言）；浏览器截图走过开局、两个选项、回放到 #7、存档后读档（侧栏显示新时间线 L0.1），无页面脚本错误；读档局日志回放一致。

## 下一位 agent 的接续点

1. 目录迁移已在本分支完成（见 [inventory §4.1](../handoff/仓库盘点_20261014_历史.md)）；合入 main 前请 @Liyang1145（音乐）与美术编辑器负责人确认路径变化。
2. AI 模式浏览器联调（用户：对 demo 不急，延后）。
