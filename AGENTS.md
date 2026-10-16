# 团队 agent 开工入口

- **2026-10-17音乐新决定：最早《翡翠之梦》定义为见面曲，主曲另定。** 原MP3、稳定ID及当前播放位置暂保留；新主曲与变奏基准未定，不能因旧ID含main或M6/E3/M7同SHA就标主曲完成。先读[音乐进度](docs/content/music-progress.md)和[定位记录](docs/collab/work-ledger/emerald-meeting-cue.md)。

- **2026-10-17最新接手入口：[接手说明](docs/collab/接手说明.md)。用户明确要求弃用C27、暂停全部CG并交给其他agent；不得沿旧待办或生图计划继续制作/测试。4句C27已从本地撤回，所有候选与接口测试图退选，其余采用CG保留。当前新修图、运行代码、音效调度和归档仍未随文档上传；只读远端拿不到本轮本地成果，先核对[待交付清单](docs/collab/handoff/local-pending-files.json)。**

下列带日期记录和数字为各次历史快照；与最新接手说明冲突时，以用户新指令及接手说明为准。

用户在当前会话中的明确要求优先于这些协作约定。这里帮助并行工作，不增加每次修改都要问用户的审批流程。

- 当前仓库是 **https://github.com/Liyang1145/galLingS**，公开（2026-10-16按用户明确要求从私有改为公开），默认分支 `main`。旧的 `TanPowasd/galLingS` 是迁移来源，不是默认推送目标。不得在未获用户明确指示时再更改可见性、增加外部协作者或把内容另发到其他公共仓库。此前私有状态按历史记录理解，见[可见性记录](docs/collab/work-ledger/repository-public-visibility.md)。
- 开工先读 [共享台账](docs/collab/coordination-ledger.md)、[决策记录](docs/decisions.md)，再读本次工作涉及的接口/素材说明。历史记录、草稿建议、当前有效决定要区分，不把别的 agent 的推测当成用户要求。
- 查看 [任务记录目录](docs/collab/work-ledger/)。在自己的任务记录中说明负责人、分支、基线提交、影响文件、接口变化、依赖和验证结果。初始化记录不等于任务已经由其联系人认领；开始实际修改时由执行者更新。
- 新任务按 [模板](docs/collab/work-ledger/_template.md) 建独立文件。主要更新自己的记录，保留别人的记录；共享台账只维护基线和跨模块问题，避免多人反复重写同一张总表。
- 修改前检查远端进度和本地未提交改动。推荐独立任务分支、小范围提交；用户已经明确授权的提交、修复和合并按其指示执行。不要重置他人分支、覆盖工作区、强推或重写历史来消除冲突。
- 一般可逆修复可直接在已授权范围内完成。跨模块改动先标明兼容影响；有不同方案时保持各自分支与成果，优先用适配方式兼容旧接口。未对齐的联合改动标为待集成，同时继续不依赖它的工作。
- 画面与交互以 LarryE135 交付的最新完整 VN Studio 作品为核对基础；`main` 的外层播放器不是游戏内容包。交接分支中的旧 RenPy 工程和制作中 Live2D 检查点不能冒充最新作品。
- 2026-10-13最新完整作者包已代交到 `content/imports/vnstudio/海风与布丁/`，校验清单在 `archive/deliveries/larry-vn/`。以此核对新接入，保留作者原件；历史旧包与代理本地整合不自动覆盖它。
- 2026-10-13用户后续已明确授权提交全部本地成果。当前 `content/imports/vnstudio/海风与布丁/` 纳入以该作者包为基线的场景/音乐音效融合，详见 [本次记录](docs/collab/work-ledger/local-scene-audio-assembly.md)。原始index.html、game.js保留在 `archive/deliveries/larry-vn/original-overridden-files/`，其他135项及原ZIP保留；原件manifest仅用于作者来源核对。44张背景原件、提示词与审核在 `content/assets/scene-backgrounds/`，不要恢复3处临时取景或7张退出播放的错误CG。角色/人物CG暂缓、音乐按Atri方向、未冻结或发行新版本。
- 音乐由 @Liyang1145 负责。保留原始音频、素材 ID 和剧情/存档定位；缺真实动作声时留白，不自动补电子提示音或节拍。播放解码通过不等于听感验收通过。
- 项目仍在探索期，不自行编发布版本号、冻结音乐/美术方案或把本地探索包当成正式 DEMO 发布。用户明确要求入库的文档和素材可按该次授权提交。
- 不提交凭据、个人设置或未经授权的本地资料；大资源交付保留来源、清单和校验码。不要为了减小仓库而重写既有历史。
- 2026-10-13用户后续授权代交boliyer的GalAgent覆盖包并统筹最新游玩。当前统一入口为根目录 `游玩.html`（离线剧情）及 `start.bat` 启动的作品页（同一作品、GalAgent需配置模型）；[统筹记录](docs/collab/work-ledger/boliyer-galagent-integration.md) 与 [最新游玩说明](docs/collab/latest-play.md) 为新接入依据。原覆盖包归档，不直接整包覆盖已有音乐、美术和剧情定位。
- 完成后在自己的记录里写清改了什么、验证了什么、尚缺什么。不要把“文件已保存”“接口已定义”写成“已经集成”或“已验收”。
- 玩家视角打磨见 [本轮记录](docs/collab/work-ledger/player-experience-polish.md)、[审美审核与缺口](docs/content/player-aesthetic-review.md)。默认不展开空手账；字号是玩家偏好；模型状态在连接设置查看；候选音频收起但原件仍在。勿整包回退这些交互修正；角色/人物CG和未交付音乐仍按原分工继续。
- 2026-10-14用户明确恢复素材开发并要求入库。根目录 `引擎开发.html` 为同一作品的编辑入口，176项/209图像文件均可调用；微调项目JSON不直接改运行包，草稿与玩家存档隔离。接续读 [开发说明](docs/design/art-editor.md) 和 [任务记录](docs/collab/work-ledger/art-editor-library.md)。Atri E1/E2/E7已接入，M6与主曲同SHA去重，E5/E6仅候选；32个旧WAV有MP3播放副本，原件保留。不得整包覆盖这些接入，不将“已请求Image2.5”写成“后端已确认路由”；人物重制仍待做。
- 2026-10-15用户后续已授权按两张新参考全量重制人物/场景/CG/封面，取代此前“人物先放着”。本轮112项审核后装配或备用可调用；90/92个当前播放视觉ID已替换。用户明确决定L17/L18/C23泳装原文服饰留待人工，不采用外搭候选顶替。新第一话新增7句但保留3308个原ID，当前3315节点；后续章节非画面字段和103音频资产不变。开发库418项/564文件。接续必须读 [本轮台账](docs/collab/work-ledger/image25-art-upgrade.md) 和 [人工缺口](docs/content/art-production/参考重制与人工缺口.md)，勿用旧导出覆盖新文案、素材或存档定位。请求max未实际返回、模型未回传，不声称路由已核实。
- 2026-10-15本地后续：用户要求角色演出超越旧稿，并指出坐姿大腿与P16裙摆错误。接续读 [演出精修与坐姿返工](docs/collab/work-ledger/character-direction.md)：当前新S01/S02结构已装回，退选交腿原件保留但不能恢复播放。132项审核/117播放视觉ID、470项开发库；P16戒指和既定泳装仍待人工。此为`fix/character-performance`本地精修，未推送；不要把远端main与本地状态混称。人工微调交接用JSON/完整HTML，纯文本剧本不完整保留新增视觉元信息。
- 2026-10-15用户随后要求额度用尽前先上传当前进度：`fix/character-performance`检查点包含前述演出/坐姿返工及[场景融合接续](docs/collab/work-ledger/scene-character-integration.md)。54个背景有可编辑角色光色，写诗提笔到诗句13句统一C08，柜台一体C26替代退选拼接；当前133项审核/118播放视觉ID、472项开发库。已列[未完成动作与一致性](docs/content/art-production/角色与场景融合审核.md)，不视为全部美术验收，不自动合main、不编发布号。新旧回放截图须辨别，不能恢复P18柜台试摆或整包覆盖本轮CG分配。
- 2026-10-16用户明确只修当前Image2.5批次，不用Larry旧图。C12/C18误画的身体擦伤已去除，C18/P09/O11鲸尾单双叶/三叶结构修正；新图原位替换，O11继续备用，不改3315句或103音频。当前133项审核/118播放视觉ID、476项开发库/648文件；本轮本地未推送，见[修正与验证记录](docs/collab/work-ledger/tail-skin-corrections.md)。`*_rejected_*`旧稿为退选留档，禁止自动恢复；情绪受伤不可再画成外伤。
- 2026-10-16音乐负责人提供E4《日落空守》（暂定名），原MP3和播放副本已保存，3段77句只改BGM：第九话黄昏、第十话数日等待、第十一话救援后重新回应前。原103音频/所有视觉与文案不变，新增后音频104项；通话争执、解释失败、水下救援继续留白。接续读[E4记录](docs/collab/work-ledger/e4-sunset-wait.md)与`content/audio/e4-integration.json`，不得整体回退音乐；稳定ID为`bgm_e4_sunset_wait`，曲名仍可改。本轮仍在本地，未推送。
- 2026-10-16后续音乐负责人指定录音机MP3为M1浅滩曲，正式曲名未定，99.6935秒。稳定ID`bgm_m1_shallows_day`已进入第三话下潜准备和第七话捡贝壳2段61句；E4、角色重点出场、契约、事件曲与其停奏保留。当前音频105项（原104项元数据与字节不变），3315句非BGM字段不变；本轮本地未推送，见[M1记录](docs/collab/work-ledger/m1-shallows-day.md)及`content/audio/m1-integration.json`，不要整包覆盖音乐映射。
- 2026-10-16用户随后明确要求同步音乐进度：发布和接续使用既有`fix/character-performance`完整作品分支，不自动合main；[音乐进度总表](docs/content/music-progress.md)为当前6首已用/1首候选及M2/M3等缺口入口，先前“未推送”为历史快照。同步包含M1/E4原件、运行接入、校验与共同美术基线，见[同步记录](docs/collab/work-ledger/music-progress-sync.md)。
