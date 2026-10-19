# 透明鲸鱼 UI 与平滑渐变接入

- 负责人 / 执行 agent：@Atri-Lobato 的 agent（用户授权“根据更新说明和仓库逻辑更新游戏”）
- 状态：已集成（视觉方向待团队试玩确认）
- 更新时间：2026-10-17
- 任务分支：`feat/whale-ui-fades`
- 基线提交：`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`
- 交付提交 / PR / 附件：见本分支 PR；交付清单 [archive/deliveries/whale-ui](../../../archive/deliveries/whale-ui/README.md)

## 本次目标与影响范围

把作者本地修改的透明鲸鱼 UI 与界面叠化接入当前运行作品。只改 `content/imports/vnstudio/海风与布丁/index.html`；新增交付归档与本记录。

## 兼容变化与交叉点

- 剧情、变量、选项、存档结构、项目/节点/素材 ID、`game.js`、assets 均不变。
- 与 [玩家体验打磨](player-experience-polish.md) 交叉：保留 `game-polish.css` 的底栏文字标签、选项左右排布、7 项主页；鲸鱼皮肤叠加其上，`WHALE_UI_REPO_ADAPTER` 只调间距与底栏宽度。
- 与 [美术重制](image25-art-upgrade.md) 交叉：主页按原稿放右侧，会叠在新封面人物上；用户确认按原稿、封面不改。

## 依赖与尚未对齐的内容

- 主页位置与错位步长按原稿；仅因 7 项把间距由 44 px 收为 26 px。
- 单文件版未重新生成；Firefox/Safari/触屏、GalAgent 手账停靠、听感未测。
- DeepSeek 鲸鱼图形许可待核实。

## 实际验证与交付

本地 Chromium（Playwright，`file://`，1280×720）：

- 内联脚本语法检查通过；页面无脚本错误。
- 主页 7 项、对话、剧情选项截图与合并前对比：皮肤生效，标签完整，主页 7 项完整在画面内。
- 开始→推进→存档→再推进→读档，回到同一句；切换后无残留叠化层。

## 下一位 agent 的接续点

作者再出 UI 修改时，以 `archive/deliveries/whale-ui/original-files/index.html` 为新祖先做三方合并，不要整包覆盖运行目录。
