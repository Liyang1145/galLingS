# 文档目录

更新：2026-10-20。入口顺序：根目录 [README](../README.md) → 本页 → 接手说明 / 工作流速查 / 最新交接 / 待办总表 / 决策记录。文档之间说法冲突时，以**最新交接**和用户最新指令为准。
仓库已公开（2026-10-16 起）：文档里不要写密钥、令牌或用户的私人信息。改完文档跑 `python tools/check_md_links.py` 检查相对链接。

## 现行（先看这些）
- [collab/接手说明.md](collab/接手说明.md) — 用户现行指令、必须保留的东西、已验证做法
- [collab/工作流速查.md](collab/工作流速查.md) — 日常操作怎么做（验证、出包、合并单文件改动、配音配乐、修图、后端）
- [collab/handoff/Hark会话交接_20261020.md](collab/handoff/Hark会话交接_20261020.md) — **最新交接**：分支现状、用户定的规则、未完成事项
- [collab/待办总表.md](collab/待办总表.md) — 待办、待拍板与已完成
- [decisions.md](decisions.md) — 决策记录（按编号，后面的覆盖前面的）
- [collab/work-ledger/](collab/work-ledger/README.md) — 每次任务的记录与验证（索引）

## 计划与设计
- [PLAN.md](PLAN.md) — 总体计划（立项方案，含历史 Demo 说明）
- [protocol.md](protocol.md) · [script-syntax.md](script-syntax.md) · [card-format.md](card-format.md) — 协议、剧本语法、角色卡格式（接口冻结文档）
- [design/demo.md](design/demo.md) — 后端运行与 DEMO 状态
- [design/vn-page.md](design/vn-page.md) — 托管作品页
- [design/plugin-format.md](design/plugin-format.md) — 插件格式
- [design/galagent.md](design/galagent.md) — 结局后聊天 GalAgent（离线版结局入口缺失见待办 B08）
- [design/llm-router.md](design/llm-router.md) — 托管版多模型插件：模型列表、切换正在用的模型、思考等级（设置 → 模型）
- [design/ai-model.md](design/ai-model.md) — 作品内「设置 → AI 模型」（离线 / 单文件 / APK 直连模型）
- [design/memory-bench.md](design/memory-bench.md) — 记忆系统实测
- [design/soul-port.md](design/soul-port.md) — 灵枢外部端口
- [design/art-editor.md](design/art-editor.md) — 美术编辑器

## 内容
- 音乐：[music-progress.md](content/music-progress.md)（进度总表）· [music-direction.md](content/music-direction.md) · [music-tracklist.md](content/music-tracklist.md)
- 音效缺口：[sfx-gaps.md](content/sfx-gaps.md)
- 美术生产：[content/art-production/](content/art-production/)（Image2.5 全量重制分析与清单、精修图包接续标准等；10-17 前的生产计划，现行美术规则以接手说明为准）
- [player-aesthetic-review.md](content/player-aesthetic-review.md) · [opening-revision-20261015.md](content/opening-revision-20261015.md)

## 协作资料
- [collab/audit/20261018/](collab/audit/20261018/) — 10-18 全面审查报告：[剧本](collab/audit/20261018/script_report.md) · [美术](collab/audit/20261018/art_report.md) · [音频与界面](collab/audit/20261018/audio_ui_report.md)
- [collab/playtest/](collab/playtest/) — 用户与队友的试玩原稿、配音清单
- [collab/handoff/](collab/handoff/) — 交接与历史快照（`*_历史.md` 只当历史看）：
  - [接手说明 10-19](collab/handoff/接手说明_20261019_历史.md) · [接手说明 10-17](collab/handoff/接手说明_20261017_历史.md)
  - [待办总表 10-19](collab/handoff/待办总表_20261019_历史.md) · [待办总表 10-17](collab/handoff/待办总表_20261017_历史.md)
  - [AGENTS 10-18](collab/handoff/AGENTS_20261018_历史.md) · [共享台账 10-17](collab/handoff/共享台账_20261017_历史.md) · [剩余任务 10-14](collab/handoff/剩余任务_20261014_历史.md) · [最新游玩 10-17](collab/handoff/最新游玩_20261017_历史.md) · [仓库盘点 10-14](collab/handoff/仓库盘点_20261014_历史.md)
  - JSON 清单（保持原样）：`completion-package-manifest.json`、`completion-payload-verification.json`、`local-pending-files.json`、`withdrawal-validation.json`

## 仓库其他说明
- [tools/README.md](../tools/README.md) — 脚本索引 · [tools/voice-pipeline/README.md](../tools/voice-pipeline/README.md) — 配音流水线
- [content/README.md](../content/README.md) · [content/assets/README.md](../content/assets/README.md) — 剧本、角色卡、素材库
- [plugins/builtin/galagent/README.md](../plugins/builtin/galagent/README.md) · [content/vn_plugins/README.md](../content/vn_plugins/README.md) — GalAgent 与作品插件
- [tests/evals/README.md](../tests/evals/README.md) — 评测集
- `archive/deliveries/*/README.md` — 各次交付原件清单（历史）
