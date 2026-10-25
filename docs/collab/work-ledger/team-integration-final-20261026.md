# 队友成果选择性整合与 Windows 便携打包

- 负责人 / 执行 agent：@Liyang1145 / DeepSeek Harness（接续 Codex 主会话收尾）
- 状态：源码与本地运行验证已通过；桌面 CI、最终便携包和外部交付记录另行核验
- 更新时间：2026-10-26（Asia/Shanghai）
- 任务分支：fix/character-performance
- 基线提交：683e29ae7f00648b73f890b99c1803f349f04f48
- 交付提交 / PR / Release 附件：随本记录所在整合提交；不建 Release，不合 main

## 本次目标与影响范围

按用户“接上任务继续干，完成仓库合并和游戏文件打包”的要求，以干净远端基线选择性整合，不整分支覆盖：

1. A01/A02 阅读与进度保护：轻微字色适配、默认 ghost 0.55、独立自动档、继续游戏、刷新恢复、退出与保存失败保护。
2. Larry 695a9d6 的环境音文档与一行注释。
3. Boliyet 桌面改进：当前模块化宿主的便携后端、启动诊断、Windows Job Object、纯游戏初始化和根目录作品的 Windows 便携组装器。

只改 12 个运行/工具文件，另加本记录与索引。正式播放器、index.html、3315 节点、稳定 ID、剧情、素材、配音、音乐、GalAgent 与 Linux 路径保持。

## 兼容变化与交叉点

- game.js 仅 settings.ghost 从 0.35 改为 0.55；BGM 默认仍 25%，第三话起语音默认关闭。
- player.js/game-polish.css 按已验证补丁精确更新，保留 saveKey、idbSet、键盘、语音和宿主接口。
- 桌面只保留 modular backend/host_api/tools 与 Range 支持，新增启动失败原因和 Windows 子进程清理；不引入另一套 llm-router 或旧单体宿主。
- 打包默认作品路径为仓库根“海风与布丁”；后端/插件按当前完整目录收集。
- 排除 rebuild、nnn 视频、旧 Live2D 模型、未选择美术、真实配置、密钥、存档与日志。main 和 tanpowasd 三个分支已包含，不重复 cherry-pick。

## 依赖与尚未对齐的内容

- 旧 desktop-patch-verification-plan 仅作结构基线；其中 53 处哈希与 683e29a 不一致，以远端 Git blob 为准并另存漂移清单。
- 旧计划另缺 17 个现行后端/多模型/宿主模块，已按 683e29a 补齐；最终运行清单重新生成，不强行维持旧 1206 文件数。
- rebuild 的 99 个独有提交仍未完成独立类型检查、构建与验收，不在本轮。
- 在线模型仍需用户配置；灵枢 MCP 的外部服务不是离线剧情验收前置条件。

## 实际验证与交付

- node 语法检查：player.js、game.js、web/vn.js 通过；新 Python 工具编译检查通过。
- python -m unittest -q tests.test_windows_app_packaging：6 项通过。
- python -m pytest tests/contract tests/plugins tests/test_windows_app_packaging.py -q：80 通过、1 跳过。
- 全作浏览器回归：3315 节点，nbad=0、nerrs=0；18 章、存读档和回退通过。
- check_player_progress.py：11 项全部通过，errors=[]；默认 ghost 0.55、刷新音频位置、环境音、自动/手动档、稳定 ID 与保存失败保护通过。
- 内容机械审计：18 张现行静态图/279 处采用、29 处撤回保持；824 条语音、前两话 150 句、945 个音频逐 SHA、16 首在用 BGM 通过；L15/C20 与 B02T C/F3 不变。
- Windows 运行资源计划：1223 个文件；6 项打包边界测试通过，nnnVideosIncluded=false、nnnLive2DIncluded=false、rebuildIncluded=false。
- 上述均为源码、功能与机械检查，不宣称重新完成全作人工听审或美术验收。桌面 CI、EXE 实机与最终 ZIP 校验在外部交付记录中继续核验。

## 下一位 agent 的接续点

- 不要回到旧脏检出；以本记录所在远端提交和外部 team-integration-final-20261026 交付目录为准。
- 继续保留 18 张图及撤回状态、前两话已确认录音和第三话语音开关语义。
- 若继续桌面工作，先读取外部 Windows 实机与进程清理结果；不要把旧 WASM 离线包当本次完整 Python 便携包。
- 若继续 rebuild，必须作为独立引擎迁移另行验证，不得替换正式播放器或污染本包。
