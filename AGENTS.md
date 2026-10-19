# 团队 agent 开工入口

更新：2026-10-20。用户在当前会话里的明确要求优先于这里的约定。10-18 及以前的长版入口（含逐日快照）存档在 [handoff/AGENTS_20261018_历史.md](docs/collab/handoff/AGENTS_20261018_历史.md)，只当历史看。

## 先读
1. [接手说明](docs/collab/接手说明.md)：用户的现行指令、必须保留的东西、已验证的做法。
2. [工作流速查](docs/collab/工作流速查.md)：验证、出试玩包 / APK、合并单文件改动、配音配乐、修图、后端。
3. [最新交接 Hark会话交接_20261020](docs/collab/handoff/Hark会话交接_20261020.md)：分支现状、用户定的规则、未完成事项（与其他文档冲突时以它和用户最新指令为准）。
4. [待办总表](docs/collab/待办总表.md)：还没做的、要负责人拍板的。
5. [决策记录](docs/decisions.md)；文档总目录 [docs/README.md](docs/README.md)。

## 仓库与分支
- 仓库 https://github.com/Liyang1145/galLingS（公开，2026-10-16 起；不要提交密钥、令牌或用户的私人信息）。旧的 `TanPowasd/galLingS` 只是迁移来源，不推。
- 接续分支 `fix/character-performance`；`main` 停在 f336b35，需要一次合并提交。**合 main、改可见性或成员先问音乐负责人 @Liyang1145。** 别的会话也可能往工作分支推，push 被拒就基于远端新头重建。 `tanpowasd/dev` 留给 TanPowasd 继续桌面封装。
- 作品本体 `content/imports/vnstudio/海风与布丁/`。以 Larry 的 VN Studio 作品为基线，按台词 / 素材 ID 合并，**不整包覆盖 `game.js` 或 `index.html`**；作者包和单文件试玩版都只按差异移植。

## 分工
音乐 @Liyang1145（负责人）；配乐 Atri-Lobato；画面 / 交互 LarryE135；引擎与桌面 TanPowasd；GalAgent boliyer。

## 协作约定
- 每个任务在 [work-ledger](docs/collab/work-ledger/) 按 [模板](docs/collab/work-ledger/_template.md) 建一份记录：负责人、分支、基线提交、影响文件、接口变化、验证结果、还缺什么。索引见 [work-ledger/README.md](docs/collab/work-ledger/README.md)。
- 不要把“文件已保存”“接口已定义”写成“已集成”“已验收”。播放解码通过不等于听感验收。
- 必须保留：3315 节点、原 3308 句 ID 及顺序、用户新写的第一话、选项与变量、现有音乐与停奏。
- 动作声用真实素材，缺的留白登记，不用程序化提示音或节拍。
- 不自行编版本号、不冻结音乐 / 美术、不强推、不重写历史、不为减小仓库改写既有历史。
- 不提交凭据、个人设置或未授权的本地资料；大资源交付保留来源、清单和校验码。
- 图片改动先出候选给用户验收，确认后再推；剧情、音频、界面可按已授权范围直接推。
- 鲸尾一律对齐 L01；改尾巴用 Image2.5 双图编辑重画，不移植像素（用户 10-19）。
- `.github/workflows/playtest-html.yml` 已被用户叫停（10-20），删不删先问用户；改作品文件夹的推送仍会触发它。
- 标题菜单按作者鲸鱼 UI 原稿放右侧，不要移到左边。
- 改完至少跑 `python tools/check_full_regression.py`（期望 nbad 0、nerrs 0）；改文档跑 `python tools/check_md_links.py`。
