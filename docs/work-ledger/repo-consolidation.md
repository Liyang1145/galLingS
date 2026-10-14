# 仓库收敛：只留一个 galgame / galagent

- 负责人 / 执行 agent：@TanPowasd / Hark
- 状态：进行中（引擎接管作品剧情已实现并验证；目录整理未做）
- 更新时间：2026-10-14
- 任务分支：`tanpowasd/dev`
- 基线提交：`f45ec51`，期间合入 `main` `22d231f`（PR #5）
- 交付提交 / PR / 私有附件：本分支

## 本次目标与影响范围

按 PLAN 把仓库收敛成一个引擎、一份内容、一个画面。盘点见 [inventory.md](../inventory.md)。第二步（本次）：剧情交给 galcore 运行。

- `compiler/vnstudio.py`（新）：VN Studio `game.js` → 章节 JSON / OP 程序 + 导入报告；确定性。
- `core/src/engine.rs`：`State.vars`（空时不序列化）、`Config.vars_init`、OP `SET` / `JUMP_IF`、选项 `set` / `cond`、事件 `start`。
- `server/runtime.py`、`server/session.py`、`server/api/app.py`：`game.source: vnstudio` + `game.vn_game`；`/ws?start=<章节入口句ID>&endings=<本机结局数>`；托管时向作品提供 `gallings.galcore` 插件。
- `web/galcore.vnplugin.js`（新）：作品页里接管“下一句 / 选项 / 结局”，按引擎给的句子 ID 渲染；AI 模式在选项点加“（自己说）”交给导演。
- `content/cards/whale.yaml`：鲸鱼小姐卡入库（仓库已私有，引擎会话需要）。
- `config.example.yaml`：默认游戏改为《海风与布丁》。

## 兼容变化与交叉点

- 作者原件 `content/vn/海风与布丁/` 未改；句子 ID、素材 ID 原样。离线 `游玩.html` 不经过服务器，行为不变。
- 第一话 Markdown 编译路径保留（`game.source: script`），旧章节 state_hash 不变（vars 为空不序列化）。
- 托管模式下读档局、从非章节开头开始的局暂由作品自身运行（控制台注明），引擎存读档同步待做。

## 实际验证与交付

- `cargo test` 通过；`pytest` 82 通过、2 跳过。
- 导入《海风与布丁》：3308 句、18 章、58 选项点、4 结局，两次导入字节一致；好感可达区间 [0, 571]。
- 200 条随机选项路径：引擎句序、结局、好感、尾鳍与按作品运行时规则写的参照实现逐句一致（`tests/demo/test_vnstudio.py`）。
- 真实浏览器（Chromium）作品页：开始游戏 → 4 个选项点，引擎接管、无分歧告警；该局事件日志回放 96 个事件 state_hash 逐条相同。本地 sparse clone 缺图片，画面素材显示未在本机核对。
- 未测：AI 模式“自己说”的浏览器流程（需模型）。

## 下一位 agent 的接续点

1. 引擎存读档与作品存档对齐（作品存档里带引擎快照）。
2. AI 模式浏览器联调（脚本化模型或团队模型）。
3. 按 inventory §4 整理目录（`music/` 并入素材库、交付凭证进 `archive/`），改路径时同步 `游玩.html`、`start.bat`。
