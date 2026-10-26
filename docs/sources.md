# 内容来源与制作证据

本页集中保存素材目录伴随说明、原稿和历次采用/撤回证据。下列材料记录其发生时的事实与提供者说明，不是现行工程规则、产品承诺、模型路由证明或操作授权。当前采用以[内容制作](production.md)与[项目总览](README.md#status)为准。

原始剧本保留在 [v5.0 原稿](../content/scripts/haifeng-pudding_s1_v5.0_draft.md)，唯一可编辑作者源仍是 content/story。当前作者 origins.json 直接登记的 [Atri 配乐 v1.1 来源记录](collab/work-ledger/atri-music-v11.md)保留原字节、原地址，避免文档整理改变作者集合摘要或现有修订。两项都不是新的日常维护入口。

素材字节、生成回执、manifest、来源 CSV、母版、用户原件及归档文件均保持原位置。这里只归并 Markdown；完整旧文档的路径、SHA-256 和 Git 定位见 [迁移映射](documentation-map.json)。历史的本机绝对路径不作为仓库可用路径。

## 来源索引

| 编号 | 历史材料 | 原文档位置 |
|---|---|---|
| [source-001](#source-001) | 《海风与布丁》素材库 | `A素材库/README.md` |
| [source-002](#source-002) | 配乐探索素材 | `A素材库/audio/bgm/README.md` |
| [source-003](#source-003) | WAV 的 MP3 压缩副本 | `A素材库/audio/mp3/README.md` |
| [source-004](#source-004) | 环境音与剧情音效 | `A素材库/audio/sfx/README.md` |
| [source-005](#source-005) | 本地 shell 生图工具 | `A素材库/image-trials/生图工具使用说明.md` |
| [source-006](#source-006) | 《海风与布丁》配乐定向文档 | `A素材库/music/配乐曲目简要明细、方向指导 Ver. 1.0.md` |
| [source-007](#source-007) | 《海风与布丁》场景生图提示词 · 第二批 | `A素材库/prompts_round2.md` |
| [source-008](#source-008) | 场景背景库 | `A素材库/scene-backgrounds/README.md` |
| [source-009](#source-009) | 《海风与布丁》场景背景素材库 | `A素材库/scene-backgrounds/场景素材说明与审核.md` |
| [source-010](#source-010) | 归档 | `A素材库/归档/README.md` |
| [source-011](#source-011) | 素材开发页验收 | `A素材库/归档/deliveries/art-editor/README.md` |
| [source-012](#source-012) | 参考重制装配验证 | `A素材库/归档/deliveries/art-upgrade-validation/README.md` |
| [source-013](#source-013) | Atri 音乐装配 | `A素材库/归档/deliveries/atri-music/README.md` |
| [source-014](#source-014) | boliyer 的 GalAgent 覆盖包 | `A素材库/归档/deliveries/boliyer-galagent/README.md` |
| [source-015](#source-015) | 本地角色演出精修与坐姿返工核对 | `A素材库/归档/deliveries/character-direction/README.md` |
| [source-016](#source-016) | Larry 最新完整游戏交付 | `A素材库/归档/deliveries/larry-vn/README.md` |
| [source-017](#source-017) | 《海风与布丁》配乐定向文档 | `A素材库/归档/deliveries/local-assembly/Atri方案_配乐定向参考.md` |
| [source-018](#source-018) | Atri 音乐协作与临时接入方向 | `A素材库/归档/deliveries/local-assembly/Atri音乐协作.md` |
| [source-019](#source-019) | Larry 音效来源核对 | `A素材库/归档/deliveries/local-assembly/sound-source-audit/音效来源核对.md` |
| [source-020](#source-020) | 新背景本地装配 | `A素材库/归档/deliveries/local-assembly/场景装配/装配说明.md` |
| [source-021](#source-021) | 缺失音效表 · 本地音频探索 | `A素材库/归档/deliveries/local-assembly/缺失音效表.md` |
| [source-022](#source-022) | 海风与布丁：本地兼容融合 | `A素材库/归档/deliveries/local-assembly/融合说明与待确认清单.md` |
| [source-023](#source-023) | 图片与切换连续性：全量复核 | `A素材库/归档/deliveries/local-assembly/视觉全量复核/图片全量复核与补图清单.md` |
| [source-024](#source-024) | 角色与场景融合检查点 | `A素材库/归档/deliveries/scene-character-integration/README.md` |
| [source-025](#source-025) | 角色与背景合成抽样审核 | `A素材库/归档/deliveries/scene-character-integration/中间状态审核_非最终柜台.md` |
| [source-026](#source-026) | tanpowasd/dev 合并审核 | `A素材库/归档/deliveries/tanpowasd-dev-review/README.md` |
| [source-027](#source-027) | 透明鲸鱼 UI 与平滑渐变：交付与接入 | `A素材库/归档/deliveries/whale-ui/README.md` |
| [source-028](#source-028) | 《海风与布丁》更新说明：透明鲸鱼 UI 与平滑渐变 | `A素材库/归档/deliveries/whale-ui/更新说明-透明鲸鱼UI与渐变.md` |
| [source-029](#source-029) | 2026-10-18 晚 全面审查（剧本 / 美术 / 音频与界面） | `docs/collab/work-ledger/2026-10-18-full-audit.md` |
| [source-030](#source-030) | agent接手与CG暂停记录 | `docs/collab/work-ledger/agent-handoff-cg-pause.md` |
| [source-031](#source-031) | 图片验收修改（2026-10-18 晚，用户验收通过） | `docs/collab/work-ledger/art-acceptance-20261018.md` |
| [source-032](#source-032) | 美术一致性与采用清单 | `docs/collab/work-ledger/art-consistency.md` |
| [source-033](#source-033) | 全量美术素材库与人工微调 | `docs/collab/work-ledger/art-editor-library.md` |
| [source-034](#source-034) | 剧本美术编排：鉴赏解锁、C14 合并、立绘重排（2026-10-19） | `docs/collab/work-ledger/art-layout-20261019.md` |
| [source-035](#source-035) | 美术自查（2026-10-19，@d4c9976） | `docs/collab/work-ledger/art-selfaudit-20261019.md` |
| [source-036](#source-036) | Atri 试玩反馈（2026-10-18 晚）与配音清单 | `docs/collab/work-ledger/atri-feedback-vo-20261018.md` |
| [source-037](#source-037) | Atri 家居曲接入（2026-10-18 晚） | `docs/collab/work-ledger/atri-home-cue-20261018.md` |
| [source-038](#source-038) | Atri 新音乐接入 | `docs/collab/work-ledger/atri-music-assembly.md` |
| [source-039](#source-039) | 10-19 Atri 界面同步到文件夹版 + 安卓试玩包 | `docs/collab/work-ledger/atri-ui-sync-android-20261019.md` |
| [source-040](#source-040) | 音乐与音效接入 | `docs/collab/work-ledger/audio-integration.md` |
| [source-041](#source-041) | boliyer 覆盖包与最新游玩整合 | `docs/collab/work-ledger/boliyer-galagent-integration.md` |
| [source-042](#source-042) | C02 糍粑 CG 天空改午后（2026-10-18） | `docs/collab/work-ledger/c02-afternoon-sky-20261018.md` |
| [source-043](#source-043) | 工作区上传回执（2026-10-19 第一话关键剧情 CG 动画集 & Live2D v6 傲娇精修） | `docs/collab/work-ledger/chapter1-cg-animations-20261019.md` |
| [source-044](#source-044) | 角色演出精修 | `docs/collab/work-ledger/character-direction.md` |
| [source-045](#source-045) | 角色动作与演出退步修正 | `docs/collab/work-ledger/character-performance.md` |
| [source-046](#source-046) | 补齐包内容入分支 | `docs/collab/work-ledger/completion-package-publication.md` |
| [source-047](#source-047) | 仅当前使用图片的图库 | `docs/collab/work-ledger/current-art-gallery.md` |
| [source-048](#source-048) | 深海新主曲与两首钢琴改编接入 | `docs/collab/work-ledger/deepsea-emerald-piano-20261021.md` |
| [source-049](#source-049) | E4《日落空守》接收与场景接入 | `docs/collab/work-ledger/e4-sunset-wait.md` |
| [source-050](#source-050) | 最早《翡翠之梦》定位调整 | `docs/collab/work-ledger/emerald-meeting-cue.md` |
| [source-051](#source-051) | 交接快照与 Live2D 资料 | `docs/collab/work-ledger/handoff-assets.md` |
| [source-052](#source-052) | 背景/CG 高清化 + 深海下潜过渡 + 配乐分配 + P04（2026-10-19） | `docs/collab/work-ledger/hd-art-music-20261019.md` |
| [source-053](#source-053) | 参考图驱动的全量美术重制与补齐 | `docs/collab/work-ledger/image25-art-upgrade.md` |
| [source-054](#source-054) | Image2.5 第二轮修图（2026-10-17） | `docs/collab/work-ledger/image25-pass2.md` |
| [source-055](#source-055) | L37 尾巴纹理对齐 L01（2026-10-18） | `docs/collab/work-ledger/l37-tail-l01-20261018.md` |
| [source-056](#source-056) | 灵枢记忆库、多模型插件、GalAgent 完整工具链与 MCP 扩展整合（含 Steam 双模客户端） | `docs/collab/work-ledger/lingshu-multi-llm-galagent-mcp-20261021.md` |
| [source-057](#source-057) | Hark 生图与配音工作流转为本地保留 | `docs/collab/work-ledger/local-production-workflows-20261020.md` |
| [source-058](#source-058) | 音乐负责人本地场景与音频成果提交 | `docs/collab/work-ledger/local-scene-audio-assembly.md` |
| [source-059](#source-059) | M1浅滩日常选曲与接入 | `docs/collab/work-ledger/m1-shallows-day.md` |
| [source-060](#source-060) | 开场剧情画面与动作音效修正 | `docs/collab/work-ledger/opening-art-sound-corrections.md` |
| [source-061](#source-061) | 开场 #9–21「摸尾巴被拍」演出重做（2026-10-19） | `docs/collab/work-ledger/opening-performance-20261019.md` |
| [source-062](#source-062) | 玩家视角全面打磨 | `docs/collab/work-ledger/player-experience-polish.md` |
| [source-063](#source-063) | 试玩账本反馈修复（2026-10-18） | `docs/collab/work-ledger/playtest-ledger-20261018.md` |
| [source-064](#source-064) | 角色与场景贴合打磨 | `docs/collab/work-ledger/scene-character-integration.md` |
| [source-065](#source-065) | 《海风与布丁》剧情矛盾修正 · fix9 | `docs/collab/work-ledger/script-fix-20261018.md` |
| [source-066](#source-066) | 《海风与布丁》本轮修改记录 | `docs/collab/work-ledger/settings-rollback-ui.md` |
| [source-067](#source-067) | 缺失音效接入（2026-10-18） | `docs/collab/work-ledger/sfx-20261018.md` |
| [source-068](#source-068) | 鲸尾结构与情绪受伤误画修正 | `docs/collab/work-ledger/tail-skin-corrections.md` |
| [source-069](#source-069) | 鲸尾统一（C05 标准）— 2026-10-17 | `docs/collab/work-ledger/tail-unify-c05.md` |
| [source-070](#source-070) | 2026-10-18 傍晚 尾巴与换图 | `docs/collab/work-ledger/tails-20261018-evening.md` |
| [source-071](#source-071) | 《海风与布丁》界面修复报告（fix9 重做版，2026-10-18） | `docs/collab/work-ledger/ui-fix-20261018.md` |
| [source-072](#source-072) | VN Studio 作品交付与接口 | `docs/collab/work-ledger/vn-export.md` |
| [source-073](#source-073) | 2026-10-19 鲸鱼小姐第一～七话新音色接入 | `docs/collab/work-ledger/vo-ch1-7-new-voice-20261019.md` |
| [source-074](#source-074) | 角色配音（Qwen-Audio-3.1-TTS-Next） | `docs/collab/work-ledger/voice-over.md` |
| [source-075](#source-075) | WAV 的 MP3 播放副本 | `docs/collab/work-ledger/wav-mp3-playback.md` |
| [source-076](#source-076) | 透明鲸鱼 UI 与平滑渐变接入 | `docs/collab/work-ledger/whale-ui-fades.md` |
| [source-077](#source-077) | 第一话：音乐负责人新文案接入稿 | `docs/content/opening-revision-20261015.md` |
| [cg-loops-delivery](#cg-loops-delivery) | CG 循环动画交付记录 | `docs/collab/work-ledger/cg-loop-animations-20261023.md` |
| [cg-loop-prompts](#cg-loop-prompts) | CG 循环动画完整提示词 | `A素材库/cg-animations/loops/CG_循环动画提示词总表.md` |

<a id="source-001"></a>

## 《海风与布丁》素材库

原文档：`A素材库/README.md`；整理前 SHA-256：`c127ecd732d9b71e4cfeabc3cff57173fbc8d0061607bc438690c7dac0394f00`。

集中保存项目素材。原有背景库已补齐为17张，另有 [44张新场景背景库](<sources.md#source-008>)，当前游戏接入范围见 装配记录（历史位置 `docs/sources.md#source-058`）。保留配乐主曲、15个环境音、18个剧情音效和队友新增的尾巴音效原件；采用与备用以台账为准。

环境音包括潮声、海鸥、水下声、集市、风铃、海风、点火、篝火和店内底噪，见 [音效索引](<sources.md#source-004>)。

#### 背景索引

| ID / 文件 | 场景 | 用途 |
|---|---|---|
| [bg_shallows_day_v01.png](<../A素材库/backgrounds/bg_shallows_day_v01.png>) | 浅滩与礁石 · 白天 | 初遇、浅滩日常、礁石谈话 |
| [bg_house_study_day_v01.png](<../A素材库/backgrounds/bg_house_study_day_v01.png>) | 大房子的书房 · 白天 | 写稿、日记、电话、重要谈话 |
| [bg_emerald_dream_interior_day_v01.png](<../A素材库/backgrounds/bg_emerald_dream_interior_day_v01.png>) | 翡翠之梦店内 · 白天 | 经营日常、甜品验收、柜台谈话 |
| [bg_shallows_sunset_v01.png](<../A素材库/backgrounds/bg_shallows_sunset_v01.png>) | 浅滩与礁石 · 黄昏 | 黄昏散步、礁石谈话、手链代管 |
| [bg_shallows_night_v01.png](<../A素材库/backgrounds/bg_shallows_night_v01.png>) | 浅滩与礁石 · 月夜 | 海浪与诗句、夜间等待、读稿、季终回收 |
| [bg_house_study_night_v01.png](<../A素材库/backgrounds/bg_house_study_night_v01.png>) | 大房子的书房 · 夜 | 深夜写稿、日记、等待、最终页 |
| [bg_beach_campsite_night_v01.png](<../A素材库/backgrounds/bg_beach_campsite_night_v01.png>) | 浅滩帐篷外 · 夜 | 夜间谈心、坦白、讲故事 |
| [bg_town_market_day_v01.png](<../A素材库/backgrounds/bg_town_market_day_v01.png>) | 小镇集市 · 上午 | 逛街、采购、饰品摊、海鲜验收 |
| [bg_house_courtyard_morning_v01.png](<../A素材库/backgrounds/bg_house_courtyard_morning_v01.png>) | 大房子与院子 · 清晨 | 搬家、住宅外景、晨间出门 |
| [bg_emerald_dream_upstairs_night_v01.png](<../A素材库/backgrounds/bg_emerald_dream_upstairs_night_v01.png>) | 翡翠之梦二楼窗边 · 夜 | 打烊后、晚饭、放松谈心 |
| [bg_deepsea_coral_glow_v01.png](<../A素材库/backgrounds/bg_deepsea_coral_glow_v01.png>) | 深海发光珊瑚礁 | 深海之光、定情、记忆碎片 |

尺寸、文件大小、SHA-256、原始文件名与来源说明见 [manifest.json](<../A素材库/manifest.json>)。清单中的 `path` 相对于本目录。第二批的生成提示词见 [prompts_round2.md](<sources.md#source-007>)。

#### 浅滩与礁石 · 白天  ![浅滩与礁石 · 白天](<../A素材库/backgrounds/bg_shallows_day_v01.png>)
#### 大房子的书房 · 白天  ![大房子的书房 · 白天](<../A素材库/backgrounds/bg_house_study_day_v01.png>)
#### 翡翠之梦店内 · 白天  ![翡翠之梦店内 · 白天](<../A素材库/backgrounds/bg_emerald_dream_interior_day_v01.png>)
#### 浅滩与礁石 · 黄昏  ![浅滩与礁石 · 黄昏](<../A素材库/backgrounds/bg_shallows_sunset_v01.png>)
#### 浅滩与礁石 · 月夜  ![浅滩与礁石 · 月夜](<../A素材库/backgrounds/bg_shallows_night_v01.png>)
#### 大房子的书房 · 夜  ![大房子的书房 · 夜](<../A素材库/backgrounds/bg_house_study_night_v01.png>)
#### 浅滩帐篷外 · 夜  ![浅滩帐篷外 · 夜](<../A素材库/backgrounds/bg_beach_campsite_night_v01.png>)
#### 小镇集市 · 上午  ![小镇集市 · 上午](<../A素材库/backgrounds/bg_town_market_day_v01.png>)
#### 大房子与院子 · 清晨  ![大房子与院子 · 清晨](<../A素材库/backgrounds/bg_house_courtyard_morning_v01.png>)
#### 翡翠之梦二楼窗边 · 夜  ![翡翠之梦二楼窗边 · 夜](<../A素材库/backgrounds/bg_emerald_dream_upstairs_night_v01.png>)
#### 深海发光珊瑚礁  ![深海发光珊瑚礁](<../A素材库/backgrounds/bg_deepsea_coral_glow_v01.png>) ## 后续收录约定

- 背景放 `backgrounds/`；立绘、CG、配乐、音效分别使用 `sprites/`、`cg/`、`audio/bgm/`、`audio/sfx/`，有素材时再建立目录。
- 文件名使用英文小写与下划线。背景格式为 `bg_<场景>_<时段>_v<两位版本号>.<扩展名>`；时段可用 `day`、`sunset`、`night`。
- 新版本保留旧版本；同场景时段差分沿用场景名称与构图。
- 每次加入素材同步更新清单，记录实际尺寸、来源与授权信息；不把来源不明的授权状态写成已获许可。
- 本目录为素材归档，尚未接入播放器或编译器。

#### 权利说明

本目录图片由用户提供，并明确要求在本仓库归档。生成工具、模型及开放授权条款未提供；不默认适用引擎代码许可证。

剧情音效包含拍水、落水、书写、风铃、电话、深潜、滴水及喜剧重音，见 [剧情音效索引](<sources.md#source-004>)。

当前配乐探索素材：[翡翠之梦](<sources.md#source-002>)。配乐、环境音与剧情音效在此单独归档；接入以 LarryE135 提供的最新 DEMO 为基础，具体映射待核对。

<a id="source-002"></a>

## 配乐探索素材

原文档：`A素材库/audio/bgm/README.md`；整理前 SHA-256：`551b1d25eba700004443fcb226299f10912350b7184398fe6174e5a1716ebc09`。

2026-10-21：新增音乐负责人提供的 [深海之光主曲](<../A素材库/audio/bgm/bgm_e2_deepsea_main.mp3>)（约 3:35）、[深海之光钢琴改编](<../A素材库/audio/bgm/bgm_e2_deepsea_piano.mp3>)（约 2:12）、[翡翠之梦钢琴改编](<../A素材库/audio/bgm/bgm_emerald_dream_piano.mp3>)（约 2:14），已接入工作分支作品。主曲由 `21.wav` 转为高质量 MP3，两份钢琴 MP3 按原字节保存，源文件仍在用户原目录。Atri 旧 E2 暂时退出剧情，M2 保留。见 接入记录（历史位置 `../docs/collab/work-ledger/deepsea-emerald-piano-20261021.md`）；本页下方旧状态以此为准。

- [翡翠之梦 · 见面曲](<../A素材库/audio/bgm/bgm_emerald_dream_main_v01.mp3>)：音乐负责人 @Liyang1145 于2026-10-17将最早这份`翡翠1.1.mp3`定义为见面曲，主曲另定。约2分13秒；原MP3、稳定ID及现有播放位置暂保留，不剪辑、转码或统一响度，新主曲与变奏基准待定。
- [日落空守 · E4（暂定名）](<../A素材库/audio/bgm/bgm_e4_sunset_wait.mp3>)：音乐负责人2026-10-16提供并指定的E4，约2分25秒。用于争吵后退潮、等待和重新回应前；原MP3完整保留，不裁剪或重编码。
- [浅滩日常 · M1（曲名待定）](<../A素材库/audio/bgm/bgm_m1_shallows_day.mp3>)：音乐负责人2026-10-16指定的M1，约1分40秒，原文件名`录音机-20261011-1642(1).mp3`。浅滩下水准备和沙洲捡贝壳已接入，角色主题与事件曲继续保留。

文件名采用稳定素材标识，曲名和当前选曲仍可调整。来源与校验值见 [素材清单](<../A素材库/manifest.json>)，制作理解见 音乐方向（历史位置 `../docs/content/music-direction.md`）。当前Atri的E1/E2/E7、最早《翡翠之梦》（见面曲）、E4及M1已接入游戏；E4起止见 接入记录（历史位置 `../docs/collab/work-ledger/e4-sunset-wait.md`），M1起止见 接入记录（历史位置 `../docs/collab/work-ledger/m1-shallows-day.md`）。循环点与听感继续人工微调。

<a id="source-003"></a>

## WAV 的 MP3 压缩副本

原文档：`A素材库/audio/mp3/README.md`；整理前 SHA-256：`011d362e48ac2a69dcda4b4c958a2c8c27e5e8d2b0be91d261b8294d6a96b541`。

完整保留素材库32份WAV的内容和声道，使用LAME VBR质量2编码；原WAV继续保存，供后续人工微调。路径沿用原音频在 `audio/` 下的目录结构。

完整索引、原件SHA、输出SHA、体积、声道、采样率和时长见 [manifest.json](<../A素材库/audio/mp3/manifest.json>)。总素材清单中原素材ID的 `playback_variants` 指向这里。

当前游戏及单文件HTML原本使用MP3/OGG，未引用WAV。本目录为后续装配提供压缩副本，不自动替换已用的裁剪、循环或试听选择。

<a id="source-004"></a>

## 环境音与剧情音效

原文档：`A素材库/audio/sfx/README.md`；整理前 SHA-256：`68e3bd1effaa6e2d9c22f82dcb657911f317775e06f2b978d7537e15999c1872`。

2026-10-12 收录用户提供、另一位队友制作的《环境音.zip》。保留原始音频字节，仅统一归档文件名；原编号 A01–A15 保留。

| 编号 | 素材 | 时长（秒） | 格式 / 声道 / 采样率 |
|---|---|---:|---|
| A01 | [潮声·常规（30秒，循环）](<../A素材库/audio/sfx/amb_a01_waves_normal_v01.mp3>) | 30.000 | MP3 / 2 / 44100 Hz |
| A02 | [潮声·轻（30秒，循环）](<../A素材库/audio/sfx/amb_a02_waves_soft_v01.mp3>) | 30.000 | MP3 / 2 / 44100 Hz |
| A03 | [潮声·远（退潮）（30秒，循环）](<../A素材库/audio/sfx/amb_a03_waves_distant_ebb_v01.mp3>) | 30.000 | MP3 / 2 / 44100 Hz |
| A04 | [潮声·单独铺底（30秒，循环）](<../A素材库/audio/sfx/amb_a04_waves_bed_v01.mp3>) | 30.000 | MP3 / 2 / 44100 Hz |
| A05 | [潮声·暴烈（30秒，循环）](<../A素材库/audio/sfx/amb_a05_waves_violent_v01.mp3>) | 30.000 | MP3 / 2 / 44100 Hz |
| A06 | [海鸥](<../A素材库/audio/sfx/amb_a06_seagulls_v01.mp3>) | 33.562 | MP3 / 2 / 44100 Hz |
| A07 | [水下·低频嗡鸣](<../A素材库/audio/sfx/amb_a07_underwater_low_hum_v01.wav>) | 120.000 | WAV / 2 / 44100 Hz |
| A08 | [水下·心跳声](<../A素材库/audio/sfx/amb_a08_underwater_heartbeat_v01.wav>) | 14.626 | WAV / 2 / 44100 Hz |
| A09 | [水花](<../A素材库/audio/sfx/amb_a09_water_splash_v01.wav>) | 5.205 | WAV / 2 / 48000 Hz |
| A10 | [集市人声](<../A素材库/audio/sfx/amb_a10_market_crowd_v01.mp3>) | 894.119 | MP3 / 2 / 44100 Hz |
| A11 | [贝壳风铃](<../A素材库/audio/sfx/amb_a11_shell_wind_chimes_v01.wav>) | 29.201 | WAV / 2 / 96000 Hz |
| A12 | [帐篷海风](<../A素材库/audio/sfx/amb_a12_tent_sea_wind_v01.wav>) | 34.273 | WAV / 1 / 48000 Hz |
| A13 | [打火机点燃灯芯](<../A素材库/audio/sfx/amb_a13_lighter_ignites_wick_v01.wav>) | 55.356 | WAV / 1 / 44100 Hz |
| A14 | [篝火](<../A素材库/audio/sfx/amb_a14_campfire_v01.wav>) | 236.203 | WAV / 2 / 48000 Hz |
| A15 | [店内底噪](<../A素材库/audio/sfx/amb_a15_shop_room_tone_v01.wav>) | 137.439 | WAV / 2 / 44100 Hz |

文件大小、SHA-256、原文件名和来源见 [总清单](<../A素材库/manifest.json>)。A01–A05 的原文件名标注“30秒，循环”；表中为文件实际时长，尚未检查无缝循环点。未剪辑、转码或统一响度。

原文件保留归档，场景接入待 LarryE 的最新 DEMO 到位后核对。此前探索发现 A04“潮声·单独铺底”包含节拍与乐音，使用前需试听，避免与角色曲叠加。

#### 剧情音效

2026-10-12 收录《剧情音效.zip》中仓库缺少的 18 个文件。保留原始 WAV、FLAC 和 MP3 音频字节，未剪辑、转码或统一响度。

| 原编号 | 音效 | 时长（秒） | 格式 / 声道 / 采样率 |
|---|---|---:|---|
| S01 | [巨大拍水](<../A素材库/audio/sfx/sfx_s01_large_water_slap_v01.wav>) | 2.172 | WAV / 2 / 48000 Hz |
| S02 | [呛水](<../A素材库/audio/sfx/sfx_s02_choking_water_v01.wav>) | 20.211 | WAV / 2 / 44100 Hz |
| S02 | [落水](<../A素材库/audio/sfx/sfx_s02_fall_into_water_v01.wav>) | 2.833 | WAV / 2 / 44100 Hz |
| S03 | [水花溅脸](<../A素材库/audio/sfx/sfx_s03_splash_on_face_v01.wav>) | 26.989 | WAV / 1 / 48000 Hz |
| S04 | [尾巴拍平水面](<../A素材库/audio/sfx/sfx_s04_tail_flattens_water_v01.flac>) | 13.780 | FLAC / 2 / 48000 Hz |
| S05 | [海鸥叼食](<../A素材库/audio/sfx/sfx_s05_seagull_takes_food_v01.wav>) | 16.844 | WAV / 2 / 44100 Hz |
| S06 | [笔尖书写](<../A素材库/audio/sfx/sfx_s06_pen_writing_v01.wav>) | 17.266 | WAV / 2 / 44100 Hz |
| S07 | [合上笔记本](<../A素材库/audio/sfx/sfx_s07_notebook_close_v01.wav>) | 2.744 | WAV / 1 / 48000 Hz |
| S08 | [风铃单响](<../A素材库/audio/sfx/sfx_s08_wind_chime_single_v01.wav>) | 4.040 | WAV / 2 / 96000 Hz |
| S09 | [手机来电](<../A素材库/audio/sfx/sfx_s09_phone_ringing_v01.wav>) | 1.714 | WAV / 2 / 48000 Hz |
| S10 | [接挂电话](<../A素材库/audio/sfx/sfx_s10_phone_answer_hangup_v01.wav>) | 6.773 | WAV / 1 / 96000 Hz |
| S11 | [尾巴急甩](<../A素材库/audio/sfx/sfx_s11_tail_quick_swish_v01.wav>) | 2.786 | WAV / 2 / 44100 Hz |
| S12 | [深潜水压](<../A素材库/audio/sfx/sfx_s12_deep_dive_pressure_v01.wav>) | 6.719 | WAV / 2 / 44100 Hz |
| S13 | [发梢滴水](<../A素材库/audio/sfx/sfx_s13_hair_drips_v01.mp3>) | 11.899 | MP3 / 2 / 44100 Hz |
| S14 | [窸窸窣窣](<../A素材库/audio/sfx/sfx_s14_rustling_v01.wav>) | 2.915 | WAV / 2 / 44100 Hz |
| S15 | [小鱼干撕开](<../A素材库/audio/sfx/sfx_s15_dried_fish_tear_v01.wav>) | 2.567 | WAV / 2 / 48000 Hz |
| S16 | [被雷劈的定格重音](<../A素材库/audio/sfx/sfx_s16_comic_freeze_sting_v01.mp3>) | 1.254 | MP3 / 2 / 44100 Hz |
| S17 | [手机扣在礁石上](<../A素材库/audio/sfx/sfx_s17_phone_set_on_reef_v01.mp3>) | 3.994 | MP3 / 2 / 44100 Hz |

原包将“呛水”和“落水”均编号为 S02；归档保留原编号，通过 `choking_water` 和 `fall_into_water` 区分。文件大小、SHA-256、原文件名和来源均已加入 [总清单](<../A素材库/manifest.json>)。

原文件保留归档，场景接入与缺失需求待 LarryE 的最新 DEMO 到位后核对。

<a id="source-005"></a>

## 本地 shell 生图工具

原文档：`A素材库/image-trials/生图工具使用说明.md`；整理前 SHA-256：`fda9b04d588530b4253586ca2086c7ff0668bf21062af0c7c43f5c9378be8223`。

已安装 `ningzimu/codex-gpt-image`，固定来源提交 `e22fb471aa2ff4f2c013c1468e916132eaaa66a8`。

来源：https://github.com/ningzimu/codex-gpt-image

历史技能位于原制作环境的本机技能目录；该机器路径不作为当前仓库配置。

历史命令入口为原制作环境 PATH 中的 `codex-image.cmd`；这不表示当前机器已安装同一工具。

调用方式：

```powershell
codex-image generate --prompt-file "<提示词文件>" --model gpt-image-2.5-flare --out "<输出目录>/result.png"
```

指定参考图时，可追加 `--image "本机原件/reference.png"`。精确编辑可请求 `--model gpt-image-2.5-sunburst`；本轮仅验证了 Flare 请求的文本生图，没有验证参考图编辑或 Sunburst。

使用本机现有 Codex ChatGPT OAuth，只发送到 ChatGPT 的 Codex Images 端点，不读取 OpenAI API key。实际额度归属和剩余量没有独立查询，本轮只确认订阅登录态与请求成功，不把它说成已核对网页端生图额度。

本地安装补丁：限定带凭证的图片请求只能发往两个第一方 Codex Images 端点；拒绝重定向；生成图片旁保存 `.generation.json`，包含请求模型、后端报告模型、尺寸、质量、用量与耗时，不含凭证。原始上游 checkout 保留在工作区 `work/tool-review/codex-gpt-image`，没有改上游仓库。

#### 本轮实测

- 输出：`R01_whale_character_candidate.png`。
- 请求模型：`gpt-image-2.5-flare`。
- 后端报告模型：未提供；模型选择未核实。
- 实际图片：1024×1536，RGB PNG，有奶白背景，非透明立绘。
- 耗时：47.04 秒。
- 后端质量：medium。
- 后端用量：439 输入 token、1372 输出图像 token、总计 1811 token。
- 结果用途：角色母图参考候选；未替换当前游戏，未推送仓库。

“请求了 2.5”与“后端确认采用 2.5”分开记录。不能用 HTTP 成功、图片好看或 CLI 名称来证明实际模型。后续若回执明确提供其他模型，按实际回执汇报；无回执则继续保持未核实状态。

#### 图像审核

蓝黑长发、天青眼、耳鳍、深蓝常服、双腿与独立鲸尾已经可辨，整体可作角色讨论参考。仍有以下问题：尾根被裙子遮住，无法准确验收后腰连接；尾鳍画了月亮星点，却缺少设定要求的白底圆形徽记；交叉腿、拎裙角的姿势与完全放松的默认站姿不同。背景为实色，正式立绘需另交付透明版本并验收边缘与实际舞台比例。

这些问题先记录，不通过重复试生成来冒充模型路由验证。

<a id="source-006"></a>

## 《海风与布丁》配乐定向文档

原文档：`A素材库/music/配乐曲目简要明细、方向指导 Ver. 1.0.md`；整理前 SHA-256：`95a7523a066bd488c949cb35f9356106bfe5a5131c19f6da080f4dade2d12d17`。

> 版本：v1.1
> 用途：第一季配乐定向参考
> 分类逻辑：以情绪为根本——剧情情绪一般优先于场景时间情绪，场景时间情绪一般优先于场景氛围

---

#### 一、分类逻辑

本作配乐采用**以情绪为根本的三层选择逻辑**。三层是情绪来源的主次关系，不是三条音轨叠加，也不是只按时间、地点标签机械换曲：

**第一层：情感/情绪事件曲（剧情情绪层）**
先判断当前剧情是否有明确的表达重点，如滑稽、定情、伤痛、和解、思考。全季保留 E1–E7 共 7 类。剧情情绪一般优先于时间情绪和场景氛围；并非每句台词的情绪变化都需要换曲。

**第二层：时间曲（场景时间情绪层）**
没有突出剧情情绪时，优先依据背景已有的时段设计，表现清晨的清新、白天的舒展、黄昏的收束、夜间的安静。普通场景共用时段音乐：帐篷晚上与海滩晚上可以共用夜间曲，早上同理，不再为每个地点分别制作早晚版本。只在背景本身有时段设计时考虑，不因台词提到时间就额外扩充。

**第三层：地图/场景曲（场景氛围层）**
在前两层情绪要求下，再考虑空间特色。重点是集市、餐厅/饭店等具有明确活动氛围的场景；普通海滩、帐篷、房间不因地点改变自动换曲。一首曲可以兼顾时间情绪与场景氛围，不需要先播放时间曲再切场景曲。深海保留原有的空间参考，但不是新增一套早晚曲。

**一般优先关系**：剧情情绪 ＞ 场景时间情绪 ＞ 场景氛围。不是绝对排他规则：白天采购可选兼具白天气质与烟火气的集市曲；集市发生真正的伤心争执时，仍以剧情情绪为先。夜间礁石和解用 E5，不因夜景改用普通夜间曲。

**编号与增补原则**：原有 M1、M2、M3、M6、M7 及 E1–E7 编号、参考曲目及其序号保留，不补占空缺编号。新增 T1–T4 表示时段用途，不代表四首全新音乐：清晨与白天暂复用 M1；仅黄昏、夜间各新增一个曲目需求，共增加 2 首待选曲。新曲参考暂待试听确认，不虚填曲名或链接。

**保留的两个特殊设定**：
- **M6 = E3 = M7**：大房子、温柔日常、翡翠之梦三者保留共用同一首曲。“家”的声音出现在其他地图时，等于把家带过去。但这是曲目共用关系，不是地点触发规则；普通早餐、夜间停留或打烊，不自动触发 E3。
- **E1 是滑稽曲，不是甜度曲**：傲娇和吃醋的配乐功能是喜剧性的；真正的伤心、冲突不能因表面上是吃醋就误用喜剧曲。

---

#### 二、速查总表

##### 第一层 · 情感/情绪事件曲（7 类，原编号保留）

| ID  | 情绪类别        | 性质        | 参考曲目                                        |
| --- | ----------- | --------- | ------------------------------------------- |
| E1  | 傲娇互动/吃醋     | 滑稽曲       | ポンコツステップ（松本文紀）/ 脱力するオチ（安瀬聖）/ 网易云 1487344235 |
| E2  | 定情/深海之光     | 安静、辽阔、会呼吸 | アルカテイル -recall-（折戸伸治）/ White with You（水月陵）  |
| E3  | 温柔日常/打烊后/余韵 | 与 M6 同曲   | 同 M6                                        |
| E4  | 伤口/退潮/心死    | 空、冷、失去方向  | 影は色濃くて（どんまる）                                |
| E5  | 和解/回暖/条款    | 回暖，带鼻音和郑重 | Sea, You & Me（麻枝准）                          |
| E6  | 元层/管理员/世界让路 | 安静、辽阔、宿命感 | WilL（鶴田もこ）                                  |
| E7  | 独白/思考       | 思考性、悬疑性   | 塔の上の思索者（秋山裕和/むにょっ）/ ★サティジムノペディ（秋山裕和/むにょっ）   |

##### 第二层 · 时间曲（4 类用途，仅新增 2 首待选曲）

| ID  | 时段    | 情绪基调             | 曲目安排         |
| --- | ----- | ---------------- | ------------ |
| T1  | 清晨/上午 | 清新、轻盈、一天开始       | 暂复用 M1，不单独新增 |
| T2  | 正午/午后 | 阳光、舒展、日常         | 复用 M1，不单独新增  |
| T3  | 黄昏    | 放缓、收束、留恋，不预设悲伤   | 新增 1 首，参考待确认 |
| T4  | 夜间    | 安静、松弛、留白，不预设亲密高潮 | 新增 1 首，参考待确认 |

**对应原则**：浅滩、礁石、沙洲、帐篷、书房等普通背景，按各自已有的时段版本选用 T 类，不分别增加地点专曲。厨房_清晨、客厅_午后、餐厅_夜等固定时段背景也只按已有设计处理，不补造不存在的早晚版本。餐厅/饭店若需要明确的用餐或营业氛围，再参考下层场景曲。

##### 第三层 · 地图/场景曲（原 5 个编号保留）

| ID  | 原场景归属           | 氛围基调与现用途                             | 参考曲目                                 |
| --- | --------------- | ------------------------------------ | ------------------------------------ |
| M1  | 浅滩（含沙洲、礁石/水线边缘） | 阳光、日常、相遇；兼作 T1/T2 的通用时段曲             | 网易云 412951823 / 412951829            |
| M2  | 深海/深水区          | 辽阔、蓝色、悬浮；保留水下空间参考，不另拆早晚              | 海中都市（松本文紀）/ 時編み（水月陵）                 |
| M3  | 集市/小镇（含银匠铺、饰品巷） | 热闹、烟火、偶遇；主要用于采购与街市活动，不是所有小镇画面的默认曲    | 日射しの暇（どんまる）                          |
| M6  | 大房子（= E3 = M7）  | 居家、温暖、安静；明确表达“家”的安心时使用，不覆盖所有居家时段     | 网易云 1487339790 / White with You（水月陵） |
| M7  | 翡翠之梦（店铺）        | “家”的主题与 M6 共用；餐厅/饭店营业氛围可用原补充参考，不新增编号 | 同 M6；补充参考 CoffeE（Sasa Ikeki）         |

---

#### 三、逐曲分析

沿用原有曲目分节与参考序号，新增 T 类置于本节末尾；表格展示优先关系，不以分节先后决定播放顺序。

##### M1 · 浅滩

**功能定义**：保留原浅滩（含沙洲、礁石/水线边缘）的阳光日常方向，并兼作 T1/T2 的通用清晨、白天曲。承担相遇与日常，需要耐听、不抢戏。不再因进入浅滩就默认播放，也不再要求白天/黄昏共用：普通黄昏转 T3，普通夜间转 T4；有明确剧情情绪时，优先选 E 类。帐篷、书房等普通场景的清晨/白天也可复用，不另做地点版本。

**气质方向**：阳光、日常、相遇。不是欢闹，是“海浪推来推去”的轻盈感。钢琴或吉他为主，弦乐铺底，中速，带一点摇摆。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 待确认 | 待确认 | https://music.163.com/song?id=412951823 |
| 2 | 待确认 | 待确认 | https://music.163.com/song?id=412951829 |

---

##### M2 · 深海/深水区

**功能定义**：保留深海/深水区的空间氛围曲。在没有明确剧情情绪、背景也没有可用的时段区分时选用，不因地点自动覆盖剧情。定情（E2）和伤口（E4）都在此触发，场景曲必须保持中性——不能太暖，也不能太冷。需要一种“深蓝色的中性的安静”。水下现有背景没有早晚版本，不额外增加深海时段曲。

**气质方向**：辽阔、蓝色、悬浮。低频铺底，钢琴单音或竖琴泛音，慢速，有空间感。不是恐怖，不是悲伤，是“泡在蓝色里”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 海中都市 | 松本文紀 | https://music.163.com/song?id=1487339789 |
| 2 | 時編み（编钟） | 水月陵 | https://music.163.com/song?id=1311345872 |

---

##### M3 · 集市/小镇

**功能定义**：采购、社死、老奶奶、珍珠戒指等段落中的街市氛围参考，覆盖集市及相关银匠铺、饰品巷。需要“人声嘈杂背景下的音乐”，但音乐本身不能太吵。普通采购可用本曲兼顾白天与烟火气；滑稽、伤痛或其他明确剧情情绪出现时，优先相应 E 类。单纯的小镇清晨画面不因同属“小镇”就套用集市曲，可按 T1 处理。

**气质方向**：热闹、烟火、偶遇。手风琴或木管，中快板，有生活感，但不是庆典。像“有人在远处摆摊，你在其中穿行”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 日射しの暇（烈日下的余暇） | どんまる | https://music.163.com/song?id=1311346838 |

---

##### M6 = E3 = M7 · 大房子/温柔日常/翡翠之梦

**功能定义**：保留搬家后居家、开店后相处中的“家”的主题。日记、按摩、早安、共读、季终读稿、风铃等段落，当表达重点是“两个人都在场”的安心、温柔或余韵时，以 E3 使用。这一曲是全季“家”的声音，出现在其他地图时等于把“家”带过去。与 E3 同曲，M7 共用，但不再包办所有居家和店铺场景：普通清晨、午后、黄昏、夜间分别按 T 类；打烊不自动等于 E3，明确的温柔相处才使用。本曲也不取代 E7 的思考性读稿。

**场景补充**：集市之外，餐厅/饭店是需要特别判断活动氛围的场景。翡翠之梦营业、上菜、用餐等段落，可先从原有补充参考 CoffeE 的生活感方向中选择，以兼顾时段与场景，不要求与“家”的主题是同一首；它仍保留在原 M7 补充位置，不新增编号。家中餐厅的普通晚饭不因背景叫“餐厅”就必须使用营业曲，仍先判断剧情情绪与夜间情绪。

**气质方向**：居家、温暖、安静。钢琴为主，可能加一点吉他或八音盒。慢速，不煽情，是“两个人都在场”的安心。不是浪漫曲，是生活曲。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 待确认 | 待确认 | https://music.163.com/song?id=1487339790 |
| 2 | White with You（白羽和你的故事） | 水月陵 | https://music.163.com/song?id=1311347839 |
| 补充 | CoffeE（M7 店铺场景补充参考） | Sasa Ikeki | https://music.163.com/song?id=451521653 |

---

##### E1 · 傲娇互动/吃醋

**功能定义**：嘴硬、拍水、开条件、占有欲中的喜剧性段落。优先于对应时段曲及 M1/M3/M6/M7 等场景参考。玩家听到就知道“她又要演了”。性质是滑稽曲，不是甜度曲；剧情转为真正的伤心或冲突时，不继续按吃醋表象使用 E1。

**气质方向**：偏向喜剧性、滑稽感。拨弦、木管短句、三角铁，节奏跳跃，带一点“假装生气”的俏皮。不卡通化，不闹剧化。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | ポンコツステップ（废柴Step） | 松本文紀 | https://music.163.com/song?id=1487339798 |
| 2 | 脱力するオチ | 安瀬聖 | https://music.163.com/song?id=412951832 |
| 3 | 待确认 | 待确认 | https://music.163.com/song?id=1487344235 |

---

##### E2 · 定情/深海之光

**功能定义**：深潜、发光珊瑚、身份确认。明确进入定情情绪时，优先于出发前的时段曲/M1 和深海中的 M2，不要求从出发起全程覆盖。全季最安静的高潮。不煽情，要“泡在蓝色里”。

**气质方向**：安静、辽阔、会呼吸。钢琴单音、竖琴泛音、低频pad、玻璃琴。慢速，悬浮，不是悲伤，是“看到了一片星空沉在海底”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | アルカテイル -recall-（阿尔卡泰尔 -recall-） | 折戸伸治 | https://music.163.com/song?id=1311319923 |
| 2 | White with You（白羽和你的故事） | 水月陵 | https://music.163.com/song?id=1311347839 |

---

##### E4 · 伤口/退潮/心死

**功能定义**：电话、深水区离去、沉默失效。全季情绪最低点。她的伤心是安静的，不是戏剧化的。

**气质方向**：空、冷、失去方向。极简钢琴，长混响，潮声渐远，可能只有单音重复。不要大提琴哭腔，不要戏剧化。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 影は色濃くて（影子颜色变深了） | どんまる | https://music.163.com/song?id=1311347840 |

---

##### E5 · 和解/回暖/条款

**功能定义**：礁石和解、男仆任命、称呼恢复。不是轻快，是“哭过之后”的温柔。甜度必须 ≥ E4 疼度 × 1.5。

**气质方向**：回暖，带鼻音和郑重。钢琴+大提琴（温暖不悲伤），中慢速，有“终于说出口了”的释然。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | Sea, You & Me（海，你与我） | 麻枝准 | https://music.163.com/song?id=1311345853 |

---

##### E6 · 元层/管理员/世界让路

**功能定义**：沙洲出现、房子长出来、灵枢归档。不神秘化，不科幻化，是“世界轻轻让了一步”。

**气质方向**：安静、辽阔、宿命感。弦乐长音、钢琴高音区、可能加一点风铃或钟琴。不是史诗，是“轻轻掀开一角”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | WilL | 鶴田もこ | https://music.163.com/song?id=451520675 |

---

##### E7 · 独白/思考

**功能定义**：第一话开头（醒来、笔记本）、第三话碎片触发、第十话深水区沉没、第四夜书房、第十六话真结局读稿中带有思考、验证、悬疑性质的段落。只有这类独白才归入，不因出现笔记本或读稿就自动触发。普通安静独白按背景时段处理；明确表达温柔与“家”的安心时才归 E3。

**剧情定位校正**：游戏实际内容中的“第四夜书房”位于第十话；原文记为第十四话，此处更正定位，不改变 E7 编号及参考曲目。

**气质方向**：思考性、悬疑性、验证性。极简，可能只有钢琴单音或环境音+单音。不是悲伤，是“他在想一件事”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 塔の上の思索者（塔上的沉思者） | 秋山裕和 / むにょっ | https://music.163.com/song?id=33737151 |
| 2 | ★サティジムノペディ（萨蒂·裸体舞曲） | 秋山裕和 / むにょっ | https://music.163.com/song?id=33737121 |

**备注**：相当多 galgame 采用萨蒂的裸体舞曲（Gymnopédie）作为独白/思考段的配乐。萨蒂的极简、悬置、不解决和声的特质，天然适配“他在想一件事”的独白场景。

---

##### T1 / T2 · 清晨/白天（复用 M1，不新增曲目）

**功能定义**：没有突出剧情情绪时，为已有清晨、上午、正午、午后背景提供通用日常音乐。海滩、沙洲、礁石、帐篷或家中不因地点不同各配一首；背景没有相应时段版本的，不另外补造。T1 与 T2 保留用途区分，当前共用 M1，不要求每次从上午转午后都换曲。

**气质方向**：清晨偏清新、轻盈、一天刚开始；白天偏阳光、舒展、自然的生活节奏。沿用 M1 的钢琴/吉他与轻盈感，不要求另作变奏。若后续试听发现 M1 无法兼顾清晨，再讨论是否扩充，本版不新增。

**参考曲目**：复用 M1 原序号 1、2 及其链接，不另编参考序号。

---

##### T3 · 黄昏（新增曲目需求 1）

**功能定义**：没有突出剧情情绪时，用于已有黄昏背景的普通相处、归来、告别与一天收尾。浅滩、礁石、沙洲、帐篷外景、书房、海面等可共用，不分别制作地点版。黄昏不自动等于失落；伤痛、和解或明确温柔余韵仍优先相应 E 类。

**气质方向**：温和、放缓、收束，带一点留恋但不悲伤。钢琴或木吉他为主，旋律简洁，节奏比白天舒缓；可有少量温暖长音，不做催泪或告白高潮。让玩家感到“今天还没有结束，但已经慢下来了”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 待选（新增黄昏曲） | 待确认 | 待确认 |

---

##### T4 · 夜间（新增曲目需求 2）

**功能定义**：没有突出剧情情绪时，用于已有夜间背景的普通停留、夜谈、记录与休息。帐篷外/内、浅滩、礁石、书房、卧室、店铺二楼等可共用夜间音乐，不按地点各增一首。普通晚饭也可使用；确需餐厅/饭店活动氛围时再参考 M7 补充。夜间不自动触发 E3，独白不自动触发 E7，和解不因发生在夜间而改用 T4。

**气质方向**：安静、松弛、留白。稀疏钢琴、轻柔吉他或低存在感的铺底，中慢速，让海风、潮声、风铃和对白有空间。不是 E4 的空冷，不是 E7 的悬疑，也不是 E2 的定情高潮；保留普通夜晚可以轻松相处的余地。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 待选（新增夜间曲） | 待确认 | 待确认 |

---

文档完。

<a id="source-007"></a>

## 《海风与布丁》场景生图提示词 · 第二批

原文档：`A素材库/prompts_round2.md`；整理前 SHA-256：`23fe4e4f02c2204a58f4c15d6b2770ec6c8d8bcf118d6857607d66e1e0aa9e3e`。

依据：2026-10-11 查看 galLingS/main。最新提交 e75c49274d22a8a5d09f827ceee7663881af54ec 新增第一季 v5.0 全卷草稿；背景库已有浅滩、书房、甜品店三张白天背景。本批补充 3 张时段差分和 5 张新场景。

剧本来源：https://github.com/TanPowasd/galLingS/blob/main/content/scripts/haifeng-pudding_s1_v5.0_draft.md

#### 使用方法

每次生成时，将下面的统一风格句放在对应提示词前面。时段差分附上对应的现有白天图；新场景附上现有图作为画风参考。具体陈设中未由剧本明确指定的部分属于本批美术补充。

**统一风格句：** 日式恋爱视觉小说手绘背景，细腻插画质感，与参考图保持一致的笔触、材质和空间比例；16:9 横向画面，平视构图，无人物。中央留出人物立绘空间，下方避免抢眼细节，无文字、无水印、无游戏界面。

#### 1. 浅滩 · 黄昏

建议文件名：`bg_shallows_sunset_v01.png`

参考图：`bg_shallows_day_v01.png`

以参考图制作同一浅滩的黄昏差分，完整保留左侧礁石、前景沙滩、远处小镇与山脉的位置，以及海平线高度和镜头角度。夕阳把天边染成柔和的杏金色与淡粉色，浅水映出温暖天光，远海仍保留青蓝色。礁石受光面微暖，阴影呈淡紫灰，海面有细长闪光。盛夏傍晚，温柔、松弛，适合两个人散步后停下来谈话。保持清透的色彩层次。

#### 2. 浅滩 · 月夜

建议文件名：`bg_shallows_night_v01.png`

参考图：`bg_shallows_day_v01.png`

以参考图制作同一浅滩的晴朗月夜差分，保留全部地形、远处建筑和镜头构图。天空呈深靛蓝，少量细小星点，一轮月亮在海面铺出细碎银光。左侧可坐人的礁石有柔和月光轮廓，前景浅水仍然透明可辨，沙地泛着淡淡冷光。远处小镇只有零星暖色窗灯。安静、亲密、带一点想念，画面暗部保留细节和可阅读的层次。

#### 3. 大房子书房 · 夜

建议文件名：`bg_house_study_night_v01.png`

参考图：`bg_house_study_day_v01.png`

以参考图制作同一书房的夜晚差分，保留左侧海景窗与风铃、后墙木门、右侧书桌书架、中央地毯及零食箱的原有位置。窗外是深蓝夜海和微弱月光，白窗帘轻轻扬起。右侧台灯亮着，暖光落在摊开的笔记本、手稿和木桌上，房间其他区域逐渐过渡到柔和暗部。暖灯与冷色窗光自然交融，带有深夜写作、等待与陪伴的生活感。

#### 4. 浅滩帐篷外 · 夜

建议文件名：`bg_beach_campsite_night_v01.png`

参考：浅滩白天图的海岸环境和画风。

盛夏海边浅滩上的小型营地，平视望向沙地与海面。画面左侧是一顶朴素的小帐篷，入口半开，里面透出极淡的暖光；左前方有一小堆低矮篝火，周围摆放两处简单坐垫，旁边有笔记本和几张稿纸。中央和右侧是开阔沙地，再远处是安静的夜海。低矮火光温暖、月色清凉，氛围朴素而亲近，适合长时间谈心。帐篷与火堆保持在画面侧面。

#### 5. 小镇集市 · 上午

建议文件名：`bg_town_market_day_v01.png`

参考：现有背景图的浅木、奶白与海蓝配色及画风。

盛夏海边小镇的露天集市，一条适合步行的窄街延伸向远方。两侧是朴素木摊和白墙店铺，米白与蓝白遮阳棚投下清爽阴影。左侧果摊摆着李子与夏季水果，右侧可见海鲜摊和竹篮，稍远处是贝壳饰品小摊与挂着发带的货架。街道尽头露出一线蓝海，明亮上午阳光落在石板路上。货品丰富、有生活气息，中央通道畅通，适合采购和逛街场景。空场背景，无摊主和顾客。

#### 6. 大房子与院子 · 清晨

建议文件名：`bg_house_courtyard_morning_v01.png`

参考：书房图的木材、白墙、海景与插画质感。

海边小镇边缘、海崖下的一栋两层住宅，白色墙面、蓝色屋顶、朴素木门窗，与参考书房属于同一栋房子。前方是小院子，左侧一棵枝叶舒展的树，粗壮树枝下挂着简单木板秋千；右侧可见厨房烟囱，升起一缕轻淡炊烟。中央留出从院门通向房门的小路，院外一角可见海面。清晨光线柔和，树影细碎，房子显得温暖、可以长住，有搬进新家的期待感。

#### 7. 翡翠之梦二楼窗边 · 夜

建议文件名：`bg_emerald_dream_upstairs_night_v01.png`

参考图：`bg_emerald_dream_interior_day_v01.png`，用于保持同一店铺的材质与配色。

海边甜品店打烊后的二楼生活空间，沿用一楼的浅木家具、奶白墙面和少量翡翠绿装饰。后方是一扇朝海的大窗，窗边摆着小木桌和两把椅子，桌面留有两只饭后空碗与陶瓷杯。窗边只有一盏暖灯亮着，房间其余区域安静地隐入暗处；侧后方能看见通向楼下的楼梯口，楼下灯光已经熄灭。窗外是深蓝夜海，气氛放松、亲密，有忙完一天终于坐下来的生活感。前景留出立绘位置。

#### 8. 深海发光珊瑚礁

建议文件名：`bg_deepsea_coral_glow_v01.png`

参考：已有图的细腻手绘质感，保持世界美术一致。

从水下悬浮视角看一片蓝色发光珊瑚礁。前景下方与画面两侧是层次丰富的珊瑚，微小蓝光与青色光点沿着枝梢分布，像散落在深海里的星星。中央与上方留出宽阔、通透的深蓝水域，可以容纳两个人的立绘；远处珊瑚逐渐融入深色，少量悬浮微粒反射柔光。主要光源来自珊瑚，亮度柔和，近处细节清楚，远处空间幽深。梦幻、安静、温柔，带一点遥远记忆的感觉。无海面、无人物、无巨大海兽、无建筑。

<a id="source-008"></a>

## 场景背景库

原文档：`A素材库/scene-backgrounds/README.md`；整理前 SHA-256：`f57b002e9ae5c370bba2c56b813475675bdf09364eb6dc0bdc5ebd005923124f`。

44张空场景：42张主背景、2张补充时段。27张新生成、17张用户网页图复用。角色与人物CG另行处理。

下载仓库后打开 [场景素材浏览.html](<../A素材库/scene-backgrounds/场景素材浏览.html>) 查看缩略图、原图和对话框遮挡；[审核说明](<sources.md#source-009>)、[清单](<../A素材库/scene-backgrounds/场景素材清单.csv>)、[来源台账](<../A素材库/scene-backgrounds/场景素材台账.json>) 和 `prompts/` 可供制作核对。

`originals/` 保存PNG原件；游戏在 `content/imports/vnstudio/海风与布丁/assets/bg/scenes/` 使用1280×720 WebP。40张已分配给剧情，B18、B32、O01、O02暂为备用。接入映射见 [背景接入映射.json](<../A素材库/scene-backgrounds/背景接入映射.json>)，具体验证见 装配记录（历史位置 `../docs/collab/work-ledger/local-scene-audio-assembly.md`）。

生成请求指定gpt-image-2.5-flare，后端未返回实际模型ID。保留回执但不声称模型路由已验证。探索稿，不是发行版本。

<a id="source-009"></a>

## 《海风与布丁》场景背景素材库

原文档：`A素材库/scene-backgrounds/场景素材说明与审核.md`；整理前 SHA-256：`b054cc44393796c251f27f8c33d8e6bed1ef1a9aaa5890f177982a0d4ed5ce09`。

42项主场景背景，另补营地外清晨、店外初秋，共44项。角色、人物CG与封面暂不制作。所有原件与游戏保持分离，仅整理本地素材库。

新增图片使用Codex ChatGPT OAuth，请求gpt-image-2.5-flare；后端没有报告实际模型ID。已有网页图保留原始来源，不补写已验证模型。

| 编号 | 场景 | 来源 | 尺寸 | 审核备注 |
|---|---|---|---|---|
| [B01](<../A素材库/scene-backgrounds/originals/B01.png>) | 浅滩清晨 | 新生成 | 1672×941 | 与日景同机位，朝光变化较轻；可作晨间草稿，后续强时间演出再调冷朝光。 |
| [B02](<../A素材库/scene-backgrounds/originals/B02.png>) | 浅滩日景 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B03](<../A素材库/scene-backgrounds/originals/B03.png>) | 浅滩黄昏 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B04](<../A素材库/scene-backgrounds/originals/B04.png>) | 浅滩月夜 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B05](<../A素材库/scene-backgrounds/originals/B05.png>) | 礁石谈话日景 | 新生成 | 1672×941 | 同一海岸近机位，可坐礁石与空舞台；日暮夜空间匹配。 |
| [B06](<../A素材库/scene-backgrounds/originals/B06.png>) | 礁石谈话黄昏 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B07](<../A素材库/scene-backgrounds/originals/B07.png>) | 礁石救援/和解夜景 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B08](<../A素材库/scene-backgrounds/originals/B08.png>) | 月牙沙洲上午 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B09](<../A素材库/scene-backgrounds/originals/B09.png>) | 沙洲午后阴凉 | 新生成 | 1672×941 | 下午仍为日景，阴凉集中在岩石近处。 |
| [B10](<../A素材库/scene-backgrounds/originals/B10.png>) | 沙洲黄昏 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B11](<../A素材库/scene-backgrounds/originals/B11.png>) | 下潜浅层水下 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B12](<../A素材库/scene-backgrounds/originals/B12.png>) | 深水区黑暗水下 | 新生成 | 1672×940 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B13](<../A素材库/scene-backgrounds/originals/B13.png>) | 深海发光珊瑚 | 用户网页图复用 | 1672×941 | 已有发光珊瑚；与危险暗水分开，中心留角色空间。 |
| [B14](<../A素材库/scene-backgrounds/originals/B14.png>) | 上浮海面黄昏 | 新生成 | 1672×941 | 复核后重做水面机位；前景为海水，远岸在左侧，旧岸上取景保留在records供追溯。 |
| [B15](<../A素材库/scene-backgrounds/originals/B15.png>) | 营地外黄昏 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B16](<../A素材库/scene-backgrounds/originals/B16.png>) | 营地外夜 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B17](<../A素材库/scene-backgrounds/originals/B17.png>) | 帐篷内夜灯亮 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B18](<../A素材库/scene-backgrounds/originals/B18.png>) | 帐篷内夜灯暗 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B19](<../A素材库/scene-backgrounds/originals/B19.png>) | 帐篷内清晨 | 用户网页图复用 | 1672×941 | 采用用户本轮网页图为帐篷内部母图；与角色图无关。 |
| [B20](<../A素材库/scene-backgrounds/originals/B20.png>) | 小镇边缘清晨 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B21](<../A素材库/scene-backgrounds/originals/B21.png>) | 集市街道夏日 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B22](<../A素材库/scene-backgrounds/originals/B22.png>) | 集市街道初秋 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B23](<../A素材库/scene-backgrounds/originals/B23.png>) | 饰品巷 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B24](<../A素材库/scene-backgrounds/originals/B24.png>) | 珍珠摊 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B25](<../A素材库/scene-backgrounds/originals/B25.png>) | 银匠工坊 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B26](<../A素材库/scene-backgrounds/originals/B26.png>) | 住宅院子清晨 | 用户网页图复用 | 1672×941 | 住宅外观参考母图；人物揭示CG以后按同一院树秋千制作。 |
| [B27](<../A素材库/scene-backgrounds/originals/B27.png>) | 住宅客厅午后 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B28](<../A素材库/scene-backgrounds/originals/B28.png>) | 住宅书房午后 | 用户网页图复用 | 1672×941 | 住宅书房母图，昼暮夜参考同一空间。 |
| [B29](<../A素材库/scene-backgrounds/originals/B29.png>) | 住宅书房黄昏 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B30](<../A素材库/scene-backgrounds/originals/B30.png>) | 住宅书房夜 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B31](<../A素材库/scene-backgrounds/originals/B31.png>) | 住宅厨房清晨 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B32](<../A素材库/scene-backgrounds/originals/B32.png>) | 住宅厨房夜 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B33](<../A素材库/scene-backgrounds/originals/B33.png>) | 住宅早餐桌日景 | 新生成 | 1672×941 | 同一住宅餐厅改晨间，并补两本可辨的空白日记；精确文字留后期。 |
| [B34](<../A素材库/scene-backgrounds/originals/B34.png>) | 住宅餐厅夜 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B35](<../A素材库/scene-backgrounds/originals/B35.png>) | 住宅卧室夜 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B36](<../A素材库/scene-backgrounds/originals/B36.png>) | 卧室门口清晨 | 新生成 | 1672×941 | 卧室与木门、过道关系可辨；采用独立门口机位，替代原客厅裁切。 |
| [B37](<../A素材库/scene-backgrounds/originals/B37.png>) | 翡翠之梦店外营业 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B38](<../A素材库/scene-backgrounds/originals/B38.png>) | 翡翠之梦店内日景 | 用户网页图复用 | 1672×941 | 甜品店内景母图；同构图灯光差分和店外建立镜头。 |
| [B39](<../A素材库/scene-backgrounds/originals/B39.png>) | 翡翠之梦店内打烊夜 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [B40](<../A素材库/scene-backgrounds/originals/B40.png>) | 翡翠之梦店内午后未开灯 | 新生成 | 1672×941 | 同一店铺下午自然光、主吊灯关闭；保持全景，区别打烊夜。 |
| [B41](<../A素材库/scene-backgrounds/originals/B41.png>) | 翡翠之梦后厨日景 | 用户网页图复用 | 1672×941 | 店铺不锈钢商业后厨，与住宅木制家厨分开。 |
| [B42](<../A素材库/scene-backgrounds/originals/B42.png>) | 翡翠之梦二楼夜 | 用户网页图复用 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [O01](<../A素材库/scene-backgrounds/originals/O01.png>) | 营地外清晨 | 新生成 | 1672×941 | 已检查时段、空舞台、主要物件与参考场景；保留为可用于后续组装的背景。 |
| [O02](<../A素材库/scene-backgrounds/originals/O02.png>) | 翡翠之梦店外初秋 | 新生成 | 1672×941 | 补充店外秋季图，秋色与装饰比主篇初秋较浓；当前无必须使用节点，后续采用时按日期减装饰。 |

<a id="source-010"></a>

## 归档

原文档：`A素材库/归档/README.md`；整理前 SHA-256：`55e46c4a734dfee487e1b13c9415e25ed2e68819c39154426ec4d40e7da62275`。

存放**已废弃或已被替换**的美术版本，仅用于追溯。

#### 什么会进这里

| 命名特征 | 含义 |
|---|---|
| `*_superseded_before_*` | 被新版替换掉的旧图，后缀说明被哪一版替换 |
| `*_rejected_*` | 送审后被否决的候选，后缀说明否决原因（`_tail_too_long`、`_alpha_fringing` 等） |
| `*_before_review` | 送审前的版本 |
| 其他未命名后缀 | 未被任何剧情引用的备选图 |

#### 三条规则

1. **这里的文件不参与任何构建**。游戏运行只读 `content/imports/`，编辑器素材目录、打包脚本也不应该读这里。往这里放东西，等于宣告它「退出生产」。
2. 与 `A素材库/art-upgrade/originals/` 的分工：**originals 只放当前有效的母图**（145 组，对应游戏里 145 张运行图）；历史版本一律进这里。
3. 每个图旁边的 `*.generation.json` / `*.production.json` 必须跟着一起归档 —— 它们记录当时的提示词、模型、参数，是"这张图为什么长这样、为什么被否"的唯一依据。不要因为图废弃就丢掉参数。

#### 当前规模

2026-10-22 建立：225 个废弃 ID、526 个文件（225 张图 + 301 个参数记录），约 440 MB。

迁移依据：`A素材库/art-upgrade/originals/` 里 370 个图片 ID 与游戏实际加载的 145 张运行图做差集，未命中的 225 个 ID 全部归入此处。

<a id="source-011"></a>

## 素材开发页验收

原文档：`A素材库/归档/deliveries/art-editor/README.md`；整理前 SHA-256：`9cc294a51e168c101ad06b28071e3ab8e8976997aac4d4df38371604ce75fe8c`。

2026-10-14，Windows/Edge，当前作品3308节点、18章；复用Larry原生VN Studio编辑器，编辑器和玩家使用同一游戏文件。测试过程中插入的B19原PNG、人物位置/高度/翻转与来源备注仅在验收草稿中，不修改生产剧情。

- [完整开发页](<../A素材库/归档/deliveries/art-editor/正式开发页.png>)：全量素材调用后的舞台、时间轴与当前人物。
- [素材库界面](<../A素材库/归档/deliveries/art-editor/素材库.png>)：采用图、原PNG和试制候选可同时比较；来源与请求路线单独登记。
- [浏览器验证](<../A素材库/归档/deliveries/art-editor/验证结果.json>)：10项检查，209原文件可取、176原图解码、保存/恢复/导入、微调与来源备注、单文件离线导出、玩家存档隔离、先备份再载入最新版。
- [当前游戏单文件验证](<../A素材库/归档/deliveries/art-editor/单文件验证结果.json>)：197内嵌资产、94图像/103音频解码，存读档恢复，零外部请求、零脚本错误。冷启动耗时仅为这台测试机一次测量，不是性能保证。

自动测试76通过、2跳过。只读素材API与保存项目打包有边界测试；真实云端聊天、音乐听感、画风统一和OS文件夹授权写入仍待人工验收。

使用与交接见 开发说明（历史位置 `A素材库/docs/design/art-editor.md`），兼容范围见 任务记录（历史位置 `A素材库/docs/collab/work-ledger/art-editor-library.md`）。

<a id="source-012"></a>

## 参考重制装配验证

原文档：`A素材库/归档/deliveries/art-upgrade-validation/README.md`；整理前 SHA-256：`00625916581fb9075df6e4f0cb4adc608407c0147e81bac6f73d9b4091feb676`。

2026-10-15，本机Edge自动化，无付费云端模型调用。browser-validation.json记录素材读取、真实音乐播放、托管存读档和时间轴；final-details.json记录新选项好感、三段真实音效组成五次拍水及切句取消另见台账。PNG为最终封面、开发页和游玩取样，不作为生产美术。完整图源与审核在content/assets/art-upgrade，原文泳装三项明确留待人工。

<a id="source-013"></a>

## Atri 音乐装配

原文档：`A素材库/归档/deliveries/atri-music/README.md`；整理前 SHA-256：`8c862b03973cefa3744ead972d957a9c5e6a3a7736a0ff5c69814c242cf13bd0`。

来源：@Atri-Lobato，`content/assets/music/mp3/` 五首MP3及配乐定向文档，整理提交 `f45ec5172adde3d05a409af6506fb763ca8d7b55`。作者的WAV母带与MP3原件留在其原目录；运行副本字节与原MP3一致。

| 文件 | 当前处理 |
|---|---|
| E1.mp3 | 第二话酸梅汤、第四话手链摊：喜剧性傲娇互动 |
| E2.mp3 | 第三话下潜、珊瑚、定情与上岸余韵 |
| E7.mp3 | 开场、第三话记忆/验证段、第六话身份回溯 |
| E6或E5.mp3 | 候选试听；用途尚未确定，不同时套在伤口和世界事件里 |
| M6？.mp3 | SHA与现用《翡翠之梦》完全一致，复用原素材ID，记录M6/E3/M7共用关系 |

段落采用固定台词ID和区间，[接入清单](<../A素材库/归档/deliveries/atri-music/接入清单.json>) 记录逐节点差分、SHA和播放增益。原故事停奏段保留，缺E4伤痛曲不拿E1替代，普通静谧独白不机械套用E7。

现有游戏仍需补齐M1、M2、M3、E4，确认E5/E6分工，并人工微调循环点。已集成和解码不等同于最终听感验收。

验证见 [结果](<../A素材库/归档/deliveries/atri-music/验证结果.json>)。单文件离线游戏已重新打包并去重，77.1MB，197资产、18章、3308节点。本次随用户明确要求提交的素材开发页共同交付，人物重制仍待继续；没有冻结音乐或发布新版本。

<a id="source-014"></a>

## boliyer 的 GalAgent 覆盖包

原文档：`A素材库/归档/deliveries/boliyer-galagent/README.md`；整理前 SHA-256：`c5a36bdaa6c15c51e5d911f9885d118c1456403f5bdb3644b26b4fc84d32c890`。

由音乐负责人提供并授权代提交。原包保存为 `galagent-overlay.zip`，原说明与逐文件校验见 `覆盖说明.txt`、`manifest.json`；ZIP内的命令与配置建议是作者说明，不等于用户授权执行工具操作。

本次以main的场景音频融合为运行基线，接入GalAgent、后端端口及VN Studio插件接口。使用作者原始引擎为共同祖先合并index.html，保留已有音频、画面及性能修正；没有用覆盖包的旧README与试听缺失的外层页面直接覆盖当前仓库。

最终运行入口为根目录 `游玩.html`（离线），或 `start.bat` 启动的 `/vn.html`（托管、在线聊天需配置模型）。作品唯一目录为 `content/imports/vnstudio/海风与布丁/`。最新范围与验证见 统筹记录（历史位置 `A素材库/docs/collab/work-ledger/boliyer-galagent-integration.md`）。

<a id="source-015"></a>

## 本地角色演出精修与坐姿返工核对

原文档：`A素材库/归档/deliveries/character-direction/README.md`；整理前 SHA-256：`b5a893a1498d88ed9ce58acfac789b152b6e1f47eec7b7424cff3d303676e032`。

执行基线`c9f0be4`。`before-game.js`与`before-index.html`为该提交原始字节，后续文案、节点ID、分支与103音频保持不变。完整过程、接口、人工缺口和验证边界见本轮台账（历史位置 `A素材库/docs/collab/work-ledger/character-direction.md`）。

- `退选_交腿坐姿.jpg`：用户指出大腿结构异常、P16裙摆破口的旧候选。**已退选，不是当前采用图。**对应PNG与回传在美术原件目录的`*_rejected_anatomy`文件中保留。
- `坐姿修正_全身与裙摆.jpg`：当前并膝母图派生的P13/P15/P16/P17，全身与裙摆局部对照。第二张旧裙摆破口已去掉；P16的戒指缺失仍明确标注，局部补画被接口拒绝，未绕过重试。
- `坐姿返工_手裙膝局部审核.jpg`：放大手、裙摆、两膝与小腿连接复核；P16尚未完成戒指，不作为首饰定稿。
- `写诗结构母图_复核.jpg`：S02完成跪坐骨架及低位单根尾部修正后的全身核对；P05为其逐字节副本，C08用同母图重新构图。
- `browser-validation.json`：18片段、三条首话路径、两种窗口选项避脸、延迟解码连点、一次性CG镜头、减少动态、编辑调用与单文件图像的实测结果。
- `integration-validation.json`：节点、音频、采用图审核与SHA核对。
- `detail-limitations.json`：P16戒指人工项与拒绝请求的证据编号。

新图通过现有订阅图像桥请求Image2.5/max；返回立绘1024×1536、横图1672×941及medium，后端未回传模型ID，不声称路线已核实或获得原生最高档。全新原件与制作回传均保留。完整本地单文件约157MB，未推送或发布版本。

<a id="source-016"></a>

## Larry 最新完整游戏交付

原文档：`A素材库/归档/deliveries/larry-vn/README.md`；整理前 SHA-256：`8dbd7d4ea4069b5103e720877a42ed6da9e56d9868b0b58431948614cdfa5dec`。

音乐负责人于2026-10-13提供 `海风与布丁_全16话+番外+音效_游戏.zip`，明确要求代 Larry 提交。检查时新、旧仓库均无开放PR，Larry分支没有更新的完整包，所以采用这份交付。

原ZIP保存在[交接附件（当时为私有附件；仓库 2026-10-16 起公开）](https://github.com/Liyang1145/galLingS/releases/download/workspace-20261012/larry-complete-game.zip)。附件复用原有交接发布容器；该ZIP是本次Larry交付，不表示它属于此前Live2D/RenPy快照。没有创建新版本号。

可运行目录为 content/imports/vnstudio/海风与布丁（历史位置 `A素材库/content/imports/vnstudio/海风与布丁`），入口 `index.html`。双击可独立运行，也可通过 galLingS 的 `/vn.html` 加载。原包中的单文件HTML仍保留在原ZIP里，避免在Git重复保存嵌入的整套素材。

含16话+2篇番外、3308句、57张背景/CG、26张立绘、52份音效。游戏目录137个文件原样保存，逐文件大小和SHA-256见 [manifest.json](<../A素材库/归档/deliveries/larry-vn/manifest.json>)。没有覆写作者的图、音效、剧情或接口，也没有自动把之前代理的本地整合套进去。

这份导出原生提供 `VNHost` 和 `vamb` 环境音音量；仍需正式对接《翡翠之梦》主曲，核对界面提示声、尾巴情绪音和混音。作者文件没有配乐资产，音效元数据 `dur` 为0，不表示实际音频时长为0。听感验收、同源后端/手账连接和新旧存档迁移不在“文件已交付”声明里。

#### 后续素材融合（2026-10-13）

用户后续明确要求提交全部本地成果，运行目录现已接入背景、主曲及音效，见 任务记录（历史位置 `A素材库/docs/collab/work-ledger/local-scene-audio-assembly.md`）。上文描述本次原始交付，不再代表当前运行文件逐字未改。

原ZIP与137项清单保留；原始 `game.js`、`index.html` 位于 [original-overridden-files](<../A素材库/归档/deliveries/larry-vn/original-overridden-files>)，其他135项原始文件继续保存在运行目录。按此取源复核，137项SHA全部匹配原清单。当前融合验证与原件验核分开，不命名发行版本。

<a id="source-017"></a>

## 《海风与布丁》配乐定向文档

原文档：`A素材库/归档/deliveries/local-assembly/Atri方案_配乐定向参考.md`；整理前 SHA-256：`009f21ce2cd099cce5260e893935f2856b7fc06d1112322a51f21e7c0711a405`。

> 版本：v1.0
> 用途：第一季配乐定向参考
> 分类逻辑：双维度平行分类——地图/场景固有曲（默认层）＋情感/情绪事件曲（覆盖层）
>
> 概览：本文档从剧本出发，参考现实 galgame 作品及其音乐集，从功能性角度初步提出了曲目框架，列出了具有常见功能所需要的曲目。

---

#### 一、分类逻辑

本作配乐采用**双维度分类**，两个维度平行，非父子关系：

**维度一：地图/场景固有曲（默认层）**
玩家进入某个地点时默认播放，形成空间记忆。全季共 5 张地图。

**维度二：情感/情绪事件曲（覆盖层）**
因剧情情绪触发，优先级高于地图曲，硬切覆盖。全季共 7 类。

**两个特殊设定**：
- **M6 = E3 = M7**：大房子、温柔日常、翡翠之梦三者共用同一首曲。“家”的声音出现在其他地图时，等于把家带过去。
- **E1 是滑稽曲，不是甜度曲**：傲娇和吃醋的配乐功能是喜剧性的。

---

#### 二、速查总表

##### 地图/场景固有曲（5 张）

| ID | 地图 | 固有基调 | 参考曲目 |
|---|---|---|---|
| M1 | 浅滩（含沙洲、礁石/水线边缘） | 阳光、日常、相遇 | 网易云 412951823 / 412951829 |
| M2 | 深海/深水区 | 辽阔、蓝色、悬浮 | 海中都市（松本文紀）/ 時編み（水月陵） |
| M3 | 集市/小镇（含银匠铺、饰品巷） | 热闹、烟火、偶遇 | 日射しの暇（どんまる） |
| M6 | 大房子（= E3 = M7） | 居家、温暖、安静 | 网易云 1487339790 / White with You（水月陵） |
| M7 | 翡翠之梦（店铺） | 与 M6 共用 | 同 M6；补充参考 CoffeE（Sasa Ikeki） |

##### 情感/情绪事件曲（7 类）

| ID | 情绪类别 | 性质 | 参考曲目 |
|---|---|---|---|
| E1 | 傲娇互动/吃醋 | 滑稽曲 | ポンコツステップ（松本文紀）/ 脱力するオチ（安瀬聖）/ 网易云 1487344235 |
| E2 | 定情/深海之光 | 安静、辽阔、会呼吸 | アルカテイル -recall-（折戸伸治）/ White with You（水月陵） |
| E3 | 温柔日常/打烊后/余韵 | 与 M6 同曲 | 同 M6 |
| E4 | 伤口/退潮/心死 | 空、冷、失去方向 | 影は色濃くて（どんまる） |
| E5 | 和解/回暖/条款 | 回暖，带鼻音和郑重 | Sea, You & Me（麻枝准） |
| E6 | 元层/管理员/世界让路 | 安静、辽阔、宿命感 | WilL（鶴田もこ） |
| E7 | 独白/思考 | 思考性、悬疑性 | 塔の上の思索者（秋山裕和/むにょっ）/ ★サティジムノペディ（秋山裕和/むにょっ） |

---

#### 三、逐曲分析

##### M1 · 浅滩

**功能定义**：全季最高频地图曲。玩家进入浅滩（含沙洲、礁石/水线边缘）时的默认曲。承担相遇、日常、黄昏告别。需要耐听、不抢戏，白天/黄昏共用一曲，靠环境音区分。

**气质方向**：阳光、日常、相遇。不是欢闹，是“海浪推来推去”的轻盈感。钢琴或吉他为主，弦乐铺底，中速，带一点摇摆。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 待确认 | 待确认 | https://music.163.com/song?id=412951823 |
| 2 | 待确认 | 待确认 | https://music.163.com/song?id=412951829 |

---

##### M2 · 深海/深水区

**功能定义**：进入深海时的默认曲。定情（E2）和伤口（E4）都在此触发，固有曲必须保持中性——不能太暖，也不能太冷。需要一种“深蓝色的中性的安静”。

**气质方向**：辽阔、蓝色、悬浮。低频铺底，钢琴单音或竖琴泛音，慢速，有空间感。不是恐怖，不是悲伤，是“泡在蓝色里”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 海中都市 | 松本文紀 | https://music.163.com/song?id=1487339789 |
| 2 | 時編み（编钟） | 水月陵 | https://music.163.com/song?id=1311345872 |

---

##### M3 · 集市/小镇

**功能定义**：采购、社死、老奶奶、珍珠戒指。玩家进入集市/小镇（含银匠铺、饰品巷）时的默认曲。需要“人声嘈杂背景下的音乐”，但音乐本身不能太吵。

**气质方向**：热闹、烟火、偶遇。手风琴或木管，中快板，有生活感，但不是庆典。像“有人在远处摆摊，你在其中穿行”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 日射しの暇（烈日下的余暇） | どんまる | https://music.163.com/song?id=1311346838 |

---

##### M6 = E3 = M7 · 大房子/温柔日常/翡翠之梦

**功能定义**：搬家后的所有居家场景，以及开店后的店铺场景。日记、按摩、早安、共读、季终读稿、风铃。这一曲是全季“家”的声音，出现在其他地图时等于把“家”带过去。与 E3 同曲，M7 共用。

**气质方向**：居家、温暖、安静。钢琴为主，可能加一点吉他或八音盒。慢速，不煽情，是“两个人都在场”的安心。不是浪漫曲，是生活曲。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 待确认 | 待确认 | https://music.163.com/song?id=1487339790 |
| 2 | White with You（白羽和你的故事） | 水月陵 | https://music.163.com/song?id=1311347839 |
| 补充 | CoffeE（M7 店铺场景补充参考） | Sasa Ikeki | https://music.163.com/song?id=451521653 |

---

##### E1 · 傲娇互动/吃醋

**功能定义**：嘴硬、拍水、开条件、占有欲。覆盖 M1/M3/M6/M7。玩家听到就知道“她又要演了”。性质是滑稽曲，不是甜度曲。

**气质方向**：偏向喜剧性、滑稽感。拨弦、木管短句、三角铁，节奏跳跃，带一点“假装生气”的俏皮。不卡通化，不闹剧化。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | ポンコツステップ（废柴Step） | 松本文紀 | https://music.163.com/song?id=1487339798 |
| 2 | 脱力するオチ | 安瀬聖 | https://music.163.com/song?id=412951832 |
| 3 | 待确认 | 待确认 | https://music.163.com/song?id=1487344235 |

---

##### E2 · 定情/深海之光

**功能定义**：深潜、发光珊瑚、身份确认。覆盖 M1（出发前）和 M2（深海中）。全季最安静的高潮。不煽情，要“泡在蓝色里”。

**气质方向**：安静、辽阔、会呼吸。钢琴单音、竖琴泛音、低频pad、玻璃琴。慢速，悬浮，不是悲伤，是“看到了一片星空沉在海底”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | アルカテイル -recall-（阿尔卡泰尔 -recall-） | 折戸伸治 | https://music.163.com/song?id=1311319923 |
| 2 | White with You（白羽和你的故事） | 水月陵 | https://music.163.com/song?id=1311347839 |

---

##### E4 · 伤口/退潮/心死

**功能定义**：电话、深水区离去、沉默失效。全季情绪最低点。她的伤心是安静的，不是戏剧化的。

**气质方向**：空、冷、失去方向。极简钢琴，长混响，潮声渐远，可能只有单音重复。不要大提琴哭腔，不要戏剧化。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 影は色濃くて（影子颜色变深了） | どんまる | https://music.163.com/song?id=1311347840 |

---

##### E5 · 和解/回暖/条款

**功能定义**：礁石和解、男仆任命、称呼恢复。不是轻快，是“哭过之后”的温柔。甜度必须 ≥ E4 疼度 × 1.5。

**气质方向**：回暖，带鼻音和郑重。钢琴+大提琴（温暖不悲伤），中慢速，有“终于说出口了”的释然。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | Sea, You & Me（海，你与我） | 麻枝准 | https://music.163.com/song?id=1311345853 |

---

##### E6 · 元层/管理员/世界让路

**功能定义**：沙洲出现、房子长出来、灵枢归档。不神秘化，不科幻化，是“世界轻轻让了一步”。

**气质方向**：安静、辽阔、宿命感。弦乐长音、钢琴高音区、可能加一点风铃或钟琴。不是史诗，是“轻轻掀开一角”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | WilL | 鶴田もこ | https://music.163.com/song?id=451520675 |

---

##### E7 · 独白/思考

**功能定义**：第一话开头（醒来、笔记本）、第三话碎片触发、第十话深水区沉没、第十四话第四夜书房、第十六话真结局读稿。只有带有思考、验证、悬疑性质的独白才归入。普通安静独白归 E3。

**气质方向**：思考性、悬疑性、验证性。极简，可能只有钢琴单音或环境音+单音。不是悲伤，是“他在想一件事”。

**参考曲目**：

| 序号 | 曲名 | 艺术家 | 链接 |
|---|---|---|---|
| 1 | 塔の上の思索者（塔上的沉思者） | 秋山裕和 / むにょっ | https://music.163.com/song?id=33737151 |
| 2 | ★サティジムノペディ（萨蒂·裸体舞曲） | 秋山裕和 / むにょっ | https://music.163.com/song?id=33737121 |

**备注**：相当多 galgame 采用萨蒂的裸体舞曲（Gymnopédie）作为独白/思考段的配乐。萨蒂的极简、悬置、不解决和声的特质，天然适配“他在想一件事”的独白场景。

---

文档完。

<a id="source-018"></a>

## Atri 音乐协作与临时接入方向

原文档：`A素材库/归档/deliveries/local-assembly/Atri音乐协作.md`；整理前 SHA-256：`5325ac4bba9385e3fa7e3144f80ba3b8fba9ffbcd5c5b9a1d02706029d4d7f0a`。

2026-10-13 用户明确：Atri 正在协助剩余音乐，音乐暂按他的方案组装。音乐负责人仍是 @Liyang1145；Atri 是协助制作与方向提供者。

#### 已核实的交付

仓库 `docs/production.md#content-backlog` 由 Atri-Lobato 提交，提交记录 `7aab4f0`、`cd20649`。这是方向文档，不是已经交付的音频包。参考曲名和外部链接只作参考，不下载作为本作成品配乐。

本次检查新私有仓库（当时仓库为私有；2026-10-16 起已公开）的主分支提交、全部分支列表、开放 PR、问题/PR 记录和附件，尚未看到新的 Atri 音乐文件或开放 PR。现有配乐原件仍是音乐负责人提供的《翡翠之梦》。这次没有替换实际播放文件，也没有把待交付曲目写成已经接入。

#### 当前采用的分工

| 类型 | 编号 | 用途 | 当前音频状态 |
| --- | --- | --- | --- |
| 场景默认 | M1 | 浅滩、沙洲、礁石/水线 | 待 Atri 交付 |
| 场景默认 | M2 | 深海/深水区，中性的蓝色安静 | 待 Atri 交付 |
| 场景默认 | M3 | 集市/小镇、银匠铺、饰品巷 | 待 Atri 交付 |
| 场景默认/情绪共用 | M6 = E3 = M7 | 住宅、温柔日常、店铺 | 保留现有《翡翠之梦》作当前候选；具体采用按 Atri 后续交付/说明落实 |
| 情绪覆盖 | E1 | 傲娇/吃醋的喜剧段落 | 待 Atri 交付；真实争吵不能归入此类 |
| 情绪覆盖 | E2 | 定情、发光珊瑚、深海之光 | 待 Atri 交付，与中性深海 M2 区分 |
| 情绪覆盖 | E4 | 受伤、退潮、心死 | 待 Atri 交付；保留剧本停奏与留白 |
| 情绪覆盖 | E5 | 和解、回暖、条款 | 待 Atri 交付 |
| 情绪覆盖 | E6 | 元层、管理员、世界让路 | 待 Atri 交付 |
| 情绪覆盖 | E7 | 思考/验证/悬疑性质的独白 | 待 Atri 交付；普通安静独白归 E3 |

共 12 个分类标签，住宅/日常/店铺共享后对应 10 个独立曲目槽；不等于必须马上制作 10 首或冻结曲目数。

#### 后续组装办法

1. 开工时查看 Atri 的新提交、PR 与实际文件；以他的具体场景/曲目交付说明为准。若只交音频未写对应场景，结合方案和剧本文本判断，无法判断的记为待确认。
2. 保留原件、来源和校验码，记录曲目槽、接入的新版台词 ID、开始/结束点与循环处理。
3. 情绪曲覆盖场景曲，同一时刻只选一个音乐轨；不要让地图曲与情绪曲持续叠播。情绪结束后在合适的句子恢复场景曲；明确停奏的位置保持安静。
4. 避免按一个关键词逐句换曲或看见“吃醋”就配滑稽曲；按完整段落情绪判断。剧本明确的停奏、骤停和淡出优先保留。
5. 《翡翠之梦》现有角色登场用途继续保留。这套方向文档不自动撤掉用户指定主曲；若 Atri 交付改变用途，再记录取舍。
6. 继续使用本地融合副本；本轮不改共享台账、不提交、不推送。播放解码和功能测试通过后，音色/响度/混音仍交给音乐负责人听取。

机器可读的候选槽位与状态见 `Atri音乐接入计划.json`；其中待交付条目没有虚构文件路径，也不会触发资源请求。

本记录是以后组装的检查入口，不代表后台已经设置持续监控或已经联系 Atri。

<a id="source-019"></a>

## Larry 音效来源核对

原文档：`A素材库/归档/deliveries/local-assembly/sound-source-audit/音效来源核对.md`；整理前 SHA-256：`668a76e372758acbf3fb5acba9f45dd56b36632ec36d2a942efccd34e10c7eed`。

核对用户提供的环境音、剧情音效、尾巴音效三个原 ZIP，与 Larry 最新完整游戏包的 52 份 MP3。仅核对，没有修改游戏或推送。

- 37 份：实际波形有强同源证据，是你上传的声音经过裁剪、转码等处理的播放副本。
- 4 份：有对应原素材且存在波形相似性，但未达到本次确认门槛，暂不声称完全确认。
- 11 份 UI 文件：三个原 ZIP 没有对应 UI 条目，也没有字节相同的文件；实际来源未确认，不能据此断言是程序合成。

确认的 37 份中，13 份来自环境音包（包括被分到剧情类的海鸥与心跳），15 份来自剧情音效包，9 份来自尾巴包。所有 Larry MP3 与原件的文件校验码均不同；来源判断依据解码后实际波形，不靠名字。

A04「潮声·单独铺底」与 Larry 的「环境_潮声铺底」波形相关度约 0.999，确认同源。这是之前出现节拍叠加的那份素材，本地融合版继续不在剧情中播放它。

未充分确认的四份是：剧情_尾巴急甩.mp3、剧情_尾巴拍平水面.mp3、剧情_水花溅脸.mp3、尾巴_慌乱甩圈.mp3。

#### 对照

| Larry 文件 | 原包 / 原文件 | 判断 |
| --- | --- | --- |
| UI_CG.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_好感上升.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_好感下降.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_存档.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_尾鳍标记.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_新结局.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_话末.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_超时沉默.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_退潮线倒计时.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_选项出现.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| UI_选项确认.mp3 | 三个包没有对应条目，来源待查 | 三份包中未找到可确认来源 |
| 剧情_发梢滴水.mp3 | 剧情音效.zip / S13 发梢滴水.mp3 | 波形确认同源，转码或剪辑副本 |
| 剧情_合上笔记本.mp3 | 剧情音效.zip / S07 合上笔记本.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_呛水.mp3 | 剧情音效.zip / S02 呛水.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_定格重音.mp3 | 剧情音效.zip / S16 被雷劈的定格重音.mp3 | 波形确认同源，转码或剪辑副本 |
| 剧情_尾巴急甩.mp3 | 剧情音效.zip / S11 尾巴急甩.wav | 名称对应，波形未充分确认 |
| 剧情_尾巴拍平水面.mp3 | 剧情音效.zip / S04 尾巴拍平水面.flac | 名称对应，波形未充分确认 |
| 剧情_巨大拍水.mp3 | 剧情音效.zip / S01 巨大拍水.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_心跳.mp3 | 环境音.zip / A08 水下·心跳声.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_手机扣礁石.mp3 | 剧情音效.zip / S17 手机扣在礁石上.mp3 | 波形确认同源，转码或剪辑副本 |
| 剧情_手机来电.mp3 | 剧情音效.zip / S09 手机来电.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_接挂电话.mp3 | 剧情音效.zip / S10 接挂电话.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_撕开小鱼干.mp3 | 剧情音效.zip / S15 小鱼干撕开.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_水花溅脸.mp3 | 剧情音效.zip / S03 水花溅脸.wav | 名称对应，波形未充分确认 |
| 剧情_海鸥.mp3 | 环境音.zip / A06 海鸥.mp3 | 波形确认同源，转码或剪辑副本 |
| 剧情_海鸥叼食.mp3 | 剧情音效.zip / S05 海鸥叼食.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_深潜水压.mp3 | 剧情音效.zip / S12 深潜水压.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_窸窸窣窣.mp3 | 剧情音效.zip / S14 窸窸窣窣.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_笔尖书写.mp3 | 剧情音效.zip / S06 笔尖书写.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_落水.mp3 | 剧情音效.zip / S02 落水.wav | 波形确认同源，转码或剪辑副本 |
| 剧情_风铃单响.mp3 | 剧情音效.zip / S08 风铃单响.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_卷圈.mp3 | 尾巴音效.zip / T06卷圈、轻卷.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_慌乱甩圈.mp3 | 尾巴音效.zip / T08慌乱甩圈.wav | 名称对应，波形未充分确认 |
| 尾巴_拍地.mp3 | 尾巴音效.zip / T05拍地.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_拍床.mp3 | 尾巴音效.zip / T04拍床、沙发.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_拍桌.mp3 | 尾巴音效.zip / T03拍桌、桌腿.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_拍水.mp3 | 尾巴音效.zip / T01拍水（轻档）.flac | 波形确认同源，转码或剪辑副本 |
| 尾巴_拍沙.mp3 | 尾巴音效.zip / T02拍沙.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_放平.mp3 | 尾巴音效.zip / T10放平、沉底.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_缠绕.mp3 | 尾巴音效.zip / T09缠绕.wav | 波形确认同源，转码或剪辑副本 |
| 尾巴_翘起.mp3 | 尾巴音效.zip / T07翘起、高翘.wav | 波形确认同源，转码或剪辑副本 |
| 环境_帐篷海风.mp3 | 环境音.zip / A12 帐篷海风.wav | 波形确认同源，转码或剪辑副本 |
| 环境_店内底噪.mp3 | 环境音.zip / A15 店内底噪.wav | 波形确认同源，转码或剪辑副本 |
| 环境_水下嗡鸣.mp3 | 环境音.zip / A07 水下·低频嗡鸣.wav | 波形确认同源，转码或剪辑副本 |
| 环境_潮声常规.mp3 | 环境音.zip / A01 潮声·常规（30秒，循环）.mp3 | 波形确认同源，转码或剪辑副本 |
| 环境_潮声暴烈.mp3 | 环境音.zip / A05 潮声·暴烈（30秒，循环）.mp3 | 波形确认同源，转码或剪辑副本 |
| 环境_潮声轻.mp3 | 环境音.zip / A02 潮声·轻（30秒，循环）.mp3 | 波形确认同源，转码或剪辑副本 |
| 环境_潮声远.mp3 | 环境音.zip / A03 潮声·远（退潮）（30秒，循环）.mp3 | 波形确认同源，转码或剪辑副本 |
| 环境_潮声铺底.mp3 | 环境音.zip / A04 潮声·单独铺底（30秒，循环）.mp3 | 波形确认同源，转码或剪辑副本 |
| 环境_篝火.mp3 | 环境音.zip / A14 篝火.wav | 波形确认同源，转码或剪辑副本 |
| 环境_贝壳风铃.mp3 | 环境音.zip / A11 贝壳风铃.wav | 波形确认同源，转码或剪辑副本 |
| 环境_集市人声.mp3 | 环境音.zip / A10 集市人声.MP3 | 波形确认同源，转码或剪辑副本 |

波形比较方法、偏移位置、文件 SHA 与相关度见「音效来源核对.json」。同源确认不代表所有裁剪、响度与场景触发已听感验收。

<a id="source-020"></a>

## 新背景本地装配

原文档：`A素材库/归档/deliveries/local-assembly/场景装配/装配说明.md`；整理前 SHA-256：`581cc8e32f9ff14101d7873be4b994f1153bbcb5e5a60c9e135bc431df380bc0`。

已把44张背景打包为运行副本，并替换39项原背景引用。3处临时裁切已清除，使用独立全景；新增暗水、秋季市场和日记餐桌按实际章节/台词分配。

当前剧情使用40种画面。B18帐篷调暗灯在当前剧情由原人物CG承担、B32厨房夜无独立烹饪镜头、O01营地外清晨及O02店外初秋无明确节点，这4张保留为备用，未改写剧情来强行展示。

所有3308个节点ID、正文、分支、变量、角色立绘、人物CG、音频设置、游戏ID与既有存档体系保持不变。先前7张错误CG继续退出播放。新角色参考图没有进入游戏。

背景运行副本尺寸1280×720，WebP质量90，合计10,995,286字节；原件117,856,947字节，全部保存在场景素材库。原图与作者原件保留，不覆盖。

验证：全部46项背景资产引用可加载（同图存在多个旧ID）；冷启动正午浅滩；明暗水下、夏秋集市、餐桌、门口、帐篷晨/夜和关灯店内9个关键实机镜头；存档位置/音频恢复；主曲播放；直接打开本地HTML启动。未逐句穷举所有剧情分支。无脚本异常。

试玩：http://127.0.0.1:8772/vn.html

服务关闭后双击 `outputs/gal-fused-local/启动融合试玩.cmd`。离线入口为 `content/imports/vnstudio/海风与布丁/index.html`。

改动仅本地，未推送、未命名发布版本。回退前数据在 `work/scene-assembly-before/game.js`；不要重跑旧融合构建脚本覆盖此次分配。后续接入以 `装配记录.json` 为准。

<a id="source-021"></a>

## 缺失音效表 · 本地音频探索

原文档：`A素材库/归档/deliveries/local-assembly/缺失音效表.md`；整理前 SHA-256：`bd16e70289762d4330ecce3bf86119505b6b1d8c2aa64e50bf9fa89a3a195bd2`。

2026-10-12 按音乐负责人要求，停用原 DEMO 剩余旧占位音效。原包的音效以 MP3 文件提供，未提供其制作脚本；本清单不把制作方式未知的音频断言为运行时程序生成。

已撤销 8 类、61 处旧占位触发：叮 22、跳 8、撞击 9、翻页 10、脚步 5、煎锅 4、碗勺 2、开门 1。全部 18 个旧音频从播放素材表撤出；原文件保留归档。已接入的队友音效和主曲继续使用。第二话开始写字的一处叮声改用已有 S06 笔尖书写。

没有专用素材的必要动作先留白。角色表情、尾鳍微动、视线相撞、回忆中的动作，以及仅仅出现菜名的位置，不以提示声或鼓点代替。下表列制作需要，剧情本身未新增强制音效指令。

| 优先级 | 缺失声音 | 对应场景 | 建议长度 | 制作要求 |
|---|---|---|---|---|
| 优先 | 笔记本翻开／纸页轻翻 | 第1、2、3、6、8、10、14、15话及番外2，翻开笔记本 | 0.5–2 秒 | 近距离、薄纸与软封皮；轻而干净，提供翻开和单页翻动两种；不要带叮声、旋律或夸张重音。 |
| 次优先 | 湿沙滩脚步 | 第7话，送走海星后慢慢走回沙洲 | 2–4 秒 | 2–4步缓慢脚步，湿沙轻陷、少量水声；不要硬底鞋或拍子感。 |
| 次优先 | 集市石板路脚步 | 第14话，集市争执后脚步慢下来 | 2–4 秒 | 轻步行逐渐放缓；能单独裁出停步；不要夸张鞋跟声。 |
| 次优先 | 卧室木门轻开 | 第15话，次日清晨她打开房门 | 0.5–2 秒 | 轻门把手、开门的短促木门声；不要惊悚吱呀或砰声。 |
| 次优先 | 小勺轻放／碗勺轻碰 | 第8话，饭后她放下勺子 | 0.3–1 秒 | 一次轻放，金属勺与碗沿或桌面接触，短尾音；避免连续餐具碰撞。 |
| 后补 | 真实煎锅滋啦 | 第13话，店内厨房制作香煎鱼排 | 5–10 秒，可循环 | 小火煎鱼的油脂滋啦，稳定、贴近厨房；不要鼓点、乐音或大段油烟机声。 |
| 可选 | 轻拍手／手腕接触 | 第3、10、12、14话及番外2，抓手腕或轻拍手 | 0.2–0.8 秒 | 轻微皮肤、衣袖接触，提供轻拍和握住两种；不可用拳击、砸物或鼓声。 |

前三个优先级中的六项是当前可补的专用素材；手部接触可选。翻页出现最频繁，先补它。脚步制作湿沙和石板两个版本即可；旧触发中三处“脚步顿住”不要求另配声音。

煎锅旧触发有四处，只保留厨房现场作为制作候选；第14、15话的上菜、早餐介绍和日记回忆不需要滋啦。碗勺旧触发有两处，只把实际放下勺子列入缺口；举勺指人不要求声音。

A04“潮声·单独铺底”仍仅保留试听，因其带有节拍与乐音而不进入场景。常规潮声已经能覆盖相应位置，无需补制一首音乐型铺底。

推荐交付：WAV、48 kHz、24 bit，独立干声；有循环需求的附循环点。禁止内置背景音乐；保留适量原始余量，游戏接入时统一调整音量。这是项目交付建议，不是现有素材已符合的声明。

逐句定位、建议文件名及停用记录见 `sfx-gap-list.json`。后续有素材再接入，缺口未使用电子提示音代替。

本表按之前提供的 Larry 技术DEMO定位；收到新版游戏导出包后需重新核对场景。

#### 尾巴音效更新后

队友尾巴包已归档，拍水、拍沙、拍木桌/桌腿、拍软垫、尾巴带上门已有专用动作副本；“翘起、卷圈、沉底”保持安静。上述翻页、两类脚步、轻开门、碗勺、煎锅6项仍缺，不用尾巴包跨材质替代。裁剪与待听感复核记录见“尾巴音效审核”（原链接 `../gal-polish/尾巴音效审核.md` 指向的文件没有进入本仓库，2026-10-20 文档整理时去掉失效链接）。

<a id="source-022"></a>

## 海风与布丁：本地兼容融合

原文档：`A素材库/归档/deliveries/local-assembly/融合说明与待确认清单.md`；整理前 SHA-256：`46f689c467dd86019774243f3d7b39b6de15722a2c71784d53a52f5c591f0c4c`。

这份是本地探索副本，没有提交、推送、发布或编版本号。Larry 作者原件、用户原本地试玩、素材库都保留。

#### 如何打开

- 服务已启动时：[本地融合试玩](http://127.0.0.1:8772/vn.html)。与旧本地试玩的 8770 端口分开。
- 重启后：双击本目录的「启动融合试玩.cmd」。运行环境借用原本地试玩的独立 Python 环境，原文件夹不要移动。
- 无需服务：打开 `content/imports/vnstudio/海风与布丁/index.html`，剧情、主曲和离线手账可用；外层播放器和在线服务需要启动本地服务。
- 标题页有「章节试阅」「音频试听」。章节试阅从初始变量开始，适合核查素材，不能代替完整路线游玩。

#### 已做取舍

| 部分 | 采用 | 理由与兼容处理 |
| --- | --- | --- |
| 剧情和台词 | Larry 最新包的 18 章、3308 句 | 48 处文字/说话人表示有变化，保留新版修订；第九话手机改扣书桌，旧礁石说法不带回。 |
| 编号、选项、变量、转场、剧情标记 | Larry 最新数据 | 新旧台词编号没有交集；按章节、文本及上下句核对声音位置，没有复制旧编号和分支。 |
| 引擎、手账、记忆与陪伴设置 | Larry 最新原生实现 | 保留原生 VNHost 和 Soul 手账，移除旧适配器对手账的隐藏；真实选项记录、离线悄悄话和随存档恢复已检查。 |
| 常用背景 | 本地已采用的 17 张原 PNG | 住宅与店铺的材质、光线和日夜版本更连贯，画面细节更足；原图不重绘、不改色，作者原 JPG 同时保留。 |
| 新家揭示镜头 | 本地住宅庭院 | 全量复核发现作者远景夕阳与清晨不符，已撤下，准确揭示CG待补。 |
| 封面、角色立绘、其余剧情 CG/特殊场景 | 逐项采用 | 全量复核撤下7张时段/服装/道具不符或占位CG，其余保留草稿；原画文件全保留。 |
| 主曲 | 用户指定的《翡翠之梦》 | 音频校验一致；保留本地选好的出现、延续、淡出与停奏位置。其他曲目缺时留白。 |
| 环境与动作声 | 本地已按场景核对的声音 | 分开音乐、环境、音效音量；实体接触才触发尾巴声；A04 和待审动作不进剧情。 |
| 作者包 52 份原声 | 原文件保留，全部进入试听 | 修正作者零时长元数据，标明「待审·未接入剧情」；未经听感确认，不自动覆盖原本接入。 |
| UI/好感/尾鳍提示音 | 自动触发关闭 | 保留能力和素材；遵照用户少用程序化音效的要求，不因数值变化再叠加声音。 |
| 存读档 | 新引擎 + 本地音频位置恢复 | 保留新版手账、变量、台词 ID，增加歌曲和环境声位置；读档不重放动作声。 |
| 界面 | 本地海绿/米白阅读样式 + 新原生手账 | 修复纸色手账的文字对比度，保留新宿主尺寸对齐；取消标题持续动画和无用背景滤镜。 |
| 启动开销 | 播放模式不构建隐藏编辑器 | 试玩标题初次只请求 1 张图片；保留最新宿主整像素布局和手账拖宽实现。 |

#### 拿不准或仍缺的部分

| 项目 | 当前处理 | 需要确认/补充 |
| --- | --- | --- |
| 作者原声与队友音效谁更合适 | 本地已核对接入继续使用；作者原声可逐段试听 | 音色、鼓点、响度、杂音仍需听感比较。本轮验证了文件解码和播放状态，没有把它称为音乐验收。尾巴 T05 原录音曾有削波，暂不接入。 |
| 主曲之外的音乐 | 保留留白和原本停奏逻辑 | 《深海之光》、争吵/压抑段与主曲变奏仍缺；不拿温柔角色曲通铺所有段落。 |
| CG_翡翠之梦 | 夜间店铺背景和现有立绘作草稿 | 第十二话的「站上柜台、张臂、蓝色尾帆」尚无对应人物构图，需正式 CG。第十三话蓝珍珠/银戒指组合也需对应素材。 |
| 住宅远近景结构与整体画风 | 新家揭示保留作者远景，近景用本地庭院 | 两张房屋轮廓和绘制密度不完全相同；角色、部分 CG 与本地背景也仍有画风差异。草稿期先保留，最终统一前不能称为美术定稿。 |
| 场景与动作描写 | 保留 Larry 新版文字 | 室内/集市出现拍水、店内下午未开灯等空间/时间问题仍需作者核对；第九话扣手机到礁石的问题已在新版改为书桌，不再列为待改文案。 |
| 真实动作声 | 缺失处留白 | 翻页、湿沙脚步、石面脚步、轻门、勺子碰杯、煎炒；手机扣木桌可补。不要用电子提示声代替。 |
| 缺背景与细节 CG | 保留作者可用原图 | 帐篷内夜/晨、营地黄昏、近海/沙洲/卧室等场景族；诗句与日记的准确文字内容需独立排版，不交给背景图猜字。 |
| 在线陪伴/记忆 | 本地离线手账可用；最新接口保留 | 当前未配置模型，作品要求的 whale 角色卡未在主分支内容目录提供；需要角色卡与模型/灵枢配置，尚未验收在线链路。 |
| 旧本地存档 | 原本地试玩保留；融合副本隔离存储 | 新旧编号完全重建，不能直接当作新版存档载入。已提供台词编号对照，可在确有需要时做显式迁移，不能自动覆盖用户数据。 |

#### 验证范围

18 章入口、84 张图片解码、99 份音频解码，主曲/潮声连续播放、三路音量、试听暂停与续播、返回标题停声、存读档的声音进度/变量/手账，以及离线打开均通过。五处代表场景与手账截图已检查。检查用独立浏览器会话，不改用户浏览器存档，不调用模型。

性能简查是独立无头 Edge 的 4 秒静止阅读样本，没有长任务；数值见「界面与性能复核.json」。它不能代表用户设备内嵌浏览器的 GPU 帧率，也不等于整条路线已完整游玩。

#### 交接文件

- `本地融合记录.json`：基线、来源、接口影响、待确认项与本地范围。
- `融合验证结果.json` / `界面与性能复核.json`：实测结果及限制。
- `compatibility-map.json` / `台词编号对照.json`：匹配和编号对照；不自动迁移存档。
- `剧情差异核对.json` / `图片采用清单.json`：文字修订与采用的图片。
- `历史本地记录/`：随旧本地包复制来的历史记录，不是这轮验收结果。

维护代码以后以最新作者包为基线移植这轮小范围适配。不要把整个输出目录直接覆盖主仓库；它包含本地运行设置与日志。此次共享台账及仓库没有修改。

2026-10-13图片全量复核已修订原采用判断，当前以「视觉全量复核/图片全量复核与补图清单.md」为准。

<a id="source-023"></a>

## 图片与切换连续性：全量复核

原文档：`A素材库/归档/deliveries/local-assembly/视觉全量复核/图片全量复核与补图清单.md`；整理前 SHA-256：`2982db47e4502e0440382b808592e5ef84b1532eba54c01e118d3963ae96c391`。

2026-10-13，针对现用本地融合试玩。没有推送、发布、删作者原件或编新版本号。

前一轮检查集中在加载/解码和少数代表截图，漏掉了你指出的开场跳转行与糍粑CG的时间矛盾。本次把“图片文件可用”与“沿剧情播放正确”分开核对。

#### 两处开场问题

1. 开始游戏先进入0号导航行：背景为黄昏，停留0.6秒后跳第一话。现在新游戏直接进入第一话2号行；导航行自身也改为正午备用，避免调试入口闪夕阳。
2. 第一话103–110号行的糍粑CG是夕阳色，前后文本与背景仍在下午。该CG撤出正文与鉴赏，保留下午背景和同一服装立绘。不是把它硬调色当成已修好的CG。

#### 本次范围

- 3308句、18章的全部背景/立绘引用与选项/跳转目标；87个图片引用全部可解码，其中新增3个引用仅是现有图片的局部取景，没有生成或覆盖新图。
- 复核前58个背景/CG引用、26张立绘原图逐项审看；134处背景/章节切换点实际舞台截图逐段检查。
- 修正后119处背景/章节切换点重新截图；核对163条背景改变的分支连接，以及全部57个剧情选择点。原章节导航行不计入剧情选择点。
- 实际点击开场并逐帧记录，不用直接跳到第18句替代开场验证。离线直接打开HTML也检查过。

这不是声称所有路线已逐句人工通关；范围是全素材、全引用、全切换点与分支目标。具体数据见「连续性验证结果.json」。

#### 取舍与修正

| 段落 | 原问题 | 当前处理 |
| --- | --- | --- |
| 开场 | 正文前闪黄昏导航图 | 直接进入第一话正午；原导航备用背景也换为正午。 |
| 第一话糍粑 | 下午→夕阳CG→下午 | 撤下错时段CG，沿用下午场景与制服立绘。 |
| 第四话手链 | 吊带裙→制服CG→吊带裙 | 沿用黄昏背景和吊带裙害羞差分，准确手链CG待补。 |
| 第八话新家 | 清晨→夕阳远景→清晨，房子也换结构 | 统一用本地庭院。上一轮恢复作者远景时忽略了时段，这次纠正。揭示CG待补。 |
| 第十一话日记 | 已搬家又突然回帐篷 | 改为住宅书房夜景，符合此前搬家后的日记空间。 |
| 第十二话梦想CG | 普通店内背景被当CG，且同图不同ID造成无用切换 | 同一夜间店内背景继续播放；不作为完成CG/鉴赏解锁。 |
| 第十三话转正 | 店内谈话夹入集市 | 2068–2074号行保持店内；2101采购日才切市场。 |
| 第十三话戒指 | 两枚戒指文本却配单颗珍珠图 | 撤下错道具CG，暂保持工坊场景，准确双戒指特写待补。 |
| 第十四话关灯店内 | 写没开灯，图中吊灯明显点亮 | 临时取日光柜台近景避开吊灯；不把下午换成夜晚。准确关灯差分待补。 |
| 第十五话早安 | 房门口配厨房，正装切制服早餐桌CG | 临时取住宅入口侧，保持正装/柔和差分。卧室门口和亲吻CG待补。 |
| 番外泳装 | 泳装/白袜对白切制服CG | 使用上午沙洲和泳装差分，泳装事件CG待补。 |
| 番外次日清晨 | 夜空、灯火沿用到早上 | 临时取床垫/贝壳/地面近景，避开夜空和灯；真正清晨帐篷内景待补。 |
| 礁石夜→和解 | 同一夜弯月/满月来回变化 | 礁石夜暂共用本地主海岸满月图；准确礁石夜近景待补。 |
| 剧情选项 | 挡住角色脸 | 少量选项放在角色另一侧，导航多选项单独布局；57个剧情选择点已检查。 |

7张CG暂撤出播放/鉴赏：糍粑、手链、新家、早安、夏日沙洲、珍珠、翡翠之梦。原图仍全部保留；撤出是当前草稿的采用判断，不删除作者成果。

#### 补图清单

优先补用户已经明确碰到的下午糍粑CG，再补影响空间/服装连续性的差分。每张同时参照人物身份、当时服装、场景母图与时段；不要只根据文件名画图。

| 素材 | 必须对应的要求 | 当前替代 |
| --- | --- | --- |
| 下午糍粑CG | 第一话，下午日光，同制服，坐礁石分享/递小半糍粑；不出现夕阳、橙红海面 | 日景+立绘 |
| 吊带裙手链CG | 第四话黄昏，蓝白吊带裙，蓝贝壳手链递给男主/代管 | 黄昏+吊带裙差分 |
| 新家揭示CG | 第八话清晨，同一栋白墙蓝顶住宅、院树秋千、海崖与热烟囱 | 同一庭院图 |
| 正装房门口早安CG | 第十五话清晨，深蓝正装，住宅卧室门口，踮脚轻吻 | 门口临时取景+正装 |
| 泳装沙洲CG | 番外上午，深蓝泳装、白过膝袜与白外搭；不能改成制服或夕阳 | 上午+泳装差分 |
| 双珍珠戒指CG | 第十三话银匠铺，两枚天青珍珠银戒在绒布上，文字后排 | 工坊普通场景 |
| 翡翠之梦事件CG | 第十二话打烊后，站柜台张臂，尾巴展开蓝帆，同一店铺夜景 | 店内夜景+普通立绘 |
| 帐篷内清晨 | 原帐篷内部同机位，日光、无星空、灯熄；被褥/贝壳/本子位置保持 | 帐角临时放大，清晰度与姿态尚不足 |
| 卧室门口清晨 | 同一住宅的真正卧室门与过道 | 借客厅入口侧，不是完成的新房间 |
| 店内午后关灯 | 同机位、吊灯关闭、有下午窗光；柜台位置正确 | 柜台局部取景 |

仍需逐步统一：营地/帐篷内外与晨昏、主海岸/沙洲/礁石时段族、卧室木色、电话CG的书房/手机道具、CG里的诗句/契约/日记准确文字，以及人物脸型/耳鳍/尾巴和陆地/水下身体形态。第十四话深水区图是有文字依据的灰色回忆，保留，不把所有跨场景都误判成错切。

#### 验证与保留

正文、姓名、台词ID、变量、选择、跳转、章节、音乐/环境/动作声配置保持不变；仅修改画面采用、取景与选项布局。用户存档仍按同一融合项目ID定位。作者原件137份逐文件SHA仍一致，原MP3与原图保留。三处临时取景有明确草稿状态，不能称为美术定稿。

重开/刷新现用本地 `index.html` 或 http://127.0.0.1:8772/vn.html 生效。当前完整结论以本报告为准，之前「融合说明与待确认清单.md」中关于保留全部CG/新家远景的判断已被这次复核修订。

#### 逐项采用判断

| 名称 | 当前引用句数 | 判断 |
| --- | --- | --- |
| CG_人鱼公主 | 9 | 夜间帐篷与睡衣阶段基本相符，保留草稿；贝壳项链、系带与坐床动作还需细化。 |
| CG_初登场 | 3 | 日间海水、制服、接本子/亮相的叙事相符，保留；海岸机位与人物母图以后统一。 |
| CG_原来是你 | 5 | 夜间营地、制服、情绪揭示相符，保留；帐篷形制与普通营地图尚未统一。 |
| CG_和解 | 5 | 夜间情绪告白可用，保留；周边礁石夜图原为弯月，已改用满月海岸。CG月亮尺度仍属夸张构图。 |
| CG_夏日沙洲 | 0 | 撤出：番外要求深蓝泳装/白袜，CG却是制服且低日照。改用上午沙洲与泳装立绘，准确CG待补。 |
| CG_布丁 | 4 | 画面是集市场景的争执情绪，和第十四话地点相符，保留；不能仅因文件名“布丁”就当作甜品特写。 |
| CG_手链 | 0 | 撤出：第四话前后为蓝白吊带裙，CG是制服。沿用吊带裙与黄昏浅滩，需同服装手链CG。 |
| CG_新家 | 0 | 撤出：原图夕阳与清晨抵达冲突，且房屋轮廓与庭院图不同。当前沿用同一住宅庭院；揭示CG待补。 |
| CG_早安 | 0 | 撤出：正装房门口段切成制服早餐桌。沿用正装/柔和差分和门口临时取景，需准确亲吻CG。 |
| CG_海豚 | 5 | 日间海豚和制服基本相符，保留；与沙洲的光照/机位不同，后续用同一海岸空间重核。 |
| CG_海风与布丁 | 5 | 夜间珍珠银链与季终相符，保留；月亮尺度夸张，尾巴/身体轮廓与立绘母图待统一。 |
| CG_深水区 | 9 | 第十话为救援，第十四话为明确的灰色回忆，保留；回忆回到集市属于有文本依据的切换。 |
| CG_深海之光 | 5 | 蓝色水下、制服/尾巴、发光生物与段落相符，保留；人物头身/海底机位仍与普通场景有差别。 |
| CG_烤鱿鱼 | 4 | 暮色帐篷和鱿鱼串对应第一话，保留；帐篷细节与营地母图待统一。 |
| CG_珍珠 | 0 | 撤出：正文为两枚蓝珍珠银戒在绒布上，图仅突出单颗珍珠。保留工坊背景，需双戒指特写。 |
| CG_电话 | 5 | 情绪肖像和书房用途可保留草稿；抢手机动作/手机道具不准确，新旧书房布局也不一致，需后续重绘。暖窗光不足以独自判成明确夜景。 |
| CG_立约 | 12 | 日间礁石、本子与签字动作相符，保留；契约文字应后期准确排版。 |
| CG_糍粑 | 0 | 撤出：第一话仍是下午，图为夕阳色，切回日景产生错误时间倒退。沿用下午背景和同服装立绘，需下午分享糍粑CG。 |
| CG_翡翠之梦 | 0 | 撤出：当前仅普通夜间店铺图，不能算完成的事件CG或鉴赏解锁。沿用同一个背景ID，需站柜台张臂/尾帆CG。 |
| CG_诗句 | 7 | 夜景、制服、念诗姿态可保留；本子上的诗句不能靠伪字，需要准确文字版面。 |
| CG_集市女仆 | 4 | 日间集市与女仆装相符，保留；人物母图/衣服细节仍需统一。 |
| 书房_午后 | 90 | 沿用本地住宅书房母图；空间与夜/黄昏相连，保留。 |
| 书房_夜 | 108 | 沿用同一书房夜差分；和解后日记已恢复到此，不再出现搬家前帐篷。 |
| 书房_黄昏 | 115 | 与书房日夜的门窗/书桌基本连贯，保留。 |
| 卧室_夜 | 26 | 夜间与床边按摩段相符，保留草稿；蓝色现代房间与新住宅木质风格不同，需卧室系列统一。 |
| 厨房_清晨 | 149 | 早餐与早晨做饭可用；已撤出房门口早安段，不把厨房代替卧室门口。 |
| 大房子_院子 | 47 | 白墙蓝顶、树与秋千相符；作为新家揭示和庭院共用，避免夕阳/清晨跳变。远景海崖/烟囱CG仍需补。 |
| 客厅_午后 | 125 | 住宅木色、窗景和过道可用；新门口临时取景从本图取入口一侧，不冒称真实卧室门口。 |
| 封面_ISLAND | 0 | 保留标题封面，未作为正文场景；静态封面不持续缩放。 |
| 小镇_清晨 | 2 | 清晨抵达小镇符合时间，保留；街道与住宅海岸地理关系还需场景母图。 |
| 帐篷_夜 | 217 | 现用用户夜间营地图；帐篷形制与作者黄昏/内部不同，属于明确待统一项。 |
| 帐篷_黄昏 | 43 | 营地黄昏用途符合正文，保留；与新夜景不是严格同一帐篷。 |
| 帐篷内_夜 | 62 | 第六话和番外夜间可用；已撤出搬家后的日记段；清晨不再展示完整星空。 |
| 店面_下午 | 21 | 下午开店外景可用；外立面与内景空间/建筑样式需后续固定。 |
| 沙洲_上午 | 62 | 上午沙洲可用；恢复泳装段使用本图，保留。 |
| 沙洲_午后 | 163 | 午后偏暖图可用草稿；与上午月牙沙洲地形/机位关系不够明确，需同一沙洲母图。 |
| 沙洲_黄昏 | 103 | 黄昏太阳位置明确，保留；同一沙洲形状需与上午对齐。 |
| 浅滩_上午 | 43 | 沿用用户主海岸日图，上午日常可用；需要精确上午光线时再做差分。 |
| 浅滩_午后 | 63 | 与正午/上午共用海岸日图；第一话下午不会插入夕阳CG。 |
| 浅滩_夜 | 267 | 海岸夜景母图；现在也供礁石夜段共用，以免同一夜换月相。 |
| 浅滩_正午 | 69 | 正文明确盛夏正午，保留；开场按钮直接从第一话进入。 |
| 浅滩_清晨 | 60 | 原清晨海岸时段可用，保留；与用户日/夜主机位不同，晨景差分仍需补。 |
| 浅滩_黄昏 | 83 | 黄昏段可用；导航不再播放它。 |
| 海面_黄昏 | 17 | 第三话上浮夕阳相符，保留。 |
| 深水区_水下 | 26 | 蓝色水下场景可用；与发光海底属于不同深度，非错误时段切换。 |
| 深海_珊瑚礁 | 84 | 用户蓝色发光珊瑚图可用；普通水下与CG仍需要同一生态/空间参考。 |
| 礁石_上午 | 71 | 上午谈话/立约符合时段，保留；近景海岸布局待统一。 |
| 礁石_夜 | 133 | 原弯月图已不用，当前使用本地主海岸满月夜景；精确同地点礁石近景仍缺。 |
| 礁石_黄昏 | 52 | 夕阳时段正确，保留；与主海岸的朝向/地貌需参考统一。 |
| 翡翠之梦_二楼夜 | 115 | 打烊后窗口/月光和灯火可用；楼梯位置与楼下基本相连，保留。 |
| 翡翠之梦_厨房 | 82 | 昼间后厨可用；早晨/下午共用，不暗自变成深夜。 |
| 翡翠之梦_店内 | 111 | 营业日景可用；店内谈转正不再误切集市。未开灯的午后另取临时柜台视角。 |
| 银匠铺 | 53 | 工坊谈话和日光可用；双戒指展示暂保留本场景，准确特写待补。 |
| 集市_上午 | 221 | 采购日景可用；只在实际采购/市场段出现。 |
| 集市_珍珠摊 | 24 | 购珍珠特写场景可用，保留；市场与小巷空间仍需母图对齐。 |
| 集市_饰品巷 | 87 | 饰品购买用途可用，保留。 |
| 餐厅_夜 | 96 | 晚饭用途可用；角色昼夜层次自然，保留。 |
| 鲸鱼小姐 | 534 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_吊带裙 | 27 | 蓝白吊带裙组可用，手链段已保留同服装；不能切回制服CG。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_吊带裙害羞 | 47 | 蓝白吊带裙组可用，手链段已保留同服装；不能切回制服CG。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_吊带裙得意 | 28 | 蓝白吊带裙组可用，手链段已保留同服装；不能切回制服CG。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_吊带裙生气 | 13 | 蓝白吊带裙组可用，手链段已保留同服装；不能切回制服CG。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_坏笑 | 107 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_女仆装 | 27 | 女仆组可用，购物篮姿态符合市场用途；与普通服装按剧情分别使用。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_女仆装害羞 | 33 | 女仆组可用，购物篮姿态符合市场用途；与普通服装按剧情分别使用。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_女仆装得意 | 6 | 女仆组可用，购物篮姿态符合市场用途；与普通服装按剧情分别使用。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_害羞 | 292 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_得意 | 357 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_慌乱 | 137 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_抱本子 | 46 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_柔和 | 399 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_正装 | 29 | 正装组可用，早安保持同一套服装；柔和差分已用于亲密段。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_正装柔和 | 5 | 正装组可用，早安保持同一套服装；柔和差分已用于亲密段。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_泳装 | 8 | 泳装/白袜阶段可用，已替换错装CG；滑落袜口等动作仍缺细化。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_泳装害羞 | 16 | 泳装/白袜阶段可用，已替换错装CG；滑落袜口等动作仍缺细化。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_潜水 | 79 | 水下用途可用；人鱼式下身与陆地双腿/侧尾的形态差异需作者确认，暂保留水下专用。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_生气 | 303 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_睡衣项链 | 61 | 睡衣/贝壳项链阶段可用；抱枕站姿不能精确表现蹲着验贝壳，需要动作差分。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_睡袍 | 60 | 图实际偏围裙/厨房服，当前做饭场景可用；不能凭名称把它当卧室浴袍。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_睡袍害羞 | 15 | 图实际偏围裙/厨房服，当前做饭场景可用；不能凭名称把它当卧室浴袍。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_睡袍慌乱 | 8 | 图实际偏围裙/厨房服，当前做饭场景可用；不能凭名称把它当卧室浴袍。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_长裙 | 29 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 鲸鱼小姐_长裙项链 | 14 | 制服组表情可辨、透明背景有效；头身与脸型有细微差异，仍需固定人物母图。 已核对实际舞台取景；站姿/姿态差分不足不能算对应动作CG。 |
| 翡翠之梦_店内夜 | 14 | 打烊夜景用途正确，保留；假CG切换已经合并，正式动作CG仍缺。 |
| 住宅_房门口清晨_临时取景 | 36 | 借客厅入口侧临时取景，时间/服装保持；不是完成的卧室门口新图。 |
| 帐篷内_清晨_帐角临时取景 | 15 | 借床垫、贝壳和地面近景避开灯/夜空；放大后清晰度较弱，必须补真实清晨内景。 |
| 翡翠之梦_午后未开灯_柜台临时取景 | 71 | 保留日光、避免明显点亮的吊灯；准确的未开灯同机位差分仍需补。 |

全篇切换相册：`全篇切换_修正前_01–09.jpg`、`全篇切换_修正后_01–08.jpg`；数据/分支/修正定位在同目录JSON。截图在独立浏览器完成，没有改用户浏览器存档。

<a id="source-024"></a>

## 角色与场景融合检查点

原文档：`A素材库/归档/deliveries/scene-character-integration/README.md`；整理前 SHA-256：`9581e1b1b72d9a640d748b6b82949295ec043e13d9a7a41a939d84158e685fbb`。

本次用户要求先上传当前进度，不代表美术全部完成。见 docs/collab/work-ledger/scene-character-integration.md 与 docs/content/art-production/角色与场景融合审核.md。

当前两处CG.jpg 是收口后的真实画面；中间状态审核及40背景抽样早于用户最后两项修正，柜台P18拼接与居中拼接写诗均已退出这些镜头，不能作为最终采用图。C26原PNG、提示词、参考SHA和生成回传在 content/assets/art-upgrade/；请求Image2.5/max不等于后端确认，实际1672×941/medium、模型名未回传。

仓库包含完整游戏源文件和素材，从根目录游玩.html进入。约158MB单文件HTML留在本地产物，校验清单在此，队友运行 python tools/build_single_file_game.py 重建，不编发行号或把大HTML重复塞进Git。

<a id="source-025"></a>

## 角色与背景合成抽样审核

原文档：`A素材库/归档/deliveries/scene-character-integration/中间状态审核_非最终柜台.md`；整理前 SHA-256：`71120e1bbb67059e8a615c2322fc7e1274268ee2f077d47d500ba227c89e601a`。

这份记录对应柜台一体 CG C26 生成前的中间工作状态。柜台复用 P18 的截图属于退选试摆，不代表最终采用；用户要求一体生成，最终应以新 CG 的独立审核为准。

#### 范围与证据

- 用本地真实播放器与 Edge 1440×900 逐背景抽样 40 个有角色的背景资产 ID，共 38 种 production 背景；B02 的三个时段别名分别检查。
- 逐张浏览五页接触表；另以原始截图尺寸重点查看 B03、B04、B07、B10、B11、B13、B15、B16、B17、B28、B30、B39、B40、B42。
- 追加 8 对相邻实际点击切换：提笔坐下、写诗 CG、写诗 CG 退出、和解坐下、结局坐礁、打烊夜景、柜台叙述、二楼夜景。截图及实际前后 ID 见 transitions/report.json。
- 两轮浏览器检查没有页面脚本错误。全项目有 2641 条带立绘的台词，本次没有逐条人工浏览这 2641 条；背景覆盖不等于逐剧情全量人工验收。
- audit-samples.json 保存抽样台词、背景、姿势、实际滤镜及代码文件 SHA256。截图仅作这一中间状态的证据。

#### 已确认的改善

- 夜景没有把脸压黑到无法阅读，蓝发仍是蓝色，未出现明显紫发、绿发或统一泛黄。白毛衣和浅色睡衣仍有可辨纹理。本轮没有发现必须回退的默认光色数值。
- B07 的前景大礁石使写诗跪坐及结局坐姿有明确承托位置，优于此前 B04 的浅水画面；原取景保留了月亮。
- 写诗 CG 退出后的“我抬起头”已继续 B07。复查当前实机，CG 退场后不再突然丢失礁石地貌。
- 角色面对话肖像的尺度总体成立。无需给这些裁到膝部以下的肖像统一添加脚影，或强缩到背景中的椅子/坐垫位置。
- 默认光色只是轻度整体调色，没有重画太阳、窗光、灯火的方向性照明。尚不能称作完整重打光。

#### 仍需处理的具体缺口

| 位置 | 问题 | 建议 |
|---|---|---|
| B03，89lweywr，1577 | 明说“半个身子已经浸在水里”，裙摆及腿仍完整压在水面前 | 为这类明确涉水的镜头制作水位遮挡/专用一体 CG；不可给全部浅滩谈话统一齐腰淹没 |
| B17，otvpviwd，3226 | “抱着膝盖坐在床上”，当前 L28 是抱玩偶站姿，床在身后 | 同睡衣的抱膝变体或床上完整 CG；不要换错服装去凑现有抱膝图 |
| B40，01qp63pb，2436 | “柜台后、背对门、擦盘”，当前 L05 是柜台前正面生气姿势 | 专门擦盘动作/背侧取景，需处理柜台前景遮挡 |
| B35，ycyll3lk，2808 | “趴在桌边”，当前 L07 双手交叠站姿 | 趴桌动作与桌面一体构图，或相应可遮挡的动作素材 |
| B15，13v81y0j，3181 | “坐在小桌边”，当前 L29 白裙站姿 | 白裙坐姿与小桌同镜，保持服装连续 |
| B07，caqa6eg2，1811 | “抱着膝盖”，P18 仍是并膝垂腿、双手放膝上 | 岩面位置已成立，但仍缺海军裙抱膝动作；不能用营地厚毛衣抱膝图替代 |
| 黄昏、营火、室内夜景 | 亮度冷暖改善，但缺少准确的暖背光、窗光、灯火分区、接触阴影 | 后续按原有主光方向做局部绘制或一体生成；避免霓虹轮廓、全人染色和大椭圆假影 |

#### 柜台试摆的特别说明

q4tzhuf3 的 P18/x900/y692/h650 试摆在空间上比最初 x995/y710 更可信，裙褶承重点能靠近木柜台前沿。但这仍是两个图层拼接，不能代替用户要求的一体柜台 CG。37_B39.png、37_B39_无对白.png 以及 transitions/柜台叙述_后.png 均只保留为退选过程证据；不得作为本轮最终成品展示。新 CG C26 需要重新审核人物年龄、服装、尾巴单根结构、臀腿与台面接触、店内灯光、对话框遮挡及前后站坐切换。

<a id="source-026"></a>

## tanpowasd/dev 合并审核

原文档：`A素材库/归档/deliveries/tanpowasd-dev-review/README.md`；整理前 SHA-256：`6f7228fc0c4af239a953cc11433743ca856a5e251f2a2c02bc5956b6f0b7334e`。

源分支 `01bc3eea4a1256509716768906b4bae0f25e049c` 的7个提交与主分支 `22d231f` 比较，PR #6 保留完整历史，另补路径兼容、音乐来源修复和时间轴增量渲染。

`content-compatibility.json` 核对3308句/18章及音乐音效、全部运行媒体与作者原件。`browser-validation.json` 记录真实Edge托管、存读档、回放、离线素材开发和单文件测试。`timeline-before/after.json` 为同400条合成事件的本机渲染开销，不能当作通用设备性能保证。

本地独立单文件位于 Codex 工作输出 `outputs/tanpowasd-dev-review/海风与布丁_单文件游玩.html`，可用 `tools/build_single_file_game.py` 从本仓库重建。不重复提交嵌入全部媒体的大HTML。测试配置、模型凭据、玩家存档和本地环境不入库。

<a id="source-027"></a>

## 透明鲸鱼 UI 与平滑渐变：交付与接入

原文档：`A素材库/归档/deliveries/whale-ui/README.md`；整理前 SHA-256：`926b06a7efa365a785c987a2122d8c4300c85e609f337d1a14837d7a4b088abb`。

2026-10-17 由用户提供作者本地修改包 `larry-complete-game.zip` 与 [更新说明](<sources.md#source-028>)，要求按仓库逻辑更新游戏。

#### 这份包实际改了什么

逐文件核对（见 [manifest.json](<../A素材库/归档/deliveries/whale-ui/manifest.json>)）：

- 只有 `游戏文件夹/index.html`（播放器壳）与单文件版 `海风与布丁.html` 被修改。
- `game.js` 与 135 项 assets 和 2026-10-13 作者原包（[larry-vn](<../A素材库/归档/deliveries/larry-vn>)）逐字节相同。

因此这份包的基线是 10-13 原包，**不是**仓库当前运行版。仓库运行版此后已接入场景/音频融合、GalAgent、玩家体验打磨、美术全量重制与新第一话（3315 节点）。整包覆盖会回退这些成果，所以没有这样做。

#### 接入方式

以 10-13 原件 `index.html` 为共同祖先，把作者新 `index.html` 与仓库当前 `content/imports/vnstudio/海风与布丁/index.html` 三方合并：

- 作者改动全部带入：`VN_FADE` 叠化控制器、选项淡入、按钮过渡、`WHALE_UI_APPROVED` 皮肤区块（主页双水平线、选项四角留白、对话框上实下透、名字牌）、快进取消叠化、存档列表采样时机、减少动态效果。
- 3 处并列新增冲突（样式表尾部、存档列表标题、脚本尾部）两边都保留：仓库的插件面板、`game-polish.css`、新存读档标题、章节试阅/声音收藏面板不变。
- 皮肤区块放在 `game-polish.css` 之后，原稿视觉优先。
- 新增 `WHALE_UI_REPO_ADAPTER` 区块，只改位置与尺寸，不改皮肤/透明度：
  - 主页按原稿放右侧、每项向左错位 18 px，封面不改（用户 2026-10-17 确认）。仓库主页有 7 项，原稿 44 px 间距会超出画面，故间距收为 26 px，第 5–7 项按同一步长继续错位（最多 108 px）。
  - 底栏保留玩家体验打磨确定的文字标签（回看/自动/快进…），恢复其按钮宽度；原稿 34 px 宽会把标签挤坏。
- 剧情选项继续使用仓库的左右侧排布，套用原稿四角留白底图。

`game.js`、assets、项目 ID（`bqlsg5c2-local-fusion`）、节点/素材 ID、存档键均未改变。

#### 未入库

原 ZIP（135 MB）、单文件版、`修改备份/`。单文件版内嵌的是旧数据，不能当作当前版本发布；需要单文件时用 `tools/build_single_file_game.py` 从当前运行目录重新生成。不新建版本号或 Release。

#### 素材来源提醒

鲸鱼轮廓来自 LobeHub 的 DeepSeek 图标（`@lobehub/icons-static-svg`）。公开发布前需核实许可与商标使用条件，详见更新说明第 7 节。

<a id="source-028"></a>

## 《海风与布丁》更新说明：透明鲸鱼 UI 与平滑渐变

原文档：`A素材库/归档/deliveries/whale-ui/更新说明-透明鲸鱼UI与渐变.md`；整理前 SHA-256：`59203fb54e40414704dec9925e94db805fc9399d2ce9f8a7a8b980c3abd8e2b5`。

> 本文汇总本轮对话中已经完成的游戏修改，供后续 GitHub 提交、Release 撰写和版本维护使用。
> 以当前实际文件为准，版本号、Tag 和发布日期由发布时确定；本轮未执行 Git 提交、推送或创建 Release。

#### 1. 可用于 GitHub Release 的摘要

##### 界面更新

- 开始主页采用 DeepSeek 鲸鱼纹理的开放双水平线按钮，取消原胶囊边框、厚重阴影和毛玻璃效果。
- 主页四个按钮从右上到左下轻微错位，依次向左偏移 0 / 18 / 36 / 54 px。
- 剧情文本选项使用四角留白的开放边框，底色不透明度提高到与主页相同的中心强度，改善复杂背景下的辨识度。
- 对话框改为蓝灰色纵向透明渐变：上部更实、下部更通透，搭配开放角线、淡鲸鱼纹理和渐变名字牌。

##### 动画与体验

- 主页、剧情选项、存读档、设置、回看、鉴赏、CG、结局卡和手账等主要切换增加柔和平滑过渡。
- 剧情快进时跳过新增叠化，避免拖慢；快进期间主动打开菜单仍可渐变。
- 尊重系统“减少动态效果”偏好，关闭新增运动效果。
- 保留原有剧情、选项效果、快捷键、音频及存读档处理，不新增游戏运行依赖。

##### 兼容与发行

- 同步更新单文件版和文件夹版。
- 项目 ID、剧情节点 ID、素材 ID 和存档格式均未改变。
- 旧进度应在原浏览器、原入口和原存储环境下继续读取；更新前建议手动存档，不要清除浏览器数据。

---

#### 2. 最终实装样式参数

所有尺寸均为游戏内部 **1280 × 720** 设计坐标，窗口缩放后屏幕像素会相应变化。

| 部位 | 最终边框 | 最终底色与透明度 | 布局 |
| --- | --- | --- | --- |
| 开始主页四项 | C 版“开放 · 双水平线”，只有上下线条，无侧线或角线 | 中部不透明度约 78% / 74%，向外经过 54%，最左右端淡出至 0% | 右侧斜向微错位，每项向左 18 px；按钮约 362 × 53 |
| 剧情文本选项 | D 版“四角留白”，中段边框开放 | 径向渐变：中心 78%，外围渐变端点 54% | 默认宽 520、最小高 76；文字可换行 |
| 对话框 | 四角开放线、右下淡鲸鱼 | 顶部 78% → 中段 55% → 底部 22% 不透明度 | 1160 × 200，距左右各 60、底部 38 |
| 名字牌 | 小圆角细框 | 蓝灰渐变 | 位于对话框左上，保留人物姓名及原说话人颜色 |

**说明：** 本文使用“不透明度”表示底色 alpha，数值越高，背景越不容易透入。主页与剧情选项的渐变形式不同：主页两端仍完全淡出；剧情选项保留径向渐变与四角边框，并非把两者强行改成同一张图。

##### 已修正的设计偏差

早期曾只把主页描边替换为双水平线，却保留较实的圆角底块；页面下方的放大样例、导出图也曾仍引用旧版。用户指出后已修正：

- 按原 C 版使用上、下两段水平线：`M134 34.5H508M52 109.5H508`。
- 去掉圆角底块，底色向两侧淡出，避免视觉上仍像闭合按钮。
- 主页、放大样例和导出统一使用修正版素材。
- 正式游戏内已验证实际加载的 SVG，而非只检查设计稿标题。

---

#### 3. 本轮代码与文件变更范围

##### 游戏发行文件

以本目录为根：

| 文件 | 状态 | 内容 |
| --- | --- | --- |
| `海风与布丁.html` | 已修改 | 单文件版播放器、渐变控制器和内嵌 UI 样式；原剧情和图片/音频数据保留 |
| `游戏文件夹/index.html` | 已修改 | 文件夹版播放器，与单文件版的播放器壳保持一致 |
| `游戏文件夹/game.js` | 未修改 | 原剧情数据、变量、角色、资源映射及项目 ID |
| `游戏文件夹/assets/` | 未修改 | 原背景、CG、立绘、音效；新 UI 图形以内嵌 SVG 存放，不依赖新增资源文件 |
| `说明.txt` | 未修改 | 原运行说明 |
| `docs/sources.md#source-028` | 新增 | 本说明文档 |

##### 实现入口

###### 平滑切换

- 新增 `VN_FADE` 视觉控制器。
- 在切换前复制旧舞台到隔离的 Shadow DOM，再让旧画面淡出，呈现新旧画面叠化。
- 旧层使用 `aria-hidden`、`inert` 和 `pointer-events:none`，不会被普通 DOM 查询误识别成真实菜单，也不接收操作。
- 复制时保留滚动位置、输入状态及必要显示状态，避免回看页面在切换中跳回顶部。
- 同一帧嵌套调用去重；动画完成、取消和超时均清理旧层，防止快速操作堆积遮罩。
- 不等待动画完成才执行剧情：变量、选项跳转、音频和存档仍按原流程运行。
- 存档列表在异步读取完成、即将更新页面时采样，而不是长期持有点击时的旧画面。

###### 视觉样式

- CSS 区块位于 HTML 的 `WHALE_UI_APPROVED_START` / `WHALE_UI_APPROVED_END` 标记之间。
- 样式节点 ID：`whale-approved-ui`。
- 内嵌变量：`--whale-menu`、`--whale-choice`、`--whale-dialogue`。
- 所有新增皮肤选择器限定到 `body.game`，不修改编辑器模式的皮肤。
- 对话框皮肤放在 `#pdlg::before`：无字演出时皮肤和台词仍可淡出，原工具按钮保留可用。
- 长台词允许框内滚动，避免新增框高导致末行无法查看。
- 工具栏保留真实游戏图标和回调，没有拿设计预览中的装饰按钮替代实际功能。

##### 动画参数

| 项目 | 时长 / 规则 |
| --- | --- |
| 主要旧画面叠化 | 360 ms，`ease-in-out` |
| 剧情选项出现 | 280 ms 淡入 |
| 宿主停靠手账切页 | 280 ms 内容淡入 |
| 界面按钮状态 | 按部位约 180–250 ms；新皮肤主要为 200 ms |
| 无字演出对话框皮肤淡出 | 400 ms |
| 新立绘尚未解码 | 旧画面最多额外保留约 180 ms，不阻塞剧情执行 |

启用统一叠化时，避免再叠加同一次场景变化的旧背景淡入/黑场转场。原人物动作、剧情瞬时特效代码未删除；并非每个打字字符或单纯音量滑条变化都进行整屏转场。

---

#### 4. 剧情与存档兼容性

##### 未改变的内容

- 项目 ID：`bqlsg5c2`。
- 剧情节点数：3308。
- 16 话主线、2 篇番外、58 个选项节点、2 处限时选择；本轮未增删剧情。
- 好感及其他剧情变量、分支条件、选项赋值、结局逻辑。
- 节点及素材 ID、存档数据结构和存储键。
- 原背景、CG、立绘、音效与正文。

##### 更新建议

1. 更新前在游戏内手动存档。
2. 保持原浏览器、浏览器用户配置和原启动地址，替换对应发行文件。
3. 刷新页面或重新打开游戏；若旧页面仍在运行，它不会自行加载新样式。
4. 不要为了“刷新样式”清除浏览器全部数据，否则可能删除进度。

本轮没有实现跨浏览器存档迁移、存档导出/导入、自动存档或真正的剧情回滚。换地址、端口、浏览器、用户配置，特别是 `file://` 与 HTTP 互换，仍可能因存储隔离而读不到原进度。GitHub Pages 的线上存档也不会自动与本地文件共享。

---

#### 5. 测试记录与边界

##### 已完成

- 两个真实 `file://` 入口均使用独立 Edge / Playwright 浏览器上下文检查，不接触玩家日常浏览器存档。
- 主页按钮实际加载修正后的双水平线 SVG；无圆角侧框；四项水平错位为 18 px。
- 主页菜单、设置、鉴赏、CG开合、回看、手账、页签、返回标题和剧情选项交互。
- 存档写入、读取后剧情节点与变量一致性；菜单/选项渐变、限时默认选择、快进、连续切换清理、减少动态效果。
- 对话框尺寸、上实下透参数、无字演出时皮肤淡出。
- 篇章入口的三个选项完整显示、可点击；390 px 窄视口的主页按钮无越界。
- 脚本语法、表达式、重复标签、跳转目标和资源引用检查。
- 600 次数据层路线模拟，覆盖全部 3308 个节点和 4 类结局标记，无超过步数上限的循环。覆盖不代表穷尽所有变量/路线组合。
- 最后一次剧情选项不透明度修改，使用前后文件比较确认：只改变选项 SVG 的 48%/24% → 78%/54%，主页、对话框及其余播放器代码没有改变；随后双版 UI 测试通过。
- 当前再次检查：两版剧情数据除资源路径外一致，播放器壳一致。

##### 尚需发布前人工复核

- Firefox / Safari / 不同移动设备及触屏手势的完整兼容性。
- 全剧情中所有特效、快速操作和窗口尺寸组合的主观观感与性能。
- 外部 galLingS 服务端、真实模型连接、同源 iframe 停靠手账的完整集成；本轮未修改或运行该服务端。
- GitHub Pages / Release 下载包解压后的真实运行入口。

已有工具栏、设置/鉴赏等菜单的功能保留，但它们没有全部重做成新按钮皮肤。相关界面切换有渐变，不应将本版描述成“所有 UI 控件均已重新设计”。

---

#### 6. GitHub 提交与发布建议

##### 推荐提交范围

相对本游戏目录，至少提交：

```text
海风与布丁.html
游戏文件夹/index.html
更新说明-透明鲸鱼UI与渐变.md
```

若仓库尚未包含游戏文件夹版的 `game.js` 和 `assets/`，必须一并加入原有完整依赖，否则 `index.html` 不能独立运行。若仓库已包含且它们无改动，不必制造重复变更。

**不要默认上传整个工作目录。** 本轮额外生成的下列内容一般不属于发行必需文件：

- `修改备份/`：本地恢复用途，含多份较大 HTML，不建议推到主分支或放进发行包。
- 原制作机器的分析目录：分析镜像、模拟记录、早期设计、临时截图及本机脚本；不应整目录无筛选上传。
- 自动化浏览器配置、缓存、临时文件、玩家存档、模型密钥或个人配置。

如准备将分析脚本迁入仓库，请整理为 `tools/`，把可维护 CSS 和最终 SVG 迁入设计源目录，改掉当前脚本内写死的本机路径及 Playwright 路径。当前游戏运行本身不依赖这些本机工具。

##### 发行方式

**单文件版：** 将 `海风与布丁.html` 作为 Release 附件；当前文件约 35.6 MiB（37,365,442 字节），包含图片、音效和新 UI。

**文件夹版：** 打包 `游戏文件夹/` 全部内容，包含 `index.html`、`game.js` 和 `assets/`；不要只发 `index.html`。

**GitHub Pages：** 若使用静态托管，可将文件夹版放在站点目录并访问其 `index.html`。本轮没有创建站点、配置路由或测试线上部署，需发布者自行验证。

##### 版本维护流程

1. 以 `游戏文件夹/index.html` 为播放器维护源；UI 标记区块内维护确认后的样式和 SVG。
2. 使用可维护的 CSS / SVG 源生成内嵌样式，避免直接编辑超长 Base64 字符串。
3. 同步单文件版时保留已有 `window.VN_GAME` 数据块，只替换播放器壳，确保没有保留外部 `game.js` 依赖或重复注入数据。
4. 对比两版数据/壳一致性，运行语法、资源、存档和界面测试。
5. 最后生成截图和 Release 附件；截图使用实际游戏页面，不把设计示例当成实装截图。

原内置导出函数从已导出的游戏再次导出时存在资源内联和重复注入的限制，不建议未经检查直接用它生成最终发行包。本轮同步脚本避开了这一问题，但尚未把内置导出器本身重写。

---

#### 7. 素材来源和公开发布注意事项

##### 正式版采用的新增图形

- 按钮背景、开放边框、对话框渐变和布局由本轮代码绘制。
- DeepSeek 鲸鱼轮廓来自 [LobeHub 的 DeepSeek 图标页面](https://lobehub.com/icons/deepseek)。
- 实际下载源：<https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek.svg>。
- 正式游戏最终使用鲸鱼标志，**没有采用早期试做的鲸鱼娘 Q 版人物**。
- 设计预览引用的背景均来自用户原游戏资源，本轮没有新下载游戏背景或替换原美术。

##### 发布前需确认

图标库开源不等于取得相关商标或角色的所有使用权。公开发布前应核实所用图形的具体许可、署名要求及品牌使用条件，保留必要来源说明；本次修改不代表 DeepSeek 官方授权、合作或背书。

原游戏图片、音乐/音效、角色和剧情的权利仍需由发布者按原项目许可核实。本文不替代原项目许可证，也不对原游戏资源重新授权。不要因为新界面代码可公开，就推断整个资源包可按同一许可证分发。

---

#### 8. 本地回退与维护记录

本地修改前的备份目录，均位于游戏根目录的 `修改备份/` 下：

| 备份目录 | 恢复后的状态 |
| --- | --- |
| `渐变前-20261017-000539` | 本轮改动前的原始播放器，无新增渐变及鲸鱼 UI |
| `应用透明鲸鱼UI前-20261017-014545` | 已有平滑渐变，但未应用透明鲸鱼 UI |
| `剧情选项加实前-20261017-015126` | 已应用最终主页与对话框，但剧情选项仍为48%/24% |

回退时分别恢复对应备份中的 `海风与布丁.html` 和 `游戏文件夹/index.html`，不要只恢复一个版本。无需清除浏览器存储。备份目录不是发行依赖。

##### 本地维护工具索引（不属于游戏运行依赖）

位于原制作机器的本机分析目录：

| 文件 | 用途 |
| --- | --- |
| `透明鲸鱼UI.css` | 可读的皮肤样式模板 |
| `apply-whale-ui.cjs` | 将最终 SVG 以内嵌 data URL 写入文件夹版播放器 |
| `sync-single.cjs` | 保留内嵌游戏数据、同步单文件版播放器 |
| `inspect.cjs` | 统计数据、检查资源、比较两版 |
| `validate.cjs` | 脚本语法、表达式和路线模拟 |
| `test-fades.cjs` | 动画、菜单、选项、存读档等浏览器回归 |
| `test-whale-ui.cjs` | 实装样式、布局、实际SVG引用和窄屏边界验证 |
| `verify-choice-opacity.cjs` | 最后一次选项加实的精确差异验证 |

早期“海蓝水晶”、简化透明版、六款鲸鱼娘等设计探索仅属于选型过程；最终样式以本文件第2节及当前实际游戏为准。此前零散笔记可能还记着旧透明度，不应作为最终发行参数。

---

#### 9. 当前发行文件指纹

以下为编写本文时的 SHA-256，便于确认待发布附件没有混入旧版本。后续修改这些文件后需重新计算；本 Markdown 不参与下列指纹。

| 文件 | SHA-256 |
| --- | --- |
| `游戏文件夹/game.js` | `6552b761378f25e120a87d49b0ada382da096103f84511bceda248ff69fb514e` |
| `游戏文件夹/index.html` | `69ac613cffa077638a5a825649b23fc015bd3c45baf277cd68593bfac509921f` |
| `海风与布丁.html` | `1b34d2d2643888fdc52c586aa34009f4a4095fe9b6c9adb8da9778cc68ef2f20` |

#### 10. 发布检查清单

- [ ] 确定版本号、Tag 和 Release 标题。
- [ ] 确认本轮只提交计划内文件，检查 `git diff --stat` / `git diff --check`。
- [ ] 排除备份、缓存、个人配置和密钥；核实游戏与鲸鱼图形许可。
- [ ] 若发布维护源，迁移最终 CSS / SVG 和工具，移除本机绝对路径。
- [ ] 确认单文件与文件夹版同步，资源完整，文件指纹对应本版。
- [ ] 从新解压的发行包启动两个版本，检查菜单、选项、对话框和声音。
- [ ] 在原入口测试旧进度；同时用干净环境测试首次游玩。
- [ ] 检查快进、减少动态效果、日夜场景可读性及窄屏操作。
- [ ] 若使用 galLingS / GitHub Pages，单独做实际集成或线上验收。
- [ ] 在 Release 写明变更、兼容提示和素材来源，再上传附件。

<a id="source-029"></a>

## 2026-10-18 晚 全面审查（剧本 / 美术 / 音频与界面）

原文档：`docs/collab/work-ledger/2026-10-18-full-audit.md`；整理前 SHA-256：`f77931ed54c27baf8f17786af61793c75862e8163b51e69084f4ffc0e26900b8`。

用户 10-18 19:56 要求："从头到尾全方面审查游戏，显然的问题直接改，待办列清单。" 三份原始审查报告存于 `docs/collab/audit/20261018/`。

#### 已直接修改（本提交）
- 剧本：153 处引号统一（叙述“”→「」、对白内嵌套→『』，含 4 条选项文字与第四话标题）；用户写的第一话文字未动。
- 剧本：19 处章末"好感 {好感} 尾鳍信号 {尾鳍}"数值显示删除（决策第 16 条：好感数字默认不显示）。存档点文字保留。
- 立绘：L15 补回缺失的第二条腿（以现有腿镜像移植，裙摆在前），去掉半透明肉色竖条和线头；P10 删掉多出的第三片下垂尾鳍；P05 删掉尾鳍后多伸出的长尖尾；L08 去掉左鳍上的第二个旋纹（只留一个）；L07 补头顶呆毛旁的发丝缺口、左侧碎发梢重画；L03 裙面透出的鳞片纹改成实色裙布；P14 右侧发间灰白薄雾清掉（第二个提交）。其余像素不变。
- 立绘透明底薄雾（第三个提交）：L01 L02 L21 L22 L24 L25 P01 P13 P15 P18 清掉发梢间 alpha<16% 的"幽灵发"薄雾（保留 1px 抗锯齿边），浅色背景上头发不再透底。
- P12 删掉尾巴左侧毯子流苏旁的发丝状残线（第四个提交）；尾身右上缘小缺口用 Image2.5 局部补成连续轮廓（第六个提交）。
- L37 尾鳍左片原来被画布左缘切成直线：画布左右各扩 120px（1024→1264 宽，人物居中位置与高度不变），用 Image2.5 补出鳍尖，只合成新增部分（第五个提交）。
- CG_DRY（上一提交 2eb5103）：尾端多出的小尾鳍改为一对完整尾鳍。
- 配音：`vo_wqr5d8bu`（#630）开头误念的导演提示（"轻描淡写的托付……说，"）剪掉，只留台词。
- 配乐增益对齐 −17.4 LUFS：主曲 emerald_dream 0.7079（原无）、E1 0.7079（原 0.99655）、E7 0.5821（原 0.65539）、E4 0.7328（原 0.65917）。
- 环境音：番外二结尾 #3298–#3314（浅滩·上午）室内风铃 → 潮声 0.8 + 海鸥 0.25。
- 音效：#3273"拍床。两下。"补第二下（450 ms）；tail_* 七个尾巴短声播放副本峰值对齐到约 −3 dBTP（原件 content/assets/audio/sfx/tail/clips/ 不动）。
- 界面：触屏设备不显示悬停提示（原来点完按钮提示会粘在画面上）；控制栏文字加阴影，亮场景可读。
- 背景时段（第七个提交）：#1115–#1120「夕阳沉下去之前」沙洲_午后 → 沙洲_黄昏（与 #1121 接上）；#489–#504「她先爬上礁石」起 海面_黄昏 → 礁石_黄昏。
- 背景时段（第八个提交）：#1617–#1622「我已经躺下了……我冲出院子」浅滩_夜 → 卧室_夜（#1623 起回到浅滩_夜）；番外二 #3302–#3314「晚上，她的批注来了」浅滩_上午 → 帐篷内_夜，环境音换帐篷海风（配乐未动）。
- 文档：`docs/production.md#content-backlog` 更新（10-18 已补的 5 处移到"已有"）。

#### 待办（需负责人/文案定）
见 `docs/production.md#content-backlog` 第八节。

<a id="source-030"></a>

## agent接手与CG暂停记录

原文档：`docs/collab/work-ledger/agent-handoff-cg-pause.md`；整理前 SHA-256：`a404018b3e30abf2df930a92b4594f75bac00b7b5c177a453ea50422b4a91915`。

**2026-10-17后续交付：** 原先仅本地的407份素材/运行内容已纳入`fix/character-performance`补齐资源提交`f7f6c92`，见[入库记录](<sources.md#source-046>)。下文“仅文档、未上传”为当时历史状态；CG暂停、C27退选保持有效。

- 日期：2026-10-17；执行：Codex。用户要求弃用当前图、先不做CG，并写好交接给其他agent。
- 接续入口：[接手说明](<migration.md#history>)。它优先于旧制作顺序、候选审图意见和生图计划；其余采用CG保留。
- 仓库/分支：`Liyang1145/galLingS` / `fix/character-performance`；交接前本地及远端HEAD均为`f55cf0e6989726dd56521cecbc286a542dee4d27`，远端main为`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`。
- 窄范围撤出：C27全退选；从4句恢复装配前bg/sprites：`utu1zxyd`、`ab6i4shm`、`3iq8cnx2`、`i99npm13`。不改其他剧情字段、105音频或现有音乐。原件留档、开发库退选、现用图库不显示。
- 本地记录：`content/assets/art-upgrade/cg-pause-handoff.json`、审核/制作/运行清单与game.js；仅本地，未随本次文档提交。原采用记录保留历史并加后继指向，防机械重放。
- 导出：图库118个视觉ID/116张不同图；单文件178,225,697字节、3315句、223实际资产ID；其他3个既有试玩副本同步同一单文件。开发库515项/692文件，C27相关7项退选/使用0。
- 本次验证：故事/音频资产字段保留；原3308 ID、3315节点、M1/E4共138句及6处SFX通过；文件夹/单文件8次目标节点核对、离线118视觉解码、图库无C27、浏览器错误0。证据在仓库外`outputs/agent-handoff/withdrawal-validation.json`。旧18演出/50场景/13音效画面验证保持历史身份，不冒充撤出后全季重测。
- 接口：CG暂停后没有新调用。旧网关/Rinko测试均退选；凭据没有写入交接。图片尺寸/请求模型不能证明实际最高质量路由。
- 文档发布范围：本记录、接手说明、[本地文件清单](<collab/handoff/local-pending-files.json>)、更新的AGENTS/待办/最新游玩及两份历史说明和前次同步记录。**不上传本轮新图片、运行代码、音效调度、原始包或单文件HTML；不合main。**
- 文件保护：提交前按清单保存本轮其余397个本地文件的SHA和大小；提交后再核对文件、暂存区与远端分支。清单不包含本次发布文档自身；它不能替代文件本体交付。
- 提交定位：在本分支查找提交标题`docs: hand off current work and pause CG production`；回读`git ls-remote origin refs/heads/fix/character-performance`确认。文档中的f55为交接前基线；最终发布回执保存在本机`outputs/agent-handoff/publication-verification.json`，避免把文档提交误认成素材上传。
- 后续：当前停在交接，不按旧53项顺序自动开始制作。由接手agent读取用户新任务并在小范围内继续，待办保留未完成事实。

<a id="source-031"></a>

## 图片验收修改（2026-10-18 晚，用户验收通过）

原文档：`docs/collab/work-ledger/art-acceptance-20261018.md`；整理前 SHA-256：`a213283bfe4883b7444cb22a144bee1fcf668918c5a4ce1e955a7eb29fcc14a0`。

- C09：主角头部局部改为黑发+黑框眼镜（对齐其他 CG）。
- C25：女主改为闭眼（对应“她闭着眼”）。
- C14b：新增 C14 变体，尾鳍放平，只用于 #1825 y2uoutn6“（尾鳍放平了。没有圈，没有拍。）”；新资产 c14flat1。
- L14：补尾根破洞、修尾鳍尖。
- L19：改为水中漂浮、赤脚（深海场景用），整张替换。
- L16/L26/L30/P09/P11/P16/P17：尾鳍上补一个白色新月旋纹（P11、P16 首版落在尾身上，按用户指出改到尾鳍）。
做法：裁局部放大给 Image2.5 编辑，再按差异区合成回原图，其余像素不变。候选与裁切框：工作区 fix9/img/jobs.json。

<a id="source-032"></a>

## 美术一致性与采用清单

原文档：`docs/collab/work-ledger/art-consistency.md`；整理前 SHA-256：`62df22058c07d8cbeb970745ff37f7785cf72e9ddb41165edf58912ecc9a3a7f`。

- 资料来源：用户网页端背景与 Larry 的另一批图；最终美术联系人待确认。
- 状态：草稿探索 / 待集成；初始化记录不代任何成员认领绘图任务。
- 记录时间：2026-10-13。
- 仓库已有11张背景；音乐负责人的本地副本已采用17张，差额素材尚未随迁移发布。
- 当前执行 agent、参考图路径、工作分支、采用清单：接手时补充。

#### 一致性办法

固定角色身份图与住宅/店铺/海岸母图；时段差分沿用空间，CG同时参考人物、服装和场景。现有角色图先保留，先处理高频空间与剧情不准确的关键CG。Image2.5作为主力是建议，未冻结工具，也未验证具体网页端路由。

#### 优先缺口与交叉点

帐篷同一空间的内夜/外黄昏/清晨，双戒指特写，柜台张开手臂与尾巴蓝帆的专门CG。与作品导出素材ID、画面裁切、CSS光照及剧情地点对齐；不为适配缺图擅自改剧情。

<a id="source-033"></a>

## 全量美术素材库与人工微调

原文档：`docs/collab/work-ledger/art-editor-library.md`；整理前 SHA-256：`32715d196a890607ab071f1c3d7a563eeb4a01a8fcf2494653e22771d3a91d35`。

- 负责人 / 执行：音乐负责人 @Liyang1145 授权，Codex执行。
- 状态：已集成、已验证；本变更交付到当前私有仓库（当时仓库为私有；2026-10-16 起已公开）。
- 更新时间：2026-10-14。
- 分支：`feat/art-editor-library`。
- 游戏基线：`34293625f66f7956d6d52d63d57f7b22133f0791`；已核对远端 `f45ec5172adde3d05a409af6506fb763ca8d7b55`，后续差分仅为Atri的music目录交付，合并保留。
- 授权：用户要求“保证所有美术资产都在引擎开发页面可调用”，本次明确要求“素材开发的赶紧弄了推上去”，随后继续。

#### 范围与接口

新增根目录 `引擎开发.html`，通过现有游戏的 `?editor=1` 启用VN Studio编辑模式；原生玩家入口仍读同一游戏。新增素材库、画面数值微调、来源备注、项目保存和可移交导出；209个生产文件合并176项，所有178图像ID可从原生选择器/脚本调用。每页36缩略图，原图按需解码；修正网格行高造成的卡片重叠。

`art-catalog.js` 由Python/Pillow重建；API新增只读 `/art-assets/{path}`，只允许生产素材目录中的PNG/JPEG/WebP，不允许JSON、配置、ZIP或任意本地文件。`libraryPath` 让项目JSON换机器后重新解析素材位置；`artNotes` 保存人工来源/备注。原件、请求模型与后端确认分开登记，未回传实际模型不宣称核实路由。

画面修改沿用引擎撤销、关联开关、角色UID与x/y/h/flip结构；默认单句编辑。浏览器草稿按 `art-editor:作品ID:` 分开保存，不混入玩家存档。加载较旧草稿提示基线；载入仓库最新版先下载项目备份，再重载当前game.js，不隐式覆盖未保存修改。

托管开发页可直接导出含手动微调、样式和音频的真正单文件；文件夹导出共享同一筛选与样式准备。离线编辑保存正常，导出时提示从本地服务进行；CLI新增 `--project` 接受已保存的微调JSON并完整打包。保留原有画廊与音频库，只排除未使用的新增原始素材，避免把整套大原件强行塞进玩家包。

#### 兼容与交叉点

共同提交已授权的 [Atri接入](<sources.md#source-038>) 与 [WAV播放副本](<sources.md#source-075>)。游戏仍为3308节点、18章，既有故事与存档ID不重编号。配乐侧的可选 `playbackGain` 在播放/试听共同应用，缺字段按1；不覆盖作者音频原件。编辑库建立不改变玩家图像、不恢复7张退选CG、不给缺音效补程序音，也不自动重画角色。

关键文件：根目录引擎开发入口；作品index.html、art-editor.js/css、art-catalog.js和缩略图；server/api/app.py；tools下索引/演示/游戏打包脚本；来源CSV、开发说明和本台账；两项API/离线打包测试。个人设置、登录凭据、浏览器草稿和测试微调JSON不提交。

<a id="source-034"></a>

## 剧本美术编排：鉴赏解锁、C14 合并、立绘重排（2026-10-19）

原文档：`docs/collab/work-ledger/art-layout-20261019.md`；整理前 SHA-256：`5611b5f2a326c95e4fdba866c3adc7d4f15749750b3ba4b67bbabcf26a4afcba`。

- 负责人 / 执行 agent：Hark（受 @Liyang1145 委托）
- 状态：已集成到 `fix/character-performance`；全作回归通过；画面听感/观感待用户试玩验收
- 更新时间：2026-10-19
- 任务分支：`fix/character-performance`
- 基线提交：`71e5eb4`
- 交付提交：见本文件所在提交

#### 用户指令（10-19）

1. 「烤鱿鱼已经做进场景了。就把他当场景，不是 CG。剩下的 CG 你看着塞进去」
2. 「C14 合并」
3. 「那一堆立绘，你看着加进去就行。你要重读文本，思考一下怎么放。也许之前也有一些立绘放的不合适。你重新排布就行」
   - 例外：L20 已退选（只用 L19），不加；S02、P05 不动（P05 将由 S02 取代，等用户选版后换图）。

#### 本次目标与影响范围

只改 `content/imports/vnstudio/海风与布丁/game.js` 的 `lines[*].bg`、`lines[*].sprites` 与 6 个资源条目的鉴赏字段（`cg` / `previewExcluded` / `note` / `sceneReserve` / 新增说明字段 `galleryVariantOf`）。没有改任何图片文件、台词、句 ID、选项、变量、音乐、环境音、停奏、转场。写回用 `json.dumps(ensure_ascii=False, separators=(',',':'))`。

#### 一、烤鱿鱼 → 场景

鉴赏里 0 引用的 9 个 CG 位中，烤鱿鱼是 **C03（CG_烤鱿鱼，资源 `akugkagj`）**：帐篷门口小木桌上一盘烤小鱿鱼，无人物。
- C03 改为 `cg:false`，作场景（背景）用：第一话 **#155**「回到帐篷的时候，门口放着一串烤小鱿鱼。」用 C03 远景交代，#156–159 接 O12 近景「还温着」，#160 起 B15A 写日记。
- 同题材的 **O12（门口温热烤小鱿鱼，`art_upgrade_o12`）** 原先 `cg:true`、也在鉴赏里，按同一指令一并改为 `cg:false`（只是不进鉴赏，#156–159 照常显示）。
- 鉴赏 CG 位：36 → 33（去掉 C03、O12、C14b），33 个全部可在剧情中解锁（脚本核对：0 个无引用）。

#### 二、C14 合并

C14b（尾鳍放平，仅 #1825「（尾鳍放平了。没有圈，没有拍。）」用）设 `previewExcluded:true`、`galleryVariantOf:"C14"`。鉴赏只剩 C14 一个位；#1821–1824 C14、#1825 C14b 的剧情显示不变（C14b 作为同一位的差分，玩家先看到 C14 才会到 #1825）。

#### 三、8 张 CG 插入（按画面内容重读剧本选点，CG 期间不叠立绘）

| 节点 | 台词摘要 | 原背景 → 新 | 理由 |
|---|---|---|---|
| #1286–1292 | 我:「……合理。」 | B26 → O08 | 第八话新家院子：她坐上树下的秋千「验收」，台词「算你识相」「施工队效率倒是不错」 |
| #1401–1405 | 她把怀里的铃铛，塞给了我。 | B29 → O09 | 第八话黄昏窗边：她把铃铛塞给我、尾鳍缠上窗框 |
| #1944–1948 | 鲸鱼小姐:「————」 | B37 → O10 | 第十二话撞见已开张的店面，「她脸上的表情，瞬间僵住了」 |
| #1966–1971 | 她走到甜品台，舀了一小勺海盐布丁。 | B41 → O05 | 第十二话后厨甜品台：她验收海盐布丁（甜度、海盐余味） |
| #2182–2186 | 她忽然停住了。 | B24 → O07 | 第十三话珍珠摊：她停在那颗天青色珍珠上，「……这颗，还行。」 |
| #2630–2632 | 挑战周的周四。日记共读。 | B33 → O06 | 第十五话挑战周的周四，早餐桌上日记共读 |
| #2923–2927 | 『她说「守了一上午」的时候，忽然明白了什么，声音低下去——』 | B07 → O11 | 第十六话月下礁石：「尾鳍在月光下，圈起了两个人的影子」 |
| #2977–2981 | 她从口袋里拿出那条银链。 | B07 → O04 | 未通过结局：她拿出坠着天青珍珠的银链却没戴上，「先放本小姐这儿保管」 |

CG 结束后回到原背景与原立绘（#1293 B26 L02、#1406 B34、#1949 B37 L06、#1972 B41 L01、#2187 B24 L06、#2633 B33 L08、#2928 B07 P13、#2982 B07 P16）。O04 在「退潮之后」结局线（好感不足分支 #2960 起），其余 7 张都在主线必经段落。

另：**O02（翡翠之梦店外初秋）** 原是预留场景（sceneReserve），放到第十六话开头 **#2833–2834**「秋天深了。店里的客人开始穿外套。」作开场，#2835 起回 B41 厨房；`sceneReserve` 改为 false。

#### 四、立绘重排

原则：按台词的动作、情绪、服装、场景逐段重读；同一段对话里尽量一张图到底，每次换图要有台词上的理由（动作变化、情绪转折、坐/站变化）。新图沿用原 uid；坐姿统一用 P13 的位置（x 698.97 / y 885.6 / h 850.95）；同场景内换姿态的首句加 `poseSwitch:"soft"`。

##### 新加入的未出场立绘（5 张）
| 节点 | 台词摘要 | 原图 → 新图 | 理由 |
|---|---|---|---|
| #754–762 | 夜深了。 | L08/L07 → L34 | 「她抱着我的笔记本，脑袋一点一点的」：礁石坐姿持本，困倦含糊 |
| #953–956 | 她怀里抱着贝壳山，在阴凉里打了个瞌睡。 | L07 → S01 | 「她怀里抱着贝壳山，在阴凉里打了个瞌睡」：坐姿 |
| #1019–1024 | 她抱着膝盖，看着远处的海。 | L07 → S01 | 「她抱着膝盖，看着远处的海」：坐下，安静 |
| #1115–1124 | 走出碎贝壳区，我们在沙洲边坐下歇脚。夕阳正往海面落。 | L07/L02 → S01 | 「我们在沙洲边坐下歇脚」到「她抱着膝盖的手，慢慢收紧了」：整段坐姿，原来三次换图合成一张 |
| #2706–2712 | 鲸鱼小姐:「————」 | L31 → L32 | 选「你说的考虑一下」：「……下不为例。但是，每天早上」——正装柔和 |
| #2796–2806 | 海滩。她走在我旁边，保持着半米的距离。 | L07/L02 → O03 | 第十五话饭后海滩散步（入秋，开店后第一个秋天之后）：常服加薄外套，整段一张 |
| #2965–2967 | 她把手稿翻回前面，一页一页地点给我看。 | P13 → L34 | 「她把手稿翻回前面，一页一页地点给我看」：坐姿持本 |
| #3285–3297 | 正蹲在帐篷角落，检查那两枚贝壳。 | L28 → L27 | 番外二次日清晨：她摘下项链检查贝壳、随后塞进衣领——项链不在颈上，用无项链睡衣 |

##### 调整不合适的已有排布
| 节点 | 台词摘要 | 原图 → 新图 | 理由 |
|---|---|---|---|
| #394–398 | 第三十米—— | L07 → ∅ | 下潜到三十米「光没了」：常服站姿（穿鞋）出现在水下不合适，先留空 |
| #399–402 | 她拉着我又往下沉了一段。然后，是从海床深处，一点一点亮起来的、蓝色的 | L07 → L19 | 「她拉着我又往下沉了一段」：水下改用潜水立绘，与随后 L19 段连成一段 |
| #130 | 我:「谢谢，很好吃。」 | L06 → L02 | 选「谢谢，很好吃」：她是受用而非慌乱，与下一句「……嗯。算你有品位」合并为一张 |
| #137 | 我:「明天还来。」 | L03 → L06 | 「明天还来」→下一句「不准来！」：提前一句换成慌乱，避免一句一换 |
| #230 | 鲸鱼小姐:「借用一下。本小姐的契约，当然要用最珍贵的纸来写。」 | L02 → L01 | 「借用一下」与前四句同一动作，去掉单句闪换 |
| #1397 | 鲸鱼小姐:「哼。准了。」 | L02 → L03 | 「哼。准了。」与下一句「你是本小姐的例外」同一害羞情绪，合并 |
| #1493 | 鲸鱼小姐:「哼。第十二遍写不完，晚饭的烤鱿鱼就没有你的份。」 | L02 → L04 | 「第十二遍写不完…烤鱿鱼没有你的份」仍是逗弄，延续上一句坏笑，去掉单句闪换 |
| #1564 | 风把这句话吹得很散。 | L11 → P08 | 旁白「风把这句话吹得很散」延续上一句欲言又止，去掉单句闪换 |
| #1667–1670 | 她顿了顿，背对着我，声音被风扯得很薄： | L05 → L12 | 「她顿了顿，背对着我」：夜里逆光剪影段，换成背身剪影（姿态可辨） |
| #1957 | 鲸鱼小姐:「本小姐立刻砸招牌不干了，你负责收拾。」 | L05 → L01 | 「本小姐立刻砸招牌不干了」是叮嘱的延续，去掉单句闪换 |
| #2190 | 鲸鱼小姐:「总之不一样。这颗是这颗，那颗是那颗。」 | L01 → L03 | 「总之不一样…老板，包起来」仍在掩饰害羞，与上一句合并 |
| #2436–2447 | 店里没开灯。她坐在柜台后面，背对着门，在擦贝壳盘。 | L05 → L12 | 「店里没开灯。她坐在柜台后面，背对着门」：原为正面生气，改背侧身冷淡（L12 是站姿，背对优先）；「带鱼，鳃是红的」处再转正面 |
| #2480 | 鲸鱼小姐:「也不准，把我写得又贪吃又凶。」 | L05 → L01 | 「也不准把我写得又贪吃又凶」是立规矩的延续，去掉单句闪换 |
| #2821 | 鲸鱼小姐:「哼。算你识货。」 | L02 → L03 | 「哼。算你识货」与下一句「算你今天还算老实」合并为害羞 |
| #2842 | 鲸鱼小姐:「今天这锅布丁，本小姐亲自验收。」 | L02 → L01 | 「本小姐亲自验收」延续上一句，去掉单句闪换 |

合计：立绘改动 23 处（99 句），其中新加未出场立绘 5 张共 8 处、调整已有排布 15 处。
新加后出场句数：L27 13、L32 7、L34 12、S01 20、O03 11。L20、S02 仍为 0；P05 仍 4 句（#263–266）未动。

##### 检查过、没有改的
- 服装与场景：脚本按服装分组（常服 / 吊带裙 / 女仆 / 睡袍 / 睡衣 / 长裙 / 正装 / 泳装 / 裹毯 / 潜水）逐章查换装点，10 处换装都落在换场景或换日子处，台词也交代了（如 #522「她今天穿了蓝白色的吊带裙」、#2544「睡袍外面罩着围裙」、#3034 泳装在沙洲 B08）；没有泳装进室内的情况。
- #1623–1666 浅滩夜那段立绘是逆光剪影（`look:"shadow"`），表情看不见，只在 #1667「背对着我」换成背身剪影，其余不动。
- 单句闪换：全剧 22 处一句一换，其中有台词动作支撑的保留（如 #122「噎了一下」、#815「先是空白」、#1967 眯眼又「板回去」那处已被 O05 覆盖），无依据的 9 处已合并（见上表）。
- 未处理（不在本次范围）：A33 坐姿与站姿画布比例、L37/L38 画布偏小（A30）。L34、S01 用 P13 同一位置，和 P13 一起看大小一致。

#### 实际验证

- 结构校验（脚本）：3315 节点、全部句 ID / 顺序 / 台词 / 选项 / 跳转 / 变量 / bgm / 环境音 / 音效 / 配音字段与基线逐句一致，差异只在 `bg`、`sprites` 与上述资源字段。
- 全作回归 `tools/check_full_regression.py`（真浏览器）：走完 3315 节点 `nbad: 0`、`nerrs: 0`；CG 首显 33 张全部解码；存读档、回退正常。
- 截图抽查：#155 C03、#756 L34、#954 S01、#1116 S01、#2797 O03、#2707 L32、#3286 L27、#2966 L34。
- 未做：真人试玩观感验收；单文件试玩包 / APK 未重建（推送后 CI 自动出 APK）。

#### 下一位 agent 的接续点

- S02 取代 P05：等用户选定 S02 尾巴版本后，把 #263–266 的 P05 换成 S02（位置可沿用 P13 坐姿位）。
- 若用户觉得某处 CG 插点不合适，按本表节点改 `bg` 即可；鉴赏是否解锁只看 `isCG` 资源是否被某句 `bg` 引用。

<a id="source-035"></a>

## 美术自查（2026-10-19，@d4c9976）

原文档：`docs/collab/work-ledger/art-selfaudit-20261019.md`；整理前 SHA-256：`98a6743d11bcf0eb3d966f1fd329524bd5735808d8e7188074eb77068deac4d5`。

范围：`content/assets/art-upgrade/runtime/` 全部 141 张（背景 B 44、CG C/O 39、立绘 L/P/S 56、封面 T01）。方法：按类别排总览图逐张看；脚本统计透明度、画布边缘、分辨率；解析 game.js 3315 节点统计每张图实际出场次数和鉴赏解锁。没有改任何图。

#### 一、新发现（按影响排序）

| 编号 | 问题 | 涉及 | 建议 |
|---|---|---|---|
| A31 | 鉴赏里 9 个 CG 位永远解锁不了：资源表登记为 CG，但剧本 0 引用，玩家永远到不了 100% | C03 烤鱿鱼、O04 未通过结局、O05 海盐布丁制作、O06 家庭日记共读、O07 采购天青珍珠、O08 秋千验收、O09 窗前铃铛、O10 开张时僵住、O11 月光尾鳍圈影（朋友版） | 剧情定：接进对应段落，或在资源上标 previewExcluded |
| A32 | 立绘尾巴和 CG 尾巴是两套画法：立绘是深蓝斑驳鳞纹，CG 多是浅蓝光滑胶质、腹面大块白 | 全部 CG vs 全部立绘 | 定一个统一基准（建议以 L01 为准），CG 尾巴逐张局部重绘 |
| A33 | 坐姿/跪姿立绘和站姿用同一画布高度，切换时人物忽大忽小；P05、S02、P11 头部约大 1.2–1.3 倍 | P13–P18、L33、L35、P03、P04、P11、P05、S02 | 按头部大小统一缩放，坐姿下沉到画面下方 |
| A34 | 分辨率不统一：背景几乎全是 1672×941（低于 1080p），CG 混着 1672/2752/3344 三档 | B01–B42（除 B02A、B15A）；C01、C03、C16、C27、O01、O02、O12 | 统一放大到 2752 宽档；低档 CG 优先 |
| A35 | 25 张立绘留有 alpha≤16% 的薄雾和背景散点（4 万–8 万像素），亮背景下可能显灰边 | L04 L08 L10 L11 L12 L23 L26 L27 L29 L30 L31 L33 L34 L35 L36 O03 P02 P04 P05 P08 P10 P11 P16 S01 S02 | 批量清掉 alpha<16% 和孤立散点，只动透明度不动颜色 |
| A36 | L37 尾巴从肩膀高度往左上伸出，看不出接在后腰 | L37（出场 8 次） | 尾根改到腰下 |
| A37 | L38 耳鳍是光滑粉色，其他立绘都是白色波浪边耳鳍；L37、L38 两只袜子一长一短（左过膝、右到膝） | L37、L38 | 局部改耳鳍、袜子统一 |
| A38 | L04 右侧尾鳍下方有一块深色污迹 | L04（86 次） | 局部擦除 |
| A39 | 画布裁边：L26、L28 脚底贴底边；L35 头顶、右侧贴边；P03、P13 左上角有散点 | 同左 | 检查是否裁掉了脚/发梢 |
| A40 | 做了但没出场：B18、B32、L20、L27、L32、L34、S01、S02、C27、O01–O03、O12（O12 作为背景用了 5 次） | 同左 | 剧情决定用不用；L32 刚换了 L01 尾巴但剧本没用 |
| A41 | 近似重复：B21/B22 几乎一样；C14b 与 C14 差别很小却占两个鉴赏位 | 同左 | 合并或拉开差异 |

#### 二、旧待办复核

- 已解决：A26 L19 已是漂浮赤脚版；A27 C09 主角已是黑发戴眼镜；A28 C25 已是闭眼。
- 仍在：A20 C20 尾巴过长像蛇缠手腕；A05 O06/O10 尾根；A07–A11 动作镜头缺口；A12 时段打光；A21 同场景时段差；A22 L14/L15 单片尾鳍；A29 旋纹复核；A30 w/h 与文件不符。

#### 三、优先顺序建议

1. A31 鉴赏解锁（不改图，只需定剧情或标记）。
2. A32 尾巴统一 + A20 C20。
3. A33 立绘比例。
4. A34 分辨率、A35 薄雾（批量，可脚本化）。
5. A36–A39 单张局部。

#### 带批注的对照图

历史生成脚本为 `aud2/ann.py`（原制作沙箱内），12 张已于 10-19 15:50 发给用户。

<a id="source-036"></a>

## Atri 试玩反馈（2026-10-18 晚）与配音清单

原文档：`docs/collab/work-ledger/atri-feedback-vo-20261018.md`；整理前 SHA-256：`d831fdda43aa30e9b5680e520c32f45e7a9529c977be4f781da09a7bc1b6d89e`。

- Atri 的对白账本存 docs/collab/playtest/atri-账本-20261018.json（16 条，全是配音问题）。
- 处理：配音问题都要重录，不改游戏；整理成 docs/collab/playtest/配音清单_重录与补录.csv（993 行）：
  - 重录 13 句：Atri 标出的失真/杂音/音色变化/截断，加 #1769 05ee3el4 剧本已改需重录。
  - 补录 299 句：#1849 以前鲸鱼小姐还没有配音的句子（第七话起变得零散，Atri 说“有的有有的没有”就是这个）。
  - 新录 681 句：#1849 以后鲸鱼小姐全部台词。
- “我”（主角）和旁白按现行设计不配音，所以 #812、#952 的“上一句没语音”指的是前一句鲸鱼小姐的 #811（截断）、#951（缺）。
- 文件命名：序号_任意.mp3，按本清单序号认句（序号→句ID 映射在工作区 vo_todo/seq2id.json）。

<a id="source-037"></a>

## Atri 家居曲接入（2026-10-18 晚）

原文档：`docs/collab/work-ledger/atri-home-cue-20261018.md`；整理前 SHA-256：`1dcfa0a29ea58d64ccaaeb5cd9e2f37938e7ea9c200a71eb8c69d931c4e4fffc`。

依据：音乐负责人原话“我现在翡翠之梦只有一个见面曲，一个沙滩曲。atri那个偏向家居曲。”

改动（只改 `lines[].bgm`，其余字段不动；3315 节点、ID、选择、变量不变）：
| 句号范围 | 句数 | 场景 |
|---|---|---|
| #1269–1317 | 49 | 大房子院子、新家 |
| #1481–1496 | 16 | 书房 |
| #1859–2020 | 162 | 客厅、翡翠之梦厨房 |
| #2042–2107 | 66 | 翡翠之梦店内 |
| #2154–2177 | 24 | 厨房清晨 |
| #2246–2257 | 12 | 翡翠之梦厨房 |
| #2539–2569 | 31 | 厨房清晨 |
| #2626–2726 | 101 | 早餐桌、卧室门口、早安 |
| #2833–2859 | 27 | 翡翠之梦厨房 |
| #3058–3087 | 30 | 店内、餐厅夜 |

合计 518 句改为 `bgm_atri_e3m6m7_v2`（Atri · 家居（E3=M6=M7）），auditionOnly 改为 false；增益沿用 v1.1 对齐值。
《翡翠之梦》保留 315 句：#21–136 初遇浅滩、#200–312 礁石、#2874–2943 季终读稿（礁石夜）、#3282–3297 帐篷尾声。
回归：fix6/reg.py 3315 节点 0 报错。

<a id="source-038"></a>

## Atri 新音乐接入

原文档：`docs/collab/work-ledger/atri-music-assembly.md`；整理前 SHA-256：`8eea56bf2592ede6b45300316e7ae88c6a0f27ee0c53e0f54544744cd997a4b1`。

- 执行：Codex；用户明确要求查看Atri新提交并整合。
- 状态：已集成、已验证；本次与用户明确恢复的素材开发页共同交付。此前暂停不再适用于编辑器，人物重制仍待继续。
- 当前工作区：`feat/art-editor-library`，保留其他未完成修改，不整包覆盖。
- 游戏基线：`34293625f66f7956d6d52d63d57f7b22133f0791`；音乐来源：Atri-Lobato提交，最新整理提交 `f45ec5172adde3d05a409af6506fb763ca8d7b55`。

#### 本次范围

来源是 `content/assets/music/mp3/` 的E1、E2、E7、E6或E5、M6？五份原MP3，以及 `content/assets/music/配乐曲目简要明细、方向指导 Ver. 1.0.md`。四份WAV母带继续由 `content/assets/music/wav/` 保存；作者已经提供对应MP3，不重复转码。当前游戏使用压缩副本，不嵌入WAV。

按作者曲目用途制定显式段落映射：E1仅用于喜剧性傲娇互动，E2用于第三话深海与定情，E7用于带验证/思考性质的段落。普通安静独白不机械套用E7，真实伤痛不套用E1。「E6或E5」先进入候选试听，不擅自把E5与E6混为同一个已定案用途。「M6？」与现用《翡翠之梦》MP3的SHA完全一致，因此记录来源别名与M6/E3/M7共用关系，沿用原主曲ID，不重复装两份。保留音乐负责人选定的《翡翠之梦》，以及第九至十一话和解前已有停奏。

保留全部台词、ID、跳转、环境音和动作声。新增稳定音乐ID、段落映射、原MP3校验及单文件离线试玩；真实听感、循环点仍待人工微调。

#### 实际验证

5份原MP3全量解码及Git blob SHA/字节校验通过；E1/E2/E7进入8个明确段落、245个节点，只改音乐及切换字段。3308节点的原ID、文字、变量、跳转、图像、环境音和动作声均保留；第九至十一话和解前停奏不变。原《翡翠之梦》MP3保留。

播放侧新增可选 `playbackGain`，旧资产缺该字段时按1处理；E2相对现用主曲约低3dB，E7约低2dB，音乐播放器和候选试听共同应用增益，不重新编码作者MP3。后续整合需要保留index.html中这两处音量改动；编辑器有独立 [任务与验证](<sources.md#source-033>)，不把美术制作列为本音乐任务完成项。

实机通过8个段落切换、段内连续播放、停奏、候选试听、关闭试听恢复播放位置、跨曲目存读档与退出停声，无脚本异常。75测试通过、2跳过。M6按SHA去重后最新单文件HTML共77,138,730字节，内嵌197资产，94图像和103音频；去重后的实机与离线验证见 [实机结果](<../A素材库/归档/deliveries/atri-music/验证结果.json>) 及输出目录单文件验证结果。固定段落与字节校验见 [接入清单](<../A素材库/归档/deliveries/atri-music/接入清单.json>)。

原件来自作者已有的 `content/assets/music/mp3/`；下载到本地校验后用于游戏副本。大文件整包fetch曾超时，后续通过部分获取成功核对远端main `f45ec5172adde3d05a409af6506fb763ca8d7b55`，作者后续差分仅music目录，本变更不修改该目录，合并保留全部母带。后续团队提交需同步当前main并保留来源目录，不重写原件。

<a id="source-039"></a>

## 10-19 Atri 界面同步到文件夹版 + 安卓试玩包

原文档：`docs/collab/work-ledger/atri-ui-sync-android-20261019.md`；整理前 SHA-256：`c61a5230e4e55227d165f1658069088da643c8b09df9e31005569de4cebdd7cd`。

#### Atri 改动（来源：release playtest-20261019 单文件 haifeng-pudding-trial-ledger-20261019.html）
与我 10-18 13:03 的单文件构建逐段比对（去掉内嵌素材后），Atri 的实际改动全部在播放器代码/样式，已移植到作品文件夹版：
- 对话回看每句加“回退到这里”：恢复到该句开始前的变量、回看记录和剧情位置（`goBackToHistory`，回看条目记 `h` = 历史下标）。
- 设置里加“对话框不透明度”滑条（35%–95%，`--ghost`），游戏内对话框 `#pdlg` 同样受控。
- 游戏内设置面板“海底刻度”样式：滑条填充进度、右侧显示数值（%、ms、×），触屏按钮 ≥44px。
- 未采纳：Atri 底稿比现行版旧，他那份里没有 10-18 审查加的“触屏不显示悬停提示 / 控制栏字影”，也没有音乐增益 playbackGain——这些是底稿差异，不是他的删改，保留现行版。
- 另补：滑条与数值同一行（`.control` 布局，Atri 原稿没有这条样式）。
- 验证：fix6/reg.py 3315 节点 0 报错；浏览器实测回退到第 3 句后 RT.idx 8→5、回看 6→3，无页面报错。

#### 安卓试玩包（mobile/）
- `mobile/android/`：WebView 外壳（WebViewAssetLoader 以 https://appassets.androidplatform.net 读 assets/game/，存档用 localStorage 照常保存）；全屏沉浸、常亮、返回键先关弹出层、连按两次退出。调试签名，仅供试玩。
- `mobile/host.js`：只在 APK 注入。游戏设置首行“屏幕方向：横屏 / 竖屏 / 跟随旋转”，即时生效并记住；竖屏/跟随时直接用游戏自带竖屏排版。
- `mobile/prepare_assets.py`：复制作品文件夹，宽于 1920 的图缩到 1920（文件名不变），不带编辑器脚本，封面裁图标。
- `.github/workflows/android.yml`：推到 fix/character-performance（mobile/ 或作品文件夹有改动）或手动触发 → APK 上传到 Artifacts，并更新预发布 `android-playtest` 的附件。

#### 10-19 14:20 补：手机上 Atri 滑条变粗色块
- 现象（用户反馈“APK 没有 Atri 新 UI”）：APK 里其实有回退、不透明度和新设置，但触屏下旧规则把滑条加高到 36～56px，Atri 的进度渐变铺满整个高度，看起来是粗色块，不像“海底刻度”；横屏小舞台下手柄和数值也缩得很小。
- 修：`game-polish.css` 末尾加一段，轨道只画 4px（横屏小舞台 8px）细线，点按区域仍加高；触屏手柄 24px（横屏小舞台 40px）、数值放大。Atri 单文件原稿同样有这个问题（他在桌面验证）。
- 验证：手机横屏 800×360、竖屏 360×780 截图；全作回归 3315 节点 nbad 0 / nerrs 0。

<a id="source-040"></a>

## 音乐与音效接入

原文档：`docs/collab/work-ledger/audio-integration.md`；整理前 SHA-256：`cccb1c9af17c53793df5e77f51c53e545be66a8661872210ab0b098ef1e9da54`。

- 音乐负责人：@Liyang1145。音效制作方的 GitHub 联系人待补。
- 状态：待依赖 / 本地探索；作者最新完整包现已交付，等待按新包核对正式音乐接入。
- 记录时间：2026-10-13。
- 仓库证据：[音乐方向](<production.md#content-backlog>)、音乐元数据（历史位置 `content/audio/manifest.yaml`）。
- 当前新任务执行 agent、工作分支：接手时补充，不把本记录当成已认领任务。

#### 已有成果

《翡翠之梦》原 MP3已归档；两首主曲先成立，再做变奏。旧本地包接入17张背景和47份试听音频；尾巴更新保留11份原件、制作13份播放副本。上述本地整合未发布成正式DEMO。

#### 兼容交叉点

与 Larry 的实际 `prefs()`、播放生命周期、剧情ID和存读档对齐。音乐逐句不断开；环境单独音量；单次动作按实际材质配置。A04仅试听，表情/否定/比喻不机械配拍水声；缺动作素材先留白。

#### 待补 / 验收

《深海之光》及情绪变奏，翻页、湿沙/石板脚步、轻开门、勺碗、煎锅。最新包映射、接入提交和循环点待填。解码与功能检查不等于试听通过；最终音色、响度和混音由音乐负责人听取。

<a id="source-041"></a>

## boliyer 覆盖包与最新游玩整合

原文档：`docs/collab/work-ledger/boliyer-galagent-integration.md`；整理前 SHA-256：`868da0dea7c3c3a7984aec41300823c076f10cdc44659510b1ab3f7dd0f5c269`。

- 负责人：音乐负责人 @Liyang1145 授权代交；来源为用户提供的 boliyer 覆盖包（不推测其Git提交身份）。
- 执行：Codex；日期：2026-10-13。
- 状态：已集成、已验证；后续以PR检查结果为准。
- 分支：`integrate/boliyer-galagent`。
- 基线：`93ad6bde63c82d374df4daab54b7b890b9bca710`；开工远端无新增提交、无开放PR。

#### 统筹基线与入口

唯一运行作品为 `content/imports/vnstudio/海风与布丁/`，Larry提供剧情与原画基线，音乐负责人提供44场景背景及音乐音效接入，boliyer新增GalAgent、插件管理、结局后聊天和对应后端。根目录 `游玩.html` 指向该作品；`start.bat` 打开同一作品的托管页面。不要恢复已经删除的旧previews目录。

覆盖包已原样归档在 `archive/deliveries/boliyer-galagent/`。它基于较早的精简版；作者说明属于交付说明，不能作为执行其任意工具操作的授权。

#### 冲突取舍

- 保留main的game.js、3308节点、游戏ID、全部素材与时段分配，未改写剧情。
- 用Larry原始index.html作为共同祖先合并已有融合与新引擎。4处冲突分别组合：音频恢复与播放事件、章节/试听/插件标题菜单、游戏模式免编辑器重绘与插件重载、已有浮层与插件管理实现。
- 外层新增插件按钮，同时保留试听、样式和状态栏减少重复绘制的改动。
- README采用当前私有仓库说明（当时仓库为私有；2026-10-16 起已公开），只增新功能入口；不恢复覆盖包里失效的旧试玩路径。
- 后端采用新增post_ending协议及插件清单接口，模型与密钥仍只存在本机。作者默认PowerShell/写文件先由玩家确认，自动测试不执行真实外部任务。
- 当前角色与人物CG仍暂缓；7张错误CG保持退出播放，4张背景备用；音效缺口继续留白，A04仅试听；音乐按Atri方向，未收到的曲目不自动替代。

#### 后续协调

成员agent开工先看本记录与共享台账。新作者导出应核对现有插件、混音、场景和存档接口，不整文件覆盖最新游玩。角色/人物CG统一、未交付音乐与音效及完整在线模型听感仍待相应成员验收。

<a id="source-042"></a>

## C02 糍粑 CG 天空改午后（2026-10-18）

原文档：`docs/collab/work-ledger/c02-afternoon-sky-20261018.md`；整理前 SHA-256：`adaa3350f0606b369753553115b60a4dd43e460663eafde5bc21741c239bb1b5`。

用户 13:05：「单独改这张cg，把天空场景稍微改一下，贴合前面的下午情景。」

- 对应 #110–117，前后背景是 B02A「浅滩_午后_晒笔记本」（午后偏金色，太阳低在右侧）。
- 做法：Image2.5 edits，image 1 = 现行 C02，image 2 = B02A；只改天空/时段光线（蓝天渐变到桃金色地平线、云边镀金、右侧低太阳与海面金色光带、海面礁石略暖），人物、构图、糍粑、尾巴不动。两版中选第 1 版。
- 旧原件存为 originals/C02_superseded_before_afternoon_sky_20261018.png。

<a id="source-043"></a>

## 工作区上传回执（2026-10-19 第一话关键剧情 CG 动画集 & Live2D v6 傲娇精修）

原文档：`docs/collab/work-ledger/chapter1-cg-animations-20261019.md`；整理前 SHA-256：`4011750cc55628be159ca1a7740a8fbd057c0b1eb978654b7c41f80f10a89d07`。

日期：2026-10-19，Asia/Shanghai。

- 仓库地址：<https://github.com/Liyang1145/galLingS>
- 主分支动画资产目录：`content/assets/cg-animations/chapter1/`
- 独立工作区快照分支目录：`contributions/galgame-demo-20261012/output/chapter1-cg-animations/`

---

#### 本次更新内容（2026-10-19 · 第一话关键剧情 CG 动画集）

1. **云端 `MiniMax-H3` 原生生成全章 8 支关键剧情 CG 动画（1344×768 · 24fps · 5.17s · 立体声口型同步配音与海浪音效）**：
   - 使用 Google Colab（`NVIDIA RTX PRO 6000 Blackwell` 96GB 显存）运行 `MiniMax-H3`（`minimax_h3_fl2va_pruned_int8_convrot` + `qwen3vl_32b_minimax_h3_nvfp4_awq` + `8-step Turbo LoRA`）全量原生生成。
   - 彻底废弃旧版基于 `cv2.remap` 的本地网格正弦扭曲脚本，完全消除画面旋转与眩晕感。
2. **100% 对齐 `Liyang1145/galLingS` 官方第一话美术参考**：
   - `CG01_noon_tail_slap.mp4`：基于官方 `C01.png`（正午浅滩接住飞起的湿画本 + 鲸尾拍起浪花 + 「唔！你摸哪里呢，流氓！」）。
   - `CG02_noon_debut_tail_sail.mp4`：基于官方 `B02.png` + `L02.png` → `L05.png`（从单手叉腰高扬鲸尾过渡到双手叉腰拍水立威 + 「人类，你刚才摸的是本小姐的尾巴尖？尾巴尖也不行！」）。
   - `CG03_noon_notebook_ultimatum.mp4`：基于官方 `B02.png` + `P02.png` → `L04.png`（高举画本逼问后放下手臂得意比耶 + 「那你说，是本小姐的尾巴重要，还是你的本子重要？哼哼，算你还有点眼光！」）。
   - `CG04_noon_ankles_honest_tail.mp4`：基于官方 `C27.png`（首尾帧锁定全身双人构图，浅水里蓝白鲸尾勾住男主右脚踝护送回岸 + 「谁救你了！本小姐只是路过，顺便！看什么看，那是海流，懂不懂！」）。
   - `CG05_afternoon_reef_seagull.mp4`：基于官方 `CG_DRY.png` + `B02A.png` + `P14.png`（午后礁石上摊开的笔记本随海风翻页，右侧浅水中鲸鱼小姐抱臂偷瞄 + 「喂，你那个本子里，记的都是什么？」）。
   - `CG06_afternoon_mochi_ear_fins.mp4`：基于官方 `C02.png`（午后礁石分食拉丝红糖糍粑，脸颊羞红、耳鳍微竖 + 「是、是外婆做的！跟本小姐一点关系都没有！」）。
   - `CG07_golden_osmanthus_dive.mp4`：基于官方 `B03.png` + 夕阳染光 `P09.png`（漫天晚霞海浪中背身回眸 + 「随便你……酸梅汤里，要加桂花！」）。
   - `CG08_dusk_camp_squid_diary.mp4`：基于官方 `O12.png` / `C03.png`（暮色帐篷木踏板上一串烤小鱿鱼袅袅升起白色热气 + 温暖钢琴弦乐与黄昏海浪）。
3. **配套预览与清单**：
   - `output/chapter1-cg-animations/index.html`：交互式剧场预览页（支持一键按剧情顺序连播 `CG01 → CG08`）。
   - `output/chapter1-cg-animations/manifest.json`：结构化镜头与配音清单。
   - `output/chapter1-cg-animations/contact_sheet.jpg`：全 8 支视频 8×5 时间轴抽帧核验总表。

---

#### 历史更新内容（2026-10-16 · Live2D v6 傲娇精修完成版）

1. **面部五官比例、眼睑、鼻点与下颌线重构（`Face_Static_v4`, `Warp10`, `Warp12`）**：
   - 修复前任模型留下的下颌平底与尖角、鼻点过高过宽、上眼睑塌陷无神、嘴部偏位及前发阴影过重问题。
   - 鼻三角向内收窄约 48% 并下移对准双眸下方黄金比例点，下颊采用柔和二次元圆润弧线收拢至小圆下巴。
   - 重建双眼 `6×10` 弯曲变形网格（`Warp10` / `Warp12`），消除压眼感，恢复明亮有神的蓝宝石大眼。
2. **傲娇（Tsundere）性格全套表情与动态参数绑定**：
   - 嘴形 `ParamMouthForm`（`Warp15`）：支持 `-1.0` 傲娇 `へ` 字撇嘴、`0.0` 自然上扬微笑、`+1.0` 开心露笑。
   - 张口 `ParamMouthOpenY`（`MouthOpen_v6`）：开口纵向行程增强至 `3.1x`，清晰呈现高精口腔、小虎牙与舌面。
   - 双眉角度 `ParamBrowLAngle` / `ParamBrowRAngle`（`Rotation15` / `Rotation16`）：行程扩展至 `±14°`，支持傲娇蹙眉（`\ /`）与害羞八字眉（`/ \`）。
   - 头部俯仰与偏头（`ParamAngleY` / `ParamAngleZ`）：支持大幅度傲娇歪头斜睨与低头脸红姿态。
3. **工程保存与 Runtime 导出**：
   - 权威 Cubism 工程文件：`output/whale-girl-live2d-base/whale-girl-body-x-wip-v6.cmo3` 及 `whale-girl-face-refinement-v6.cmo3`。
   - 导出 Runtime 模型：`output/whale-girl-live2d-base/runtime-test-v6-body-x-wip/whale-girl-v6-body-x-wip.moc3`（122,688 字节）及 `runtime-test-v6/whale-girl-v6.moc3`。
4. **Live2D 实时互动预览器（`output/whale-girl-live2d-base/live2d-viewer/`）**：
   - 内置基于 Cubism SDK 5 WebGL 的 60 FPS 实时互动预览器与一键启动脚本 `启动鲸鱼小姐Live2D互动预览.cmd`。
5. **渲染验收图集**：
   - 见 `output/whale-girl-live2d-base/previews-v6-final/`。

<a id="source-044"></a>

## 角色演出精修

原文档：`docs/collab/work-ledger/character-direction.md`；整理前 SHA-256：`cbfbc6c6cd9f5eb1ec09cd85b06ea293adee2408b037deaa89d3ccccc7fe72fb`。

- 执行：Codex；用户2026-10-15要求“不只是补全，更要超越，精心打磨”。
- 状态：本地装配与验证完成；保留明确人工缺口，未发布版本或推送。
- 分支：`fix/character-performance`；基线`c9f0be4`，远端main仍为`0f6de47`（已查询）。
- 影响：作品game.js/index.html、美术原图/运行副本/开发索引、演出工具与审核证据。
- 兼容：保留3315个节点ID、文案、选择/变量/音频；新增演出信息只影响画面。泳装L17/L18/C23仍待人工，不重新请求已被拦截姿势。

#### 本轮取舍

第一轮修复恢复了姿势差异，但还不能证明角色表演可信。本轮重点把开场“戒备—好奇—关心—嘴硬”做成有层次的反应，并加强写诗、夜谈、冲突和救援的关键动作。避免得意V手势出现在真正生气的台词，避免初遇就使用亲密笑容；审查眼睛朝向、手中道具、角色远近与脸部取景连续性。

新增素材只在实际适合的台词使用，不按关键词全局机械换图。动作保持短促、有动机，重要停顿让玩家自行推进，不自动拖慢每一句。手势不被对话框遮住，同一情绪跨几句稳定保持；转身离开给出过渡。剧本与音乐由现有负责人保持原样。

#### 验收要求

关键片段按实际选择路径游玩、录制短片并逐帧看切换；桌面/较小窗口检查脸部、手势、选项遮挡。单文件、开发页调用、撤销、存读档和快进应继续正常；加特效前后测帧时间，不增加无意义的持续动画或程序化音效。保留人工缺口与未达标图片，不把完成数量当成审美验收。

#### 用户指出的坐姿结构退步

用户指出P15–P18大腿结构异常、P16裙子出错。重新放大全身确认：这组沿用P13/L34的交腿骨架，胯部至膝部的转折与前后遮挡不清；P16还有手下方皮肤穿出裙摆的破口、裙褶拼接，以及尾部多余轮廓。前一次只因上半身手势与面部清楚而通过审核，不成立，已撤销。

P05、P13、P15–P18及L34暂列退选，保留`*_rejected_anatomy`原件；受影响81节点暂撤下这些候选，未发布这种临时无立绘状态。新坐姿母图从站姿L01的身份/服饰参考重新建立并膝坐姿，不能继续要求“保持错误腿部不变”。先逐一检查骨盆、两段大腿、两个膝盖、小腿与脚的连接，再检查不破损的连续裙摆、双白线和手部遮挡关系，最后检查尾巴只结束于一对尾鳍。母图不通过就不继续批量派生。

#### 返工后装配结果

S01重新建立并膝坐姿，S02重新建立写诗跪坐。P13/P15/P16/P17、L34均从正确母图重画，已按全身、手裙交界和膝腿局部分别复核；P16原来的裙摆破口与额外尾部轮廓已去掉。P05是已审核S02的逐字节副本，P18是无戒指S01的逐字节副本，不冒充两次独立生成。C08使用S02与B04月夜海岸重新构图，写诗不再使用托腮阅读的手势。此前临时撤下的81节点已恢复为新图，`seatedReworkPending`已移除。

P16仍漏画左手小天青珍珠戒指。对现有正确坐姿的局部补画被生图接口安全系统拒绝，没有新输出，未重试或改服装规避。继续保留已生成的完整坐姿，将戒指列为人工微调，见`content/assets/art-upgrade/detail-limitations.json`。不可把它说成全细节定稿。

第一轮基础修复之上，本轮增加P05–P18十四项动作资源及两张结构母图，重画C08；132项审核素材可装配/调用，实际播放117个视觉ID中115个采用新图、2个原泳装照用户决定等待人工。开发库470项/641文件，新旧原件与退选图均可调用。请求仍为订阅OAuth桥的`gpt-image-2.5-flare/max`；本轮立绘实际1024×1536、CG1672×941、medium，模型未回传，未核实路线或最高档。

#### 演出与接口变化

37组明确台词分镜涵盖冷怒、翻本检查、糍粑偷看、审慎好奇、回望、夜谈抱膝与分毯、电话由担心转为受伤、救援后的认真聆听，以及两条结局都保持坐姿并保留害羞/得意/嗔怪。2166处立绘取景按源图眼位与必要的头部尺寸校准，SHA绑定的人工标注在`acting-frames.json`；重新生成后不能沿用旧图坐标而不重审。

播放器新增最多6张立绘的按需解码缓存，每次最多预备随后8句中的3种姿势。新图准备好后才替换，旧异步请求有序号失效检查，避免快速点击覆盖当前角色。少数`sprites.poseSwitch='soft'`使用140毫秒淡接，其余用直接切换；没有给所有台词增加晃动。只在5张关键CG的`assets.shot`设置一次性2%–2.5%缓推，结束后释放动画与`will-change`，换场清理，减少动态偏好下禁用。没有新音效。

美术编辑页与完整HTML/JSON项目保留上述可选字段。角色位置/高度仍是原生数值，可直接人工调整；`actingEyes`仅供审核，不在运行时自动覆盖人工位置。原生纯文本剧本导出不完整保留`shot`/`poseSwitch`元信息，交接精修画面应使用项目JSON或完整游戏，不宣称纯文本往返无损。

#### 已完成验证

- `tools/verify_art_upgrade.py`：3315个节点ID/顺序、文案、分支、变量和音频字段与此前基线一致，103音频资产未改；采用图审核与SHA一致，已禁止临时空立绘稿通过。
- `tools/check_character_direction.py`：18关键片段截图与录屏；3条首话路径各经过4个选择点并进入第二话；1440×900与960×540的4处选项均不挡脸。
- 人为延迟解码后连换3个姿势，只保留最新一个角色，无残影遗留，缓存不超过6；CG跨台词不重复起镜，结束与换场正确清理；减少动态设置通过。
- 本地无网络单文件约157MB，启动约1.70秒，117图像全部解码；470项开发资源注册、P16插入与撤销通过；浏览器无脚本错误。
- 全部85项测试通过、2跳过。未穷举全剧分支，也不把无头浏览器截图通过视为团队的最终审美验收。音频此次未改，沿用上一轮103音频解码与实际播放验证，未声称重新听完全部音乐。

审核原件、当前校验及前后图保存在`archive/deliveries/character-direction/`。本地`outputs/character-direction/海风与布丁_演出精修试玩.html`为新单文件，常用单文件和上一轮修正版路径也同步更新。源资源均可从根目录`引擎开发.html`调用；未推送。

仍缺：P16戒指人工补画；原定泳装L17/L18/C23；其他衣装的身体差分及真正尾巴逐帧。S01坐姿是探索稿的新结构，团队仍可按全身原件继续人工画修，不能恢复退选交腿母图。

<a id="source-045"></a>

## 角色动作与演出退步修正

原文档：`docs/collab/work-ledger/character-performance.md`；整理前 SHA-256：`0eafa7c0d0c4d926cf39234f39d691e4176cedde6015b99a01aaccdd00e1deeb`。

- 执行：Codex；2026-10-15用户试玩反馈“角色动作太少，还不如之前”。
- 状态：本地修正与单文件已完成，未推送；2026-10-15复核。
- 基线：PR #7合并 `0f6de470e5ef1b96c0dfe91605c913f15251c0b9`。
- 分支：`fix/character-performance`。

#### 已核实原因

旧常服得意、害羞、坏笑、柔和的身体与手势明显不同。上一轮请求过度强调“只改表情、保持身体不动”，导致新版四项基本同姿态，脸部小变化也不够醒目。文件存在和能播放不能证明演出合格。另有认真验收、低落、救援红眼、背身、裹毯、坐姿、外套系腰等新图仅登记备用，没有充分按剧情接入。原有整人跳动/发抖指令数量并未明显减少，不用给所有台词增加晃动来掩盖姿态不足。

本轮重做明确可见的肢体姿态，补抱臂监视，按明确台词/节点安排已有差分。新扩展立绘要有稳定角色标识，避免名称变化导致旧角色淡出、新角色重入或动作查找失败。剧情、好感、尾鳍计数、音频和存档ID保留；泳装三项仍按用户决定留待人工。

#### 本地完成内容

重做L02得意扶胸叉腰、L03侧身害羞、L04坏笑V手势、L06双手慌乱、L07合手柔和；新增P01抱臂监视、P02举高笔记本、P03裹毯夜谈怔住、P04握毯探身生气。L34已睁眼，L10去除误画的身体擦伤。修改前PNG与生成回传保留为`*_before_performance`，未删除旧成果。

按明确台词使用抱臂、举书、背身、裹毯夜谈、情绪受伤、救援后红眼、认真检查及女仆外套系腰；具体记录在`content/assets/art-upgrade/performance-cues.json`。按新版宽构图重新取景，让上半身手势露在对话框上方；下午先保持三米监视距离，再改变位置与尺寸表示靠近。新增探身、怔住/退缩、坐稳三种一次性动作，原跳动/发抖/点头仍保留。

所有新差分明确归属同一个“鲸鱼小姐”，播放时复用同一角色元素，聚焦与动作查找也随之正确。换表情不再触发整个场景淡出；场景切换仍淡出，清除上一句残留的震屏/缩放标记，避免覆盖后续转场。去掉新开场两句从前句继承的重复打击效果。没有新增循环晃动或音效。

开发页433项/583文件均已注册可调用，P02实测添加和撤销成功。库保留原始PNG、运行WebP、旧图和退选图；玩家单文件只带104个实际使用的视觉资产及103个既有音频资产。新图仍通过Codex OAuth桥请求`gpt-image-2.5-flare/max`，实际1024×1536、medium，后端模型未回传，不能声称路由或最高档已确认。

#### 已做验证与边界

- 14处实机画面逐图检查，包括监视、靠近、举书、夜谈两种反应、退缩背身、救援、系外套。手势、眉眼、角色位置可读；切换后只保留1个角色，无重复叠人。
- 换姿势复用同一元素，背景淡出次数为0；换场景的背景/角色层均正常淡出；旧震屏标记不残留。
- 无网络单文件启动约1.44秒，104图像及103音频全部解码，角色曲实际播放，第一选择B好感-10正常。
- 剧情3315个节点ID/顺序、文案、分支、变量、音频与PR #7逐字段比对保持一致；原103音频元数据不变。85项测试通过、2跳过。
- 审核证据和原运行稿在`archive/deliveries/character-performance/`。这次是局部演出返工，未穷举整部游戏所有分支，不能称全游戏审美终审。

仍需接续：写诗段L34/C08是持书坐姿，缺真正握笔写字；尾巴拍水与转身仍主要靠静态差分和位移，未制作逐帧尾巴动画；第十六话戒指手部近景沿用已有CG；其余服饰的身体差分仍少于常服。L17/L18/C23泳装三项继续按用户决定留待人工，不使用保守候选顶替。

本地试玩：`outputs/character-performance/海风与布丁_角色演出修正版.html`；常用`outputs/gal-single-file/海风与布丁_单文件游玩.html`也已更新，两者均来自当前同一作品。未命名发行版本，未推送或合并远端。

<a id="source-046"></a>

## 补齐包内容入分支

原文档：`docs/collab/work-ledger/completion-package-publication.md`；整理前 SHA-256：`d1a29d86c5884733aeed67c88d4de94cd534f0f490cacd81da6a697f8cd471b1`。

- 日期：2026-10-17；执行：Codex。用户明确要求：“把那个压缩包补充发到github分支”。
- 分支：`fix/character-performance`；开工本地/远端基线`e70b3caf4e2fd977c0be784b424e18ff360c9f1e`；main为`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`，不合并main，不强推，不编发行版本号。
- 范围：按仓库原目录纳入ZIP的407份完整文件（257新增、150更新），资源提交`f7f6c92bcb0889bd6b7f7ca480816ce446e68e63`；另补[音效缺失清单](<production.md#content-backlog>)与本次发布状态说明。
- ZIP来源：`海风与布丁_本地补齐交接包.zip`，423,156,148字节，SHA256 `58b5369ddba4a6d4f19b4aa6ec295e41e6b0511eabeef0cd38275f179e57fdd1`。其文件清单见[原包清单](<collab/handoff/completion-package-manifest.json>)。本次提交包内文件，不把423MB压缩归档重复塞进Git；原ZIP在本机outputs保留。
- 兼容：game.js SHA保持`fbe54379d81ce6663e0b4264282f2676d8c9aa38bbcba189acbffab65bf0bd3b`；3315节点、原3308句ID、105音频、M1/E4共138句与六处SFX保持。音频未重编码；最早《翡翠之梦》定义见面曲，主曲另定，ID和现有播放位置暂保留。
- 美术：19张队友精修及开场修正、O12、原件/退选档案、运行WebP和开发库索引全部随包入分支。全部CG仍暂停；C27全退选，4句已撤出，开发库相关7项使用0。不得因素材上传恢复生图或退选图。
- 校验：407份工作区文件在提交前与ZIP清单SHA逐一一致；资源提交内407项全部比对。Git常规文本CRLF/LF归一化单独记录，原图片和受`-text`保护的game.js逐字节一致；未为格式检查改动原件。
- 依赖：基线＋补齐文件覆盖全部243条游戏资源路径、1207条开发库去重文件路径、220条来源证据；无缺失。当前开发库515项/692图像文件，现用118视觉ID合并116张图。当前撤出验证见[验证证据](<collab/handoff/withdrawal-validation.json>)。
- 定向校验：`tools/verify_art_upgrade.py`再次通过；原103音频保留、总105音频、运行无WAV，仅两张泳装立绘为既定人工例外。既有与当前game SHA匹配的离线118视觉解码/8处撤出检查/零浏览器错误沿用，不声称重做全季人工听审或审美终验。
- 凭据与范围：本次文本已检查凭据模式；不含密钥、个人配置、存档、.git、网关原始响应、外部测试图或巨大单文件HTML。TTS此前仅检索公开服务，无TTS代码或音频纳入本次。
- 推送验证：发布后回读同分支SHA，逐个比对远端Git blob，确认main未被本任务改动。精确回执保存在本机`outputs/agent-handoff-package/branch-publication-verification.json`。本记录中的资源提交不是最后一笔文档提交，接续检出该分支最新提交即可。
- 接手方式：此后完整获取本分支即可拿到本次运行文件与来源材料，不再需要手动补407文件。旧f55/e70“只文档、本地未上传”是历史状态；[本地待交付旧快照](<collab/handoff/local-pending-files.json>)保留作来源核对，不表示现在仍有397项未交付。

<a id="source-047"></a>

## 仅当前使用图片的图库

原文档：`docs/collab/work-ledger/current-art-gallery.md`；整理前 SHA-256：`09a69fa6b067201c3e9be6cca0b3fecf8a359a347c3d04aa52c74300bb25bbbd`。

- 执行：Codex；用户要求“当前的图库，不展现那些不用的”。
- 分支：`fix/character-performance`；基线`f092777`，开工工作区干净。
- 范围：新建只读图库导出工具和本地单HTML；不改游戏、开发页、采用状态或美术原件，不推送。
- 取数：仅当前game.js封面，以及3315句的背景和立绘引用；按播放图片SHA去重。未引用的备用图、退选稿、母版副本、旧图库不进入HTML或清单。
- 当前核对：118个播放图像ID、116张唯一图片（相同背景图被三个ID复用）；包含封面、场景、立绘和CG。两张仍在播放的原泳装按此前人工处理决定保留，已标明“现用图·待人工统一”，不能因其模型来源不同而从现用图库中隐瞒。
- 功能：按类型、章节和关键词筛选，点开原尺寸大图、键盘切换、下载当前图片；所有图片内嵌，可脱离仓库离线浏览。卡片用小缩略图，大图仅在查看时解码；下载为当前播放文件的原始字节。

#### 已完成（2026-10-16，本地）

- 116张唯一图片：封面1、场景40、立绘50、CG25；只收当前播放文件，不收PNG母版、未引用备用、历史退选和旧图库。118个ID的引用集合与导出清单精确相等。
- 文件：`outputs/current-art-gallery/海风与布丁_当前图库.html`，相对于本次工作区`2026-10-10/new-chat/`；117,264,920字节，SHA-256 `135b05371fda219848d967efd16354a26e230063c46e49eb90622127a3253119`。旁边的manifest只列这116张的出处、SHA及章节/句ID引用。
- 116张内嵌大图逐项SHA与当前播放文件一致；缩略图仅用于卡片，不替换下载文件。C12/C18/P09已含最新修正；O11等未进入剧情的备用不在此图库。
- Edge断网打开无外部请求、无脚本错误；四种类型的筛选计数正确，第九话筛出12张；P09、C18关键词定位与大图通过；P09下载原字节SHA匹配。左右键、Esc、390×844手机布局无横向溢出均通过。截图和`validation.json`保存在同一输出目录，已目视复核桌面、手机和立绘大图。
- 游戏文件SHA仍为`39ab7ce0f501f6952bee5eb5f884fe975b451bf0b1623f9ec202ebed70ca13ba`；本轮不改游戏、美术或开发库。HTML与下载验证文件均留在本地outputs，不加入Git。只保存导出工具与本记录，不推送。

后续在仓库根目录运行`python tools/build_current_art_gallery.py`即可依据当时实际引用重建；和展示全部母版/备用/退选的开发库及`build_art_upgrade_gallery.py`审核页分开。

<a id="source-048"></a>

## 深海新主曲与两首钢琴改编接入

原文档：`docs/collab/work-ledger/deepsea-emerald-piano-20261021.md`；整理前 SHA-256：`91a26c2f926633ec9de7874075a5d1274ad7b250a96d353281cc17bbb1711e8a`。

- 负责人 / 执行 agent：音乐负责人 @Liyang1145 / Codex
- 状态：已同步工作分支，通过播放与全作回归，待负责人听审
- 更新时间：2026-10-21
- 任务分支：fix/character-performance
- 基线提交：fad065eb060525d1b3e1eb72926386d27f926a48，保留当前本地修改
- 交付：工作分支 fix/character-performance；用户补充要求同步仓库；不额外构建单文件

#### 本次目标与影响范围

用户指定 `21.wav` 为新深海主题主曲，`深海-钢琴.mp3` 为其纯钢琴改编，并补交 `翡翠钢琴.mp3`。Atri 的 E2 暂时弃用；M2 深海空间曲明确保留。按原稿与现行剧情分配主题和钢琴版，不把普通深海环境、关系受伤或所有夜景批量替换。

#### 兼容变化与交叉点

原桌面文件保留，游戏以 MP3 播放；WAV 仅生成高质量 MP3 副本。两份原 MP3 按原字节保存，不截短或重复编码。使用独立稳定 ID，新 E2 与钢琴版分开；旧 Atri E2 保留文件与 ID、退出剧情播放。测量响度后仅以 playbackGain 衰减，保留玩家音量设置。

仅改指定节点的 BGM、音乐资产与来源记录。3315 节点的 ID、文字、顺序、变量、选择、美术、语音、音效与停奏不改。保留 L15/C20 已恢复旧版的决定。

#### 实际验证与交付

| 节点范围 | 用曲 | 场景与依据 |
| --- | --- | --- |
| #276–327 | 翡翠之梦·钢琴改编 | 第二话：黄昏，记忆与暗号约定；延续至她归还笔记本。原稿 L696 钢琴 solo。 |
| #399–487 | 深海之光·主曲 | 第三话：海床蓝光亮起至水下定情完成。保留 #399 主题起点，M2 #391–398 不动。 |
| #488–504 | 深海之光·钢琴改编 | 第三话：出水黄昏、“今天涨潮”尾奏。原稿 L1193 钢琴尾奏。 |
| #625–642 | 深海之光·钢琴改编 | 第四话：黄昏蓝贝壳手链托付。原稿 L1511 深海钢琴。 |
| #2691–2726 | 深海之光·钢琴改编 | 第十五话：清晨门口兑现早安赌约与尾尖约定。原稿 L5988 深海钢琴。 |
| #2860–2943 | 深海之光·主曲 | 第十六话：回到最初浅滩，戒指、手稿与初遇真相。原稿 L6353 深海完整版。 |

合计 296 节点只改 BGM：新深海主曲 173、深海钢琴 71、翡翠钢琴 52。现有其他音乐资产不变，仅旧 Atri E2 标为暂时退用，剧情引用为 0。M2、E4、E7 的资产与全部引用、所有停奏位置均未改。三首增益只在播放器衰减，对齐约 -17.4 LUFS；主曲原 21.wav 的真峰值约 0.01 dBTP，新 MP3 约 0.06 dBTP，应用增益后约 -2.00 dBTP；没有对原文件限幅或裁剪。两份钢琴 MP3 按源字节复制，未重复转码。

- 6 段实机播放正常、段内切句不重启，出段旧音轨停止。
- 三首浏览器解码、音量增益、37.5 秒播放状态恢复、整文件末端循环均通过；循环能回到开头不等于无缝听感已完成。
- M2/E4/E7 实机保留并正常播放；停奏、退出停止通过。
- 全作回归 3315 节点，nbad 0、nerrs 0；存读档句 ID 与变量一致。
- 音乐资产已进入同一开发页的项目资产表；美术目录指纹同步，L15/C20 仍用用户要求恢复的旧图。
- 逐句映射与原件校验（历史位置 `content/audio/deepsea-theme-integration-20261021.json`）、播放验证（历史位置 `content/audio/deepsea-theme-validation-20261021.json`）。

原文件实际时长：深海主曲 3:34.85，深海钢琴 2:12.10，翡翠钢琴 2:13.69；没有因为此前提示词写“两分钟”就截断已交付作品。未改旧单文件 HTML，本轮请打开文件夹版游玩。

#### 下一位 agent 的接续点

听感、音色、循环接缝与音乐情绪仍由音乐负责人试玩判断；技术解码与播放验证不等于听审通过。

#### 仓库同步

按用户“记得同步仓库”要求，以远端 dc1e3660e2c1de5272e6883f55e4a568af8c2351 为父提交按句 ID 合入音乐，保留队友新桌面/GalAgent 改动。不发布未验收的 6 张修图、本地界面/CSS 或与本任务无关的源音频删除。提交消息带 `[skip ci]`，遵守用户暂停自动单文件构建的决定；不改 workflow、不合 main。仓库发布层验证见 发布验证（历史位置 `content/audio/deepsea-theme-publication-validation-20261021.json`）。

<a id="source-049"></a>

## E4《日落空守》接收与场景接入

原文档：`docs/collab/work-ledger/e4-sunset-wait.md`；整理前 SHA-256：`cceb01df1a3c9734f8db19280bde9364e82a54f92d19c7d310bc64b1831c0878`。

- 执行：Codex；选曲与暂定曲名由音乐负责人 @Liyang1145 指定（2026-10-16）。
- 状态：原件已接收、三段已装配、播放/停奏/离线验证通过；本轮本地保存，未推送。
- 分支：`fix/character-performance`；基线`e64b808`，工作区干净。远端main为`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`，远端精修分支仍为`7c50dd2`；本轮不自动推送或合并main。
- 来源：用户提供`本机原件/日落空守.mp3`，用于此前讨论的E4“伤口/退潮/心死”；曲名暂定，不编发行版本号。
- 影响：新MP3原件及同字节游戏副本、音乐元数据/曲目库存、按稳定句ID接入的BGM和播放边界、开发库项目指纹及单文件重建。
- 兼容：保留3315句ID、文案、分支、视觉与动作、原103项音频元数据和文件；只新增E4及指定句的音乐字段。保留通话/争执/深夜解释失败/水下救援的静默，不给所有空BGM机械填曲。

实际接入：第九话黄昏退潮至章末；第十话其后数日等待至第五日出发前；第十一话救援后“你问过我一个问题”至重新回应前。依据原稿三处《深海之光》单音/极慢提示，本轮由E4承担关系受伤后的情绪，不替换第三话E2深海定情。

#### 文件与暂定名称

- 稳定素材ID：`bgm_e4_sunset_wait`；显示名《日落空守 · E4（暂定名）》，后续改曲名不重建素材ID。
- 完整原件：`content/assets/audio/bgm/bgm_e4_sunset_wait.mp3`；作品副本：`content/imports/vnstudio/海风与布丁/assets/bgm/bgm_e4_sunset_wait.mp3`，均与用户文件逐字节一致。
- SHA-256：`4fa6f18e5f96795912cee922b7fa46c58fdb6557b18fc874a06c3240645f6684`，3,280,953字节；MP3、48kHz、立体声，144.8135秒（约2:25）。
- 实测整体响度-14.81 LUFS，主曲参考-14.43 LUFS。播放器增益`0.65917`，暂按主曲参考以下4dB播放；不修改原MP3、不裁剪、转码或写标签，不称为已完成母带响度处理。
- 文件标签注明Suno，未据此推测模型、提示词或参考音频。元数据见`content/assets/audio/bgm_e4_sunset_wait.metadata.json`及`content/audio/manifest.yaml`。

#### 起止与兼容

| 段落 | 起始句ID | 最后句ID（含） | 句数 | 退出后 |
|---|---|---|---|---|
| 九话黄昏、退潮与日记 | `x68g8tf7` | `eclt59o4` | 41 | 十话深夜见面保持无音乐。 |
| 十话数日等待 | `17nl2n08` | `4rlyhkwh` | 21 | 第五日出发、水下和救援保持无音乐。 |
| 十一话尚未解冻的回答 | `0dejux6h` | `onk5pky8` | 15 | 她重新回应后停奏，保留原《翡翠之梦》回归位置。 |

三段共77句，仅改`bgm`。本轮不把E4铺在电话、正面争执、解释失败、深水区离去的留白或溺水动作上；不改后续E5/E6候选用途。逐句旧值、新值与稳定ID见`content/audio/e4-integration.json`。

原有所有资产元数据和文件不变；原103音频加E4后104项，其中5首BGM实际入剧情、1首E5/E6候选仍仅试听。3315句文案/分支/ID、动作/立绘/CG/场景光色、所有非BGM字段逐项对照基线未变；美术开发库仍476项/648文件，更新项目指纹，无新美术。

#### 已验证与交付

- FFmpeg完整音频解码通过；原件、作品副本、单文件内嵌E4 SHA均匹配用户文件。
- Edge实机三段均正常播放、跨句复用同一音轨不重启、增益正确、循环标记有效、段末停奏通过；七处争执/水下/回应边界保持无音乐。
- 37.5秒音轨位置经`startPlay`音频状态恢复通过；停止时E4立即暂停，之前退场环境声按原播放器淡出后清空；无新增叠曲机制或程序化音效。
- 断网单文件E4实际播放通过，浏览器错误0。验证记录：`content/audio/e4-validation.json`。美术/剧情校验器只对明确记录的77个E4音乐赋值还原后比较历史基线，其余保护不放宽。
- 单文件主入口及三个常用试玩副本已同步，162,015,837字节、SHA-256`ffbff282788d40619757472205f26148f1bdc52c3f4029645b91ae5bab18d0aa`。大HTML保存在本地outputs，不提交Git；仓库保留原音频、装配及重建工具。

未做无缝循环编辑，精确循环点、听感音量与换曲时机仍可由音乐负责人微调。选曲与暂定名已确认，不等于全季音乐定稿；本轮没有推送或自动合并main。

<a id="source-050"></a>

## 最早《翡翠之梦》定位调整

原文档：`docs/collab/work-ledger/emerald-meeting-cue.md`；整理前 SHA-256：`0e7d5506a65d19bafa69dc78a1741674dd11c5d86edb31469e72759eda76aa3c`。

- 日期：2026-10-17；音乐负责人原话：“最早的那个翡翠之梦，定义为见面曲，主曲另定。”
- 对象：原交付`翡翠1.1.mp3`，约2:13.21，SHA256 `02162232f3aa9e5465ea06d1b4968776375f04d6fbeae1c9e39e5623eede44fa`。
- 新定义：见面曲；新主曲、其用途与变奏基准待音乐负责人另定。不改变店铺“翡翠之梦”的名称。
- 兼容：保留`bgm_emerald_dream_main_v01`历史稳定ID、原MP3与当前1025句播放映射。ID含main不表示主曲定位继续有效；M6/E3/M7同SHA复用只是既有装配事实，不代表主曲缺口已解决。
- 本次只更新音乐进度/方向/曲目表、接手说明、待办、最新入口、决策与素材README；不改game.js、音频、播放增益、节点、存档或现有音乐映射，不执行任何CG/生图任务。
- 用户随后要求把远端缺少的文件打为ZIP供手动转交。本次音乐文档会随本地补齐包交付；不能因此写成已推送远端。
- 检查：现有game.js SHA保持`fbe54379d81ce6663e0b4264282f2676d8c9aa38bbcba189acbffab65bf0bd3b`；原音频SHA保持上值。文档用途更名不重复跑游戏测试。

<a id="source-051"></a>

## 交接快照与 Live2D 资料

原文档：`docs/collab/work-ledger/handoff-assets.md`；整理前 SHA-256：`74d1be97ec1540aca48ee2b02bdc1dcd30c16f630e361e4f79fd9245ac4d0e48`。

- 交接提供者：@nannnannan；实际制作/集成负责人待本人标明。
- 状态：历史快照已迁移；Live2D仍为制作中检查点，不作完成验收声明。
- 记录时间：2026-10-13。
- 来源分支：`handoff/galgame-workspace-20261012`，提交 `79b3f57`；既有标签 `workspace-20261012`。
- 附件：[交接附件（当时为私有；仓库 2026-10-16 起公开）](https://github.com/Liyang1145/galLingS/releases/tag/workspace-20261012)。

#### 已知边界

交接 README 自述旧 RenPy 工程与发行包为历史备份，Live2D v6处于暂停制作检查点。不要据此替换当前 galLingS/VN Studio 运行路线，或把编辑工程 `.cmo3` 当成可直接运行的角色包。

#### 待集成信息

明确当前制作负责人、执行 agent和分支；若交付运行时模型，列模型/纹理/动作文件、依赖、角色身份参考、加载接口和实际验证结果。当前没有据此宣告已接入 Larry 的最新作品。

<a id="source-052"></a>

## 背景/CG 高清化 + 深海下潜过渡 + 配乐分配 + P04（2026-10-19）

原文档：`docs/collab/work-ledger/hd-art-music-20261019.md`；整理前 SHA-256：`3a7fadfa994bf56a0e278c14f4938f2316428338ae54e4247042422ba2006255`。

用户 10-19 21:20 前后逐项点头，Hark 执行。分支 `fix/character-performance`，基于 `8a36f4a`。节点 3315 个、原句 ID、选项、变量、停奏全部不变（脚本逐字段比对：只有 `bg` 5 句、`bgm` 264 句变化）。

#### 提交
| 提交 | 内容 |
|---|---|
| `b88ff4b` | 高清化 1/4：B01–B12 |
| `e186818` | 高清化 2/4：B13–B24 |
| `39e187c` | 高清化 3/4：B25–B36 |
| `d9b4b08` | 高清化 4/4：B37–B42、C01、C03、C16、O01、O02、O12 |
| `9020ee4` | 新背景 B11A + #394–398 接入；P04 尾巴；game.js 48 张图 w/h |
| `24abeca` | 配乐：E2 起点、家居曲退出翡翠之梦营业段 |
| （本提交） | 文档：本记录、索引、待办总表 |

#### 1. 背景/CG 高清化（A34，48 张）
- 来源：`gpt-image-2.5-sunburst` 3840×2160 忠实重绘，加低频色彩校正回原图色调（构图不变、平移 0）。逐张指标（均差 / SSIM / 最差块）写在 `runtime-manifest.json` 各条的 `hdUpscale` 和 `originals/<ID>.generation.json` 的 `hd_revision`。
- 范围：B01–B42、C01、C03、C16、O01、O02、O12。B16、C16、B22、B25（虚化变清晰 / 工具小幅挪位）按用户指示照换。
- **C27 跳过**（用户 10-19 21:32：不再使用）。核对结果：C27 在 `8a36f4a`、`1f8295c`、`1f8295c^` 三版剧本里都没有任何节点引用；资产 `art_upgrade_c27` 已是 `previewExcluded`（鉴赏不显示），manifest 里在 `withdrawnItems`（status rejected）。本次只在两处退选说明后追加了 10-19 的再次确认，文件保留。
- 规格：
  - 母版：新增 `originals/<ID>.webp`（3840×2160 无损），manifest 的 `sourceMasterPath` 指向它；旧 1672×941 母版 `originals/<ID>.png` 保留不删。
  - 运行图：`runtime/<ID>.webp` 与 `content/imports/vnstudio/海风与布丁/assets/art-upgrade/<ID>.webp` 同一文件，3840×2160 webp q90（与 O11、C26 同档）。
  - `game.js` 50 个引用这些图的资产 `w/h` 改 3840×2160。
- 体积：
  - 运行图（48 张）28.1 MB → 57.7 MB（+29.6 MB；文件夹里 runtime 与作品各一份）。
  - 新母版 396.6 MB（无损），旧 png 母版 135.3 MB 保留。
  - 安卓包：`mobile/prepare_assets.py` 会把宽于 1920 的图缩到 1920（q84）。旧 1672 宽的图不缩、原样带入（28.1 MB）；新图缩完估算约 20.7 MB（含 B11A）。**APK 里这部分反而小约 7 MB。**
  - 单文件试玩版：构建时背景缩到 1600 宽，体积和以前一样（约 167 MB）。

#### 2. 深海下潜过渡 B11A「深水区_下潜」
- 图：Sunburst 生成，2752×1536，沿礁壁下潜、上亮下暗（参考 B11、B13；提示词 `prompts/B11A.txt`）。
- 新资产 `b11a_dv01`；`#394–398`（`jxcomt6b` `m6ei66jl` `x35m554a` `f1pdnd2t` `wgr8onro`）的 bg 由 B11（`e6cby6b5`）改为 B11A。
- B11 本身保留（也已高清化）；剧本里不再引用，manifest 标 `referenced: false`。

#### 3. 配乐
| 段 | 节点 | 原 | 新 |
|---|---|---|---|
| 第三话深海 | #391–398 | M2 | M2（不变） |
| 第三话深海 | #399–460（62 句） | M2 | **E2《深海之光》** |
| 第三话深海 | #461–504 | E2 | E2（不变） |
| 第三话夜 | #505– | E7 | E7（不变） |

家居曲 `bgm_atri_e3m6m7_v2` 原有 518 句，按背景分组后：
| 节点 | 背景 | 场景 | 处理 |
|---|---|---|---|
| 1269–1317 | B20/C11/B26/O08 | 新家、院子、秋千 | 保留家居曲 |
| 1481–1496 | B28 书房 | 家 | 保留 |
| 1859–1941 | B27 客厅 | 家 | 保留 |
| **1942–2020**（79） | B37 店面 / O10 / B41 后厨 / O05 / B38 店内 | 开张当天排队、后厨验收、定招牌、开业筹备 | **→ M3** |
| **2042–2107**（66） | B38 店内 | 开业第二周、招工、转正 | **→ M3** |
| 2154–2177 | B31 厨房_清晨 | 家里厨房 | 保留 |
| **2246–2257**（12） | B41 店里厨房 | 三道新菜（营业期间研发、限量上菜） | **→ M3** |
| 2539–2569、2626–2629 | B31 / B22（一周蒙太奇） | 家里早餐 | 保留 |
| 2630–2664 | O06 / B33 | 日记共读、家里早餐桌 | 保留 |
| 2665–2676 | B41 店里厨房 | 第二天早晨（未营业）窗台多了一盆薄荷 | 保留（判断：非营业时段，与“打烊后的厨房”同类） |
| 2677–2726 | B34/B36/C19/C20 | 家里餐厅、卧室门口 | 保留 |
| **2833–2859**（27） | O02 店外 / B41 店里厨房 | 第十六话开头，营业中的下午做焦糖布丁 | **→ M3** |
| **3058–3075**（18） | B38 店内 | 番外“女仆服务日”营业 | **→ M3** |
| 3076–3087 | B34 餐厅_夜 | 回家 | 保留 |

合计 202 句改 M3，家居曲剩 316 句。M3 段与前后已有的 M3（集市）多处直接相连（#2107→2108、#2245→2246）。翡翠之梦·见面曲 `bgm_emerald_dream_main_v01`（315 句）不动。改动记进 `game.js` 的 `musicPacing.changes`。

#### 4. P04 立绘
- 用 `fix6/P04_v1.png`（尾巴按 L01 标准重画，灰底）。
- 只把尾巴区（新旧尾巴并集，羽化 2px）合成回现行 P04，其余像素逐一不变（实测区域外最大差 0）。
- 灰底按色差求 alpha，尾巴内部填实，清掉 <16% 薄雾。
- 旧母版另存 `originals/P04_superseded_before_tail_l01_20261019.webp`。

#### 5. “干地拍水”5 处（S06）+ R13
核对发现已在 fix9（`docs/sources.md#source-065`）改好，现行 game.js 就是新句，本次不再改：
| # | ID | 原 | 现 |
|---|---|---|---|
| 580 | vnymith9 | （尾鳍拍水一下。） | （尾鳍拍了一下地面。） |
| 624 | 33rrox32 | （尾鳍拍水一下。） | （尾鳍拍了一下地面。） |
| 1534 | 6d8dd6m2 | （尾鳍拍水一下。不重。比拍沙那次轻得多。） | （尾鳍拍了一下地板。不重。比拍沙那次轻得多。） |
| 1539 | c2556srw | （尾鳍拍水一下。） | （尾鳍拍了一下地板。） |
| 2064 | 8q6fi63f | （尾鳍拍水一下。） | （尾鳍拍了一下柜台。） |
| 2427 | gqkrx13n | （整条尾巴，沉在水里。一动不动。） | （整条尾巴垂了下去，拖在身后。一下都没有摆。） |
| 2450 | 4smyo4io | （尾巴尖从水里浮起来一点点……） | （尾巴尖从地上抬起来一点点。还没翘。只是不再垂着了。） |

全剧其余“拍水”句都在浅滩、礁石、沙洲的水边场景，没有新的矛盾。这 5 句的动作声仍留白，可选用已有的 `sfx_tail_pat_floor_*`。

#### 6. 下潜过渡补两帧 B11B / B13D（10-19 晚，用户确认方案）
基于 `55447aa`（第一话 CG 动画集之后）。节点 3315、句 ID、选项、变量、停奏、配乐不变；剧本只改 4 句 `bg`。

| # | ID | 台词 | 背景（前 → 后） |
|---|---|---|---|
| 394 | `jxcomt6b` | 第三十米—— | B11A（不变） |
| 395 | `m6ei66jl` | 光没了。 | B11A → **B11B** |
| 396 | `x35m554a` | （空行） | B11A → **B11B** |
| 397 | `f1pdnd2t` | 然后，光回来了。 | B11A → **B13D** |
| 398 | `wgr8onro` | 不是太阳的光。 | B11A → **B13D** |
| 399 起 | `smyc1237`… | 她拉着我又往下沉了一段…… | B13（不变） |

配乐照旧：#391–398 M2，#399 起 E2。

- **B11B「深水区_光没了」**（资产 `b11b_dv02`）：B11A 压暗版，程序处理、非模型生成，2752×1536。
- **B13D「深海_荧光初亮」**（资产 `b13d_dv03`）：Sunburst 以 B13（3840 高清版）为参考生成，同构图几乎全暗、只剩荧光点，3840×2160；提示词 `prompts/B13D.txt`。不套 B13 的 `sceneFit`（按用户看过的原样显示）。
- 文件规格同 A34：母版 `originals/<ID>.webp` 无损；运行图 `runtime/<ID>.webp` 与作品目录 `assets/art-upgrade/<ID>.webp` 同一文件（webp q90）；manifest 新增两条（`derivedFrom` 记来源），`originals/<ID>.generation.json` 各一份。
- 命名：沿用 B11A 的「场景号+字母」惯例；B13 原有 `B13_before_review`，无 B13A–C，取 B13D 不冲突。

##### 顺带：A30 game.js 宽高与文件不符
按实际文件（作品目录 webp 实测）改正 `game.js` 资产 `w/h`。A30 列的 C14/C25/C26/L37/L38 全部不符；同类问题还有 T01、O04–O11，一并改正：

| 图 | 资产 | 原 w×h | 改为 |
|---|---|---|---|
| C25 | `md2p8m90` | 1672×941 | 2752×1536 |
| C14 | `pmngp4pk` | 1672×941 | 2752×1536 |
| T01 | `32lrbngt` | 1672×941 | 2752×1536 |
| L37 | `nvgbi1x6` | 586×1300 | 1264×1536 |
| L38 | `jtp36q4e` | 506×1300 | 1024×1536 |
| O04 | `art_upgrade_o04` | 1672×941 | 2752×1536 |
| O05 | `art_upgrade_o05` | 1672×941 | 2752×1536 |
| O06 | `art_upgrade_o06` | 1672×941 | 2752×1536 |
| O07 | `art_upgrade_o07` | 1672×941 | 2752×1536 |
| O08 | `art_upgrade_o08` | 1672×941 | 2752×1536 |
| O09 | `art_upgrade_o09` | 1672×941 | 2752×1536 |
| O10 | `art_upgrade_o10` | 1672×941 | 2752×1536 |
| O11 | `art_upgrade_o11` | 1672×941 | 2752×1536 |
| C26 | `art_upgrade_c26` | 1672×941 | 2752×1536 |

- L37 实际文件 1264×1536，manifest 原写 1024×1536，也一并改正。
- 引擎画立绘只用节点里的 `h`，资产 `w/h` 只是元数据（编辑器默认高度、素材库显示用），不影响现有画面。L37/L38 在大画布下人物可能偏小的问题仍待看（A30 剩这一半）。

#### 7. C15 尾巴按 L01 重画（10-19 夜，用户确认替换）
基于 `5b4068b`。剧本、节点、配乐不变；C15「CG_翡翠之梦」（资产 `7jj07jqh`，#2026–2029 柜台上张开手臂那段）整张替换。

- **做法**：Sunburst（`gpt-image-2.5-sunburst`，high）双图编辑——图1 为 C15 尾巴区裁切（1432×1432，按 1536×1536 出图），图2 为 L01 尾巴参考；保持原姿势、位置、大小、弧线和店内暖光，改成 L01 标准（斑驳中蓝背面、浅蓝腹面、波浪分界、深蓝描边、一对尾鳍、单个白色新月旋纹）。两版里选 t1（用户确认）。
- **只合成尾巴区域**（约 x1840–2572、y644–1858）回旧母版，其余像素与旧母版逐一相同（合成底图用的是旧无损母版，不是运行图）。尺寸仍 3344×1882，`game.js` 资产 `w/h` 不用改。
- **文件**：新母版 `originals/C15.webp`（无损）；运行图 `runtime/C15.webp` 与作品目录 `assets/art-upgrade/C15.webp` 同一文件（webp q90，原 q95）。旧母版 PNG 改名保存为 `originals/C15_superseded_before_tail_l01_20261019.png`，旧 `generation.json`/`production.json` 随之改名为同前缀；`archive/deliveries/refined-cg-20261016/originals/C15.png` 原交付件不动。
- **记录**：`originals/C15.generation.json` 改写为 revision 2（来源、参考图、合成范围、新旧哈希）；manifest C15 条目改 `sourceMasterPath`、哈希、字节数、`webpQuality` 90，并加 `derivedFrom`；`game.js` 中 `7jj07jqh` 的 `sourceMasterPath` 指向新 webp 母版。
- **回归**（fix6/reg.py）：nbad 0、nerrs 0，走完 3315 节点，存档读档一致，← 正常。未重建单文件版。

<a id="source-053"></a>

## 参考图驱动的全量美术重制与补齐

原文档：`docs/collab/work-ledger/image25-art-upgrade.md`；整理前 SHA-256：`421907e5bb4041ef4e3f0f57bff0385221f9d016a8b522198662129ff606528f`。

- 执行：Codex，用户于2026-10-14明确要求以新提供的两张图为参考，使用Image2.5全量替换、升级补充、最高质量。
- 状态：已完成本轮装配与验证，泳装原文服饰三项按用户决定转人工；不编发行版本。
- 分支：`feat/image25-art-upgrade`。
- 开工运行基线：`2598e54dead9b6e601ba3d0be2930d0d75f01004`，经PR #5进入main `22d231f`。
- 用户后续要求处理 `tanpowasd/dev`，已审核修复并通过PR #6合入main `021357506a4cdc9c4344a238eece306ec427caef`。本任务分支已快进到该共同基线，制作/试装工具使用新的 `content/imports/vnstudio/` 和 `docs/content/` 目录，素材原件与审核未丢失。
- 本次授权解除此前人物重制暂停。保留原图、音乐、剧情和素材/存档ID，不命名发行版本。

#### 制作约束

用户参考已保存至 `content/assets/art-upgrade/references/`：第一张用于脸部、蓝眼睛、长蓝发、环形呆毛、蓝白耳鳍、蓝蝴蝶饰物与细腻绘画风格；第二张用于全身比例、双腿与独立后腰鲸尾。角色按原稿为22–24岁成年女性。主服和各剧情服装依据剧本，参考泳装不替代所有衣服；饰物按取得/交出进度出现。

通过已安装codex-gpt-image CLI的订阅OAuth请求Image2.5，显式请求max质量、PNG原件和高分辨率，逐份保留请求/后端信息与实际输出尺寸。后端若不回传模型或质量，记录未核实，不把参数当作已实现保证。正式使用前检查人物身份、双腿/尾根、手部、服装、光照、道具、透明边缘和画面安全区。

依据既有104项主清单、参考板与增强项，重新核对当前94个视觉ID、44场景族及18章节点。先建立可复用的角色/服装母图，再派生表情与道具，CG共享人物和实际场景参照。全量覆盖运行美术与必要补图；历史退选图留档，不强行恢复错误画面。

PNG原件与提示词/生成记录、审核在art-upgrade目录；运行副本单独压缩，人物锚点统一。装配后重建全量美术开发索引与来源CSV，验证剧情引用、章节、存读档、性能与离线打包。台账状态按实际生成、审核、采用和待返工区分，不把批量生成等同于完成。

#### 已发现的限制与审核修正

实际返回立绘1024×1536、横图约1672×941，多数质量medium，部分low；请求max与更大尺寸未实际实现，后端未回传模型。Flare/Sunburst均未证实最高档生效。保留真实元数据，不上采样后冒充原生高分辨率。

已逐图发现并返工：清晨/正午区分、深海误有阳光、海面上浮误用岸边视角、小镇边缘/饰品巷误复制母图、白天不应亮的灯、过早出现的手链。第二轮修正第十三话摘项链后的打烊CG与贝壳铃铛被画成玻璃风铃的错误。

泳装脚部修改及某抱膝姿势被接口输出拦截；不重试被拦截的同一请求。另做完整外搭、包头鞋和全长裹毯坐姿的较保守候选，保留服装差异。用户2026-10-15明确选择泳装原文服饰留待人工：L17候选退选，L18/C23不再自动请求，当前两张泳装原图继续使用；C23旧错误CG不恢复。完整裹毯的营地夜谈候选已单独审核，未代替泳装。

新增生成保存逐图prompt与参考图校验、实际输出SHA的 `.production.json`；较早图像以当时制作清单和原后端元数据追溯，原记录不伪装成已核实模型。运行WebP保留原尺寸，立绘无损且校验透明通道；PNG母版不覆盖。

#### 本轮交付与兼容

- 115项任务，113张已生成、112项当前草稿审核通过：44背景、35立绘、32CG、1封面。112项装配或备用可调用；92个实际播放视觉ID中90个已换新，2个旧泳装立绘明确留待人工。不要把备用图数量写成全部剧情采用量。
- 用户新第一话接入，3308个原句ID保持顺序，新增7句。第一组选项B沉默扣10、糍粑选项C扣1。作死线5次拍水用现有真实双拍两次与轻拍一次延迟触发，切句/快进/读档/停止取消未播放声。尾鳍情绪信号仍只计1；删除的丝线证据不播放但保留原ID。其余3148个节点非视觉字段完整不变。
- 新第一话50天与第六话15天的差异保留为人工文案缺口。烤鱿鱼CG返工为无人礼物，避免提前揭示送礼者；贝壳夜谈按营地夜景与两枚粉色扇贝制作。
- 原有103个音频资产元数据不改，音频原件不动，运行没有WAV。Atri cue报告是接入当时的历史索引；当前播放仍按原句ID对应节点。整包覆盖前先核对当前3315节点。
- 全量开发索引418项/564文件，注册420视觉ID，加103音频共523编辑资产。含PNG母版、运行WebP、旧原件与退选候选，分页/按需解码；正式玩家包不嵌未采用的备用美术，单文件约123.76MB。
- 运行与编辑入口仍读同一 `content/imports/vnstudio/海风与布丁/`；开发草稿、存档与源项目隔离。无新发布号，没有重写团队历史。

<a id="source-054"></a>

## Image2.5 第二轮修图（2026-10-17）

原文档：`docs/collab/work-ledger/image25-pass2.md`；整理前 SHA-256：`7096907de20c664c79534aa35b488e67f2970941e26a95e48fd3e1d6d3dc9bcd`。

- 发起：用户 @Liyang1145 2026-10-17 01:24（UTC+08）指令：用 Rinko「满血 Image2.5」顺着队友精修包继续修其它图；撤销同日「CG 全部暂停」。
- 基线：`fix/character-performance` @ `2c697ba`。本分支 `art/image25-pass2` 只替换同名运行时 WebP，**不改 `game.js`**，节点/句 ID/选项/变量/音乐不动。
- 未合并 `fix/character-performance` 或 `main`，待团队目视验收后再并。

#### 范围
- 立绘 55 张（1024×1536 透明）：L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, L13, L14, L15, L16, L19, L20, L21, L22, L23, L24, L25, L26, L27, L28, L29, L30, L31, L32, L33, L34, L35, L36, O03, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, P12, P13, P14, P15, P16, P17, P18, S01, S02
- CG 12 张（2752×1536，与精修包同尺寸）：C14, C25, C26, O04, O05, O06, O07, O08, O09, O10, O11, T01
- 未动：队友精修包已覆盖的 19 张 CG（C02/C04–C13/C15/C17–C22/C24），以及 C01、C27、O12、背景 B 系列。

#### 主要修正
1. 鲸尾结构统一：一条连续尾柄从后腰长出，末端一对带中央缺口的扁平尾鳍；上面亮钴蓝，下面白，白色圆形海洋纹；去掉旧图的鳞片斑块、扇贝白斑、第三瓣、与腿/衣物粘连。
2. P02（待办 A03）：基于队友精修原图去白底，保留上扬尾巴与两片尾鳍在画框内、举本姿势。
3. P17：旧图被画成假透明格子底，重做为真透明。
4. L03、P14：以 `2c697ba` 新版为输入重修。
5. CG 全部升到 2752×1536，构图/人物/道具/光照保持，渲染向精修包看齐。

#### 过程与退选
- 接口：`https://api.rinko.ai/v1/images/edits`，`gpt-image-2.5`，`quality=high`，`stream=true`（非流式会被 Cloudflare 504）。
- C14 第一版只升渲染、尾巴仍是斑块 → 退选，改用明确「整条尾巴重画」指令重做。
- P17 加 L01 作第二参考 → 模型照抄 L01 站姿并加暗色光晕 → 退选，改单图重做。
- 每张的来源路径、来源 SHA-256、输出 SHA-256、参数见 `archive/deliveries/image25-pass2-20261017/generation.json`；无损/高质量原件在同目录 `originals/`。

#### 待验收（请团队看图后勾选）
- [ ] 立绘尾巴与 CG 精修包是否一致
- [ ] O06、O11 尾巴走向（O06 尾鳍在背后上方；O11 尾巴横躺在礁石上较长）
- [ ] C25 睡衣与贝壳项链装束是否已确认（清单要求确认后才制作）
- [ ] T01 封面留白是否够排书名
- [ ] 下一轮：C27 勾脚踝、涉水遮挡、手部细节、C01/O12

<a id="source-055"></a>

## L37 尾巴纹理对齐 L01（2026-10-18）

原文档：`docs/collab/work-ledger/l37-tail-l01-20261018.md`；整理前 SHA-256：`e2bd417f3296019134ac52827cf8ecf084df10c6346467438e0cc327cbb90f93`。

- 用户要求：L37 尾巴纹理对齐 L01，尾鳍上只要一个白色旋纹。
- 做法：以 L37_x2（形状按用户手绘草图：尾巴从臀后斜向左上、尾鳍在手臂高度）为底，擦掉原尾巴；把 L01 真实尾巴像素旋转 180° 后按相似变换贴到腿/身体后面（只有一个旋纹）；尾根与泳衣交接处用 gpt-image-2.5 局部修补后按多边形合回；灰底抠 alpha。
- 脚本：fix6/l37pix.py（工作区）。
- 16:50 用户「再长一点粗一点」：尾巴整体放大约 1.25 倍、尾根更深藏进臀后（fix6/l37pix_long.py），尾根交接与头发左缘各用 gpt-image-2.5 局部补一次再合回。

<a id="source-056"></a>

## 灵枢记忆库、多模型插件、GalAgent 完整工具链与 MCP 扩展整合（含 Steam 双模客户端）

原文档：`docs/collab/work-ledger/lingshu-multi-llm-galagent-mcp-20261021.md`；整理前 SHA-256：`41ec4c0ad94052f103046ff3b217e28440b9b1b237607f414cee1a05c5d756af`。

- 负责人 / 执行 agent：TanPowasd（引擎与桌面）
- 状态：已集成 / 已验证
- 更新时间：2026-10-21
- 任务分支：`fix/character-performance`、`tanpowasd/dev`（独立工作树 `e:\Lingshu-steam`）
- 基线提交：`8df7a7f`

#### 本次目标与影响范围

按用户要求直接修复并合并以下四大核心能力到统一运行时与 Steam 桌面端：

1. **内置灵枢认知图 MCP 记忆库（`gallings.memory.lingshu`）**
   - 新增内置 `plugins/builtin/memory-lingshu/md_cg/mcp_server.py`，提供标准 JSON-RPC 2.0 stdio MCP 服务端（支持 `mdcg_remember`、`mdcg_search`、`mdcg_get`、`mdcg_link`、`mdcg_status`）。
   - 采用 BM25 + 语料 IDF 权重 + 16 组语义同义概念簇（解决换说法提问 / paraphrase）+ 认知图边激活扩散（Spreading Activation）+ `actor` 时间线硬隔离。
   - `dsh_memory_path` 默认留空即可直接使用内置灵枢认知图引擎，同时完全兼容用户手动指定外部 `dsh-memory` 仓库路径。
   - 同步升级 `gallings.memory.local` 的 IDF 与概念扩展，评测集 `tests/evals/memory.yaml` Recall @10 从 `71.4%` 提升至 **`100.0%`**，跨时间线污染率 `0.0%`。

2. **多模型 LLM 插件体系（`gallings.llm.*`）**
   - 新增三款内置模型插件，与原有 `gallings.llm.openai-compat` 组成完整四协议矩阵：
     - `gallings.llm.openai-compat`：OpenAI / DeepSeek / 硅基流动等兼容接口
     - `gallings.llm.anthropic`：Anthropic Claude `/v1/messages`（SSE 流式、`<think>` 块、`tool_use` 转换）
     - `gallings.llm.gemini`：Google Gemini `v1beta` `streamGenerateContent`（SSE 流式、`functionCall` 转换）
     - `gallings.llm.ollama`：本地 Ollama 免密钥直连
   - 升级 `server/settings_store.py`、`server/api/app.py`、`web/vn.html`、`web/vn.js` 与 `web/offline/steam-host.js`，支持在网页外框设置与游戏内设置面板一键切换模型协议与记忆底座，自动热重载后端插件。

3. **GalAgent 完整工具链与 MCP 扩展（`gallings.tool.galagent` + `gallings.tool.lingshu-mcp`）**
   - 新增内置 MCP 工具插件 `plugins/builtin/tool-lingshu-mcp/plugin.yaml`（`id: gallings.tool.lingshu-mcp`，`runtime.type: mcp`，`capabilities: [galagent]`），将 `mdcg_remember`、`mdcg_search`、`mdcg_get`、`mdcg_link`、`mdcg_status` 5 个灵枢认知图工具自动挂载进 `GalAgent`。
   - 扩展 `plugins/builtin/galagent/plugin.py` 与 `plugin.yaml`，支持在 `mcp_servers` 配置项中动态拉起任意外部 stdio MCP Server 并注入 `GalAgentSession`。
   - 修复 Windows 下 MCP stdio 子进程 UTF-8 编码环境变量（`PYTHONUTF8=1` / `PYTHONIOENCODING=utf-8`）及 `sys.executable` 自动解析。

4. **Steam / 桌面版客户端双模架构（`desktop/src-tauri/src/main.rs` + `tools/build_steam_release.py`）**
   - 桌面端启动时默认优先在后台静默拉起/连接本地 `python -m server --no-browser`（**完整引擎模式**），启用全部 Python 插件、灵枢认知图 MCP、多模型插件与 GalAgent 工具链，退出窗口时自动回收子进程。
   - 若运行环境无 Python，自动回退至 `app.localhost` + `galcore.wasm` **离线兜底模式**。
   - `tools/build_steam_release.py` 将 `server/`、`plugins/`、`compiler/`、`content/cards/`、`schemas/`、`web/`、`wheels/` 一并打包入 `dist/steam/content/`。

#### 兼容变化与交叉点

- 原有 `/api/settings` 接口协议 100% 向后兼容；未传 `provider` 时自动按 `base_url` / `model` 推断或默认 `openai-compat`。
- 作品本体 `content/imports/vnstudio/海风与布丁/` 3315 节点、3308 台词 ID、音乐与立绘保持不变。

#### 实际验证与交付

- `.\.venv\Scripts\python.exe -m pytest`：全仓 **184 passed, 1 skipped, 0 failed**。
- `.\.venv\Scripts\python.exe -m tests.evals.run --mode scripted`：灵枢记忆库评测 **Recall @10 = 100.0%**，时间线隔离 = **100.0%**，全部达标。
- `.\.venv\Scripts\python.exe tools/build_steam_release.py`：成功生成 `dist/steam/content/HaifengPudding.exe` 及完整双模发行包。
- `python tools/check_full_regression.py`：`nbad: 0`、`nerrs: 0`。

#### 下一位 agent 的接续点

- 灵枢认知图 MCP、多模型插件、GalAgent MCP 扩展及 Steam 双模桌面包均已合入 `fix/character-performance` 与 `tanpowasd/dev`（`e:\Lingshu-steam`）。

<a id="source-057"></a>

## Hark 生图与配音工作流转为本地保留

原文档：`docs/collab/work-ledger/local-production-workflows-20261020.md`；整理前 SHA-256：`fb42d54fa9ac9183b3460da9ab6ee8d2c0fa7b9b2b4e78381b4d4f434149cb72`。

- 负责人 / 执行 agent：音乐负责人委托 / Codex
- 状态：已执行（本地留存、仓库清理）
- 更新时间：2026-10-20
- 任务分支：fix/character-performance；main 同步清理同一批生产脚本
- 基线提交：见本地清理校验记录，分别按两分支最新头构建
- 交付提交：本记录所在清理提交；不合并两分支的其他内容

#### 本次目标与影响范围

用户明确要求：仓库内此前从 Hark 上传的画图、语音工作流下载后即可清理。已将 `tools/voice-pipeline/` 全部脚本、说明和中间 JSON，以及 `tools/hark/rinko_edit.py`、`tools/hark/graykey_composite.py` 导出到仓库之外的本地 `local-production-workflows/`。逐文件比对 Git blob 与 SHA-256，记录来源提交；分支间若存在不同版本也单独保留。

#### 兼容变化与交叉点

这两套生产工具不再作为当前仓库内容分发，接手 agent 需要由负责人提供本地工作流。生图与配音的制作方法、模型要求、验收记录仍保留在协作文档。`tools/hark/commit_tree.py` 和 `push_retry.sh` 是仓库提交工具，继续保留。

游戏图片、音频成品、剧情、播放器与构建脚本不在此次清理范围，Git 历史不重写。GitHub Actions 的构建工作流也不是此次指定的两套生产工具。

#### 依赖与尚未对齐的内容

Hark 脚本带有原环境路径和网络层鉴权假设。下载与源文件校验通过，不等于在当前 Windows 环境已能直接调用付费模型；后续实际使用时再适配路径、依赖和本地凭据，不把密钥写回仓库。

#### 实际验证与交付

本地保留 `image/`、`voice/`、README 与 `manifest.json`；记录源提交、原仓库路径、Git blob、SHA-256 与字节数。清理提交只删除上述生产脚本并更新相关说明和索引。链接检查、删除范围和内容树不变检查记在本地 `cleanup-records/`。未运行生产脚本或调用生成接口。

#### 下一位 agent 的接续点

从负责人保管的本地目录取得生产工具；图片批注与游戏的其他本地修改是独立工作，未随本次清理提交。旧协作文档出现的 `tools/voice-pipeline/` 和图像脚本路径为历史说明，不应据此判断文件丢失。

<a id="source-058"></a>

## 音乐负责人本地场景与音频成果提交

原文档：`docs/collab/work-ledger/local-scene-audio-assembly.md`；整理前 SHA-256：`9f21e864ede27bea202fb7df6aeb46a1087fdfe6bc53c87df42c12452c05fad2`。

- 负责人：@Liyang1145；执行：Codex。
- 状态：已集成、已验证，探索稿；用户明确授权本地结果全部提交。
- 日期：2026-10-13。
- 分支：`integrate/local-scenes-audio`。
- 基线：`2fc1c6a9be9be404250c13531ca1336e11d0625a`，提交前远端无新增提交及开放PR。

#### 成果与入口

运行作品仍位于 `content/imports/vnstudio/海风与布丁/`，可通过 `/vn.html` 或离线 `index.html` 运行。纳入本地融合的音频、游戏内画面/播放改动和外层三路音量兼容，不覆盖后端核心及其他成员模块。

44张背景（42主背景+2补充时段）、提示词、来源、生成回执、审核、缩略图和浏览页在 `content/assets/scene-backgrounds/`；27张新生成、17张用户网页图复用。运行WebP约11MB，PNG原件约118MB。角色、人物CG保持现状；角色试生成仅存于 `content/assets/image-trials/`，不在游戏采用。

完整分析在 `docs/content/art-production/`，音效来源核对、Atri方向、缺音效表、融合与视觉验证在 `archive/deliveries/local-assembly/`。尾巴11原件/13播放片段及缺少的6张既有背景已补齐到素材库。没有提交个人配置、存档、聊天数据库、服务日志、凭据、下载的第三方工具仓库。

#### 原件与兼容

Larry原ZIP继续在既有交接附件（当时仓库为私有；2026-10-16 起已公开）中，137项原件清单不变。本次运行修改了index.html、game.js；这两个作者原始文件另存 `archive/deliveries/larry-vn/original-overridden-files/`，其他135项作者原件仍在作品目录，全部原件SHA已复核。不要把原件清单误当作当前融合运行包的校验单。

保留最新作者的3308节点ID及分支、变量、跳转；保留既有融合游戏ID与存档隔离方式。改过的bg分配、角色呈现和音频来自此前本地融合与视觉修正，记录可追溯。7张错时段/服装/道具CG继续退出播放，不恢复。三处裁切已换真全景；明暗水下、夏秋集市及日记餐桌按剧情分配。4张无独立节点的背景作为备用，未编造情节来插入。

《翡翠之梦》当前主曲及音频原件保留；A04只试听，不入剧情。UI自动提示音保持禁用，缺真实动作声留白；音乐暂按Atri文档规划，未收到的新音乐不以参考曲替代。

#### 后续协作

以当前运行作品为继续装配基线，同时使用作者原件副本核对新导出差异。不要重跑旧融合脚本覆盖修正。角色与人物CG暂缓；缺曲、动效和音效继续按团队台账交付，不创建发行版本或新release。

<a id="source-059"></a>

## M1浅滩日常选曲与接入

原文档：`docs/collab/work-ledger/m1-shallows-day.md`；整理前 SHA-256：`a95284f6dc5de8356928b8389d111b95d35828fba2b379dfc31c7a0221010112`。

- 执行：Codex；音乐负责人于2026-10-16指定`本机原件/录音机-20261011-1642(1).mp3`用作M1。
- 分支：`fix/character-performance`；基线`5f51996`，开工干净。远端精修分支仍`7c50dd2`，main仍`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`。
- 状态：原件已保存、两段已接入，完成实机/切曲/循环/离线验证；本轮本地提交，不推送、不编发行版本号。
- 原件实测MP3、48kHz、立体声、99.6935秒（约1:40），按用户已指定的现成文件保存；不为凑前述生成目标时长而拉伸或重编码。
- 范围：新增稳定素材ID`bgm_m1_shallows_day`、完整原件与同字节播放副本、明确普通地图段落的BGM替换、曲目台账/元数据及单文件更新。
- 接入判断：第三话下潜前的规矩/游泳准备，随后交给现有E2；第七话沙洲捡贝壳至午后阴凉，随后按原安排停奏。第一话角色首登场、第二话暗号契约、夜晚写诗/和解，以及现有E1/E2/E4/E7事件曲均保留。不按海景背景关键词机械覆盖情绪场景或原有停奏。
- 兼容：3315句ID/文案/分支/视觉/动作/环境音/音效不改，原104项音频及E4的77句不改；只新增M1及61句明确的BGM替换。

#### 实际保存

- 稳定ID：`bgm_m1_shallows_day`；显示“浅滩日常 · M1（曲名待定）”。正式曲名未定，不从录音机文件名编造曲名或原曲来源。
- 原件：`content/assets/audio/bgm/bgm_m1_shallows_day.mp3`，同字节游戏副本：`content/imports/vnstudio/海风与布丁/assets/bgm/bgm_m1_shallows_day.mp3`。
- SHA-256：`08dae55fe051327cad76c7f3938dc297ef234f314a50ffa2f2ef911e2646e325`，2,380,041字节；99.6935秒、48kHz、立体声。
- 整体响度实测-13.78 LUFS；主曲参考-14.43 LUFS，M1播放器增益`0.6569`，目标约主曲参考以下3dB；不改原文件，不EQ、不削低频、不裁剪、转码或拉伸，不宣称完成母带或无缝循环编辑。
- 文件标签注明Suno。先前提示词为探索过程，不据此认定这份文件实际使用了哪个模型、提示词或参考音轨。

#### 明确的采用位置

| 场景 | 起始ID | 最后ID（含） | 句数 | 后续 |
|---|---|---|---|---|
| 第三话·下潜前准备与规矩 | `qfuowzma` | `hnqx7w6w` | 31 | `vl8i53gt`下潜起切到原E2。 |
| 第七话·沙洲捡贝壳与阴凉 | `cpvlwvrk` | `ceip84bi` | 30 | `6h1atp1n`起保留原无音乐。 |

61句原BGM均为`bgm_emerald_dream_main_v01`，只有这61处BGM改为M1，逐句对照见`content/audio/m1-integration.json`。第一话首登场/完整版角色曲、第二话郑重暗号契约、夜谈写诗和和解继续保留角色主题；不会把所有海景CG和原无音乐段落默认换成地图曲。本轮为两段明确地图日常的接入，不称所有音乐时机和听感已最终验收。

<a id="source-060"></a>

## 开场剧情画面与动作音效修正

原文档：`docs/collab/work-ledger/opening-art-sound-corrections.md`；整理前 SHA-256：`8767a44644263445b32e7674a6640a8f4253615a0d05018ffc80b388e7e8b55c`。

**2026-10-17后续交付：** 原先仅本地的407份素材/运行内容已纳入`fix/character-performance`补齐资源提交`f7f6c92`，见[入库记录](<sources.md#source-046>)。下文“仅文档、未上传”为当时历史状态；CG暂停、C27退选保持有效。

**2026-10-17后继决定：全部CG暂停，C27所有候选弃用；4句已在本地撤回。** 先读[接手说明](<migration.md#history>)和[暂停记录](<sources.md#source-030>)。以下采用数量、截图和接口测试属于撤出前历史，不再作为CG制作/恢复授权；其余精修与音效保留，仍未随文档交付源码/素材。

- 执行：Codex，音乐负责人当前会话授权。
- 状态：本地已集成并完成下述验证，人工审美／听感及其余待办继续保留；2026-10-16。本次单独同步待办与交接文档，图像、运行代码、音效和来源归档尚未提交推送，未合并main。
- 分支：`fix/character-performance`；基线：`33fba8eb176b992013483108215a36197be7e042`。
- 范围：七张用户截图对应的C01/P14/P02/L03/C04、尾鳍勾脚踝、帐篷门口烤小鱿鱼及实际拍水播放。继续检查前两话和全剧动作声映射。
- 保留3315句、全部ID/文案/选项/变量、105音频资产及M1/E4分配。仅修改明确审核过的图像、场景引用与必要动作声，原件归档。不得整体重跑场景分配。
- 使用已安装的Codex OAuth Image2.5请求工作流。请求max并不证明后端模型或质量；逐张查看结果再采用。
- 本轮没有自动合并main或发布版本的授权。先生成本地可回放成果、验证和缺口记录。

#### 初查

接本CG画成了双手递本；P14笔记本左右页结构不合理；L03与C04单叶尾鳍，P02尾柄/双叶透视不自然。原C01只从介绍人物开始，接住动作句尚无CG。`o6vhcy2x`已有真实拍平水面音效，需分别检查正常播放和快进静音；不能仅凭快进截图认定缺映射。烤鱿鱼句使用空营地，后两句已有C03食物CG，出图时点晚于文案；现以O12连续覆盖三句及其后两条空白过渡。

#### 用户后续交付与纠正

- 收到《修复后CG图包.zip》20张原图，原ZIP SHA为`63786b58ca44ce2255a23964bee84d5e6d70cc3260d7c1b6e1633aeff74b7e04`。19张CG按原素材ID替换，先前图像和制作参数另存，不覆盖原作者来源。该包未提供模型或提示词，不套用旧图生成信息。
- P02是白底RGB。透明化衍生出现白边／青色杂点，已退选，当前采用本轮较早且透明通道干净的双叶候选；队友上扬尾势的精确抠图与对白可见性仍列待办A03。
- 用户指出C27尾巴像从男主裤腿长出，以及后续候选尾巴过长。两张都已退选；当前另构侧面中景，两人排近，尾根接在她腰后、尾柄缩短，脚踝动作位于对话框上方。当时列A01待审；随后用户将整项弃用，4句现已撤回，不再复核/重画。
- 当时指令是整理所有待办，已建立[53项待办总表](<production.md#content-backlog>)，并从AGENTS与最新游玩说明链接。没有因此继续发起新生图批次。

#### 撤出前本轮结果（历史快照）

25项图像原位更新／新增（19张队友精修CG＋C01/P14/P02/L03/C27/O12）。当前119个播放视觉ID、117张不同图片；515项／692文件开发库。保留全部3315句、ID、文本、选项、变量与音乐映射；105音频的元数据和文件字节与基线一致。

六处动作声修正见`content/assets/art-upgrade/opening-art-sound-corrections.json`，拍平水面增益0.85；第二话三下、第五话五下已分别调度准确片段。第一话五下节奏缩短，轻拍水／番外关门补队友真实短声。快进静音与离句取消保持。

本轮检查通过：

- 历史原3308句ID顺序、3315句连续性、后续剧情字段、原103音频及M1/E4共138句音乐覆盖校验。
- 18处演出、第一话三条完整路线各4个选择、两种窗口8组避脸、快速切姿与开发页插入撤销。
- 场景融合50项回归：写诗13句C08、坐柜台5句C26、光色继承及导入编辑等既有行为保持。
- 13处本轮实际画面截图；真实拍水音起播与时间推进；三下／五下实际片段调度、快进清声、离句取消、轻拍与关门触发。
- 单文件包含全部3315句；119个视觉ID逐项离线解码成功；浏览器无脚本错误。原105音频与基线Git blob逐项一致。

原图核对／实机核对分别记录，不声称人工通关全部3315句，也不声称所有衣装动作或听感都已完成。

#### 用户新生图接口测试

按用户提供服务与密钥进行一次图像编辑测试。模型列表查询超时；图像编辑约69.67秒返回HTTP 200和有效PNG，实际1672×940。请求名`gpt-image-2.5-sunburst`、质量max、3840×2160；回包没有模型与质量字段，不能证明最强路线、最高质量或原生4K。只保存净化摘要`gateway-test-result.json`（仅本地，本次未入库）；测试PNG与响应留在仓库外本地outputs，未替换游戏。密钥不保存到仓库。

#### 撤出前交付位置与未完成项（最新状态见接手说明）

本地单文件：`outputs/gal-single-file/海风与布丁_单文件游玩.html`，约179.18MB；当前图库：`outputs/current-art-gallery/海风与布丁_当前图库.html`。其他既有本地试玩副本同步同一单文件。队友精修原件和SHA在`archive/deliveries/refined-cg-20261016/`（仅本地，本次未入库）；装配JSON、源码与素材仍在本地工作区，未推送。本次文档同步不能替代这批素材的交付。

泳装L17/L18/C23、P16戒指、涉水遮挡、背向擦盘、睡衣抱膝、常服抱膝、伏桌与白裙坐桌等缺口仍保留登记，当前不继续CG。新接口模型证据及P02精确透明底也未完成；C27与所有接口测试图退选，不再把“文件已生成”当成“可采用”。

<a id="source-061"></a>

## 开场 #9–21「摸尾巴被拍」演出重做（2026-10-19）

原文档：`docs/collab/work-ledger/opening-performance-20261019.md`；整理前 SHA-256：`41c10d909b120a9d0e54460b97a37ede50dcdc5d224a941bf08c84c5df0b12ec`。

- 负责人 / 执行 agent：Hark（用户 10-19：「按你的想法做，然后发给我单文件」）
- 状态：已集成（工作分支），待用户试玩验收
- 更新时间：2026-10-19
- 任务分支：`fix/character-performance`
- 基线提交：`c020f67`（main 停在 `f336b35`，未动）
- 交付提交：见本记录所在提交

#### 本次目标与影响范围

开场 #9–21（句 ID `3tp1qwm9` … `58oo02cv`）原来每句都是 `trans: fade`、同一张 B02，节奏平；#14「啪！」只有 quake；#15 是受击红闪；见面曲到 #21 才进。按「触碰慢 → 惊叫停住 → 尾击快 → 笔记本定格 → 接住揭晓」重排节奏。句 ID、台词、选项、变量、3315 个节点均不变。

| # | 句 ID | 台词 | 改动 |
|---|---|---|---|
| 9 | `3tp1qwm9` | 撑着水底站起来——指尖碰到了一样东西。 | 背景换新图 B02T「浅滩_指尖触尾」（淡入一次，这是换景）；打字 ×1.6 慢；潮声 0.8→0.6 |
| 10 | `15lmqdee` | 凉凉的。滑滑的。似乎还带着一点鳞片的纹路。 | B02T；去淡入（cut）；文字前停 0.5 秒；打字 ×1.8 |
| 11 | `929w6urb` | 顺着指缝，滑了一下。 | B02T；cut；文字前停 0.7 秒；打字 ×1.8 |
| 12 | `ktsw1bk3` | 「——！！」 | 硬切回 B02 全景；保留 L05 剪影弹出 + shake；E7 配乐在这一句 50ms 切断（原来拖到 #13 才淡出）；配音清单登记补录 |
| 13 | `1hnzbz74` | 整条“东西”猛地一甩。 | cut；打字 ×0.6 快；`wait 0.6` 打完自动进 #14；配 S11 尾巴急甩 |
| 14 | `3urjqp90` | 啪！ | quake → 新 fx `whip`（白闪 + 镜头横甩带动态模糊）；S01 巨大拍水 + A09 水花（延后 90ms） |
| 15 | `2g8ulb4e` | 被拍得横着飞出去三米多远…… | 去掉 redflash；新氛围 `underwater`（蓝色滤镜 + 上浮气泡 + 画面轻漂，配乐/环境音压低发闷）；环境改为潮声 0.25 + A07 水下低频嗡鸣；保留 S02 落水 |
| 16 | `u5c3u7fa` | 笔记本脱手，在空中划出一道绝望的弧线—— | 新氛围 `slowmo`（缓慢推近 + 褪色 + 暗角，环境声压到约 15%）；文字前停 0.3 秒；打字 ×2.2 |
| 17 | `opening_notebook_cry` | 不！！！！！！！！ | fx `zoom` 冲击推近；潮声回到 0.8 |
| 18 | `opening_notebook_pause` | 在那—— | 文字前停 0.45 秒（半拍），打字 ×1.5，`wait 0.7` 后自动接 #19 |
| 19 | `1ab8nnfn` | 一只手接住了它。 | 闪白切 C01：trans flash 改为 `trans cut + fx flash`（原 trans flash 的白幕被整屏交叉淡化的旧画面盖住，实际看不到白闪；现在硬切同时白闪）；见面曲「翡翠之梦」从这一句进（原 #21），`_musicCue` 移到这里 |
| 20 | `opening_mysterious_rescuer` | 你看着眼前这个…… | 见面曲延续；trans 仍是 flash（同一张 C01，不触发，保持原样） |
| 21 | `58oo02cv` | 「人类。」 | 只去掉已移到 #19 的 `_musicCue` |

#### 播放器改动（index.html，文件夹版和单文件构建共用）

全部是小而独立的追加，旧效果不变：
- fx `whip`「横甩(白闪+甩镜)」：`#stage.whip` 0.62s 横向 −11%→+6%→0 平移 + blur 18px→0，同时白色 veil。编辑器 FX 列表里可选。
- 氛围 `underwater`「水下」：`#bgEl/#layer` 蓝调滤镜 + 轻模糊，`#moodFx` 蓝色渐层 + `::after` 多层径向渐变气泡上浮动画，`uwDrift` 轻漂。
- 氛围 `slowmo`「慢动作」：`slowPush` 9s 推近到 1.08、褪色、暗角。
- 声音发闷：`MOOD_DUCK`——underwater 配乐 ×0.35、环境 ×0.45；slowmo 配乐 ×0.5、环境 ×0.15；进出氛围时 300ms 过渡。只压音量，没有做低通（文件夹版以 file:// 打开时 Web Audio 接媒体元素会被视为跨域而静音，风险大，未采用）。音效不压。
- 句字段 `typeMul`（本句打字速度倍率，>1 更慢，上限 4）和 `holdMs`（文字出现前停顿毫秒，上限 3000；点一下照常直接显示全文）。快进时两者都不生效。编辑器暂无输入框，只在 game.js 里写。
- `showPlay` 清除瞬时特效类时加上 `whip`。
- `trans: cut` 现在是真正的硬切：整屏 360ms 交叉淡化（VN_FADE）对 `cut` 句跳过。此前全作没有任何句子用 `cut`（fade 3224 / black 82 / flash 8 / none 1），只影响本次 #10–19。

#### 新背景 B02T「浅滩_指尖触尾」

- Sunburst（`gpt-image-2.5-sunburst`，high，3840x2160，CC=2）出 2 张候选，参考图：B02（缩 1920 宽）+ L01 尾鳍裁图（腿与裙子涂白）。
- 选第 1 张：两片尾鳍可辨认、触点（约画面中线）在对话框之上、手部自然；尾巴斑驳蓝、浅色腹面、波浪分界、深蓝描边；只露尾尖，没有旋纹。第 2 张（单片尾鳍、手指略僵）未入库。
- 入库：`content/assets/art-upgrade/originals/B02T.webp`（无损母版）、`B02T.generation.json`、`prompts/B02T.txt`、`runtime/B02T.webp`（q90）、作品目录副本 `assets/art-upgrade/B02T.webp`；`runtime-manifest.json` 在 B02 后加 B02T；game.js 新资产 `b02t_tc01`。

#### 音效与配音

- 拍水/水花/急甩/落水/水下嗡鸣全部是仓库里队友交付的真实录音（S01、A09、S11、S02、A07），没有合成。已在 `docs/production.md#content-backlog`「已有或已修」登记，无新缺口。
- #12「——！！」惊叫由用户自录：已在 `docs/collab/playtest/配音清单_重录与补录.csv` 第 994 条登记（补录，句号 12，`ktsw1bk3`）。

#### 第一话 CG 动画（未接入）

`content/assets/cg-animations/chapter1/CG01_noon_tail_slap.mp4`（1344x768，24fps，5.2 秒）这次不接进游戏。抽帧看：尾巴配色、深蓝描边、浅色腹面大体像 L01，但旋纹在两片尾鳍之间换位置、尾巴与人物分离（远处单独露出水面，看不出从后腰长出），整段没有拍水动作，分辨率也低于现行 3840 背景。是否采用留给用户决定。

#### 实际验证与交付

- 全作回归（fix6/reg.py，3315 节点逐句 showPlay）：nbad 0、nerrs 0；存读档变量一致。
- 编辑器往返（tools/check_editor_roundtrip.py）：JSON / 单文件 HTML / 文件夹导出全部 ok。
- Playwright 逐句走 #9–21：fx/氛围/配乐/环境音量按上表生效，无页面错误；截图拼图在本地（未入库）。
- 单文件试玩版按推送后的 sha 重建（本地，未入库）。

#### 下一位 agent 的接续点

- 用户试玩后可能要调：各句 `typeMul/holdMs/wait` 数值、`MOOD_DUCK` 压低比例、whip 甩幅。
- #12 惊叫配音到位后在该句 `voice` 字段登记。
- 若想要真低通：需要先把音频改由 fetch→AudioBuffer 播放或只在 http(s) 下启用，单独评估。

<a id="source-062"></a>

## 玩家视角全面打磨

原文档：`docs/collab/work-ledger/player-experience-polish.md`；整理前 SHA-256：`deac3867956e6c4d05f91490bf522205c7f561c0786d71df0e618feed075ce1e`。

- 执行：Codex；音乐负责人授权重新全面打磨。
- 状态：已打磨、已验证；基线 `44a15a3f539b0da355aa17b3d0f73bf783be655a`。
- 分支：`polish/player-experience`；开工远端无新增提交及开放PR。
- 入口：现有统一游玩与托管作品页，不另造游戏副本，不命发行版本。

#### 范围与取舍

审查实际画面、阅读、菜单、选择、存读档、声音与节奏；按全部不同背景/立绘组合取实机截图，不把截取转场中间帧当作稳定画面。角色与人物CG沿用暂缓制作的决定，缺素材列清单。保留3308节点、剧情文字、变量、跳转、游戏ID与团队原件。

首轮明确问题：默认空手账挤小主画面；窄窗口侧栏遮盖人物；设置先显示模型而非玩家阅读项，部分白色按钮对比失衡；试听页显示大量候选技术标签与浏览器默认按钮；空存档没有明确状态；键盘菜单焦点与剧情快捷键有交叉。先修复这些可验证的体验问题。

#### 交付范围

只改运行作品index.html/game-polish.css与外层vn页的HTML/JS/独立样式；game.js及所有图片/音频原件未改。新增字号为浏览器玩家偏好，不改节点或存档定位。模型设置与插件仍可使用，不覆盖成员后端。

<a id="source-063"></a>

## 试玩账本反馈修复（2026-10-18）

原文档：`docs/collab/work-ledger/playtest-ledger-20261018.md`；整理前 SHA-256：`250158add721a2d53da37aec93bd4313d106d19986f7cc95ff37d89def826476`。

来源：用户用单文件试玩版的「对白账本」导出的批注（docs/collab/playtest/账本_20261018_0105.json）。

| 台词 | 问题 | 处理 | 状态 |
|---|---|---|---|
| #24 irma08fi（L05 鲸鱼小姐_生气） | 抠图没抠干净、脏 | 原图压白底后用本地 isnet-anime 重新抠图 + 白边去污（不再用模型直接出透明底），头发外侧白雾/残影去掉 | 已修 |
| #40 wxlmihwk（P14 翻开笔记本检查） | 笔记本左右页大小不一 | Image2.5 只改笔记本，左右页对称；再本地抠图 | 已修 |
| #82 dmbm0jfv（浅滩_午后） | 下午和正午同一张图，看不出在晒笔记本 | 新背景 B02A「浅滩_午后_晒笔记本」：午后金色光、礁石上摊开的笔记本和压着石子的散页；第一话 #80–#137 改用它（其它章节的 浅滩_午后 不变） | 已修 |
| #82 同上 | 晒笔记本要有 CG | 新 CG「晒笔记本」CG_DRY：以 B02A 为底，礁石上晾着笔记本与散页，她抱臂站在三米外齐膝水里"监视"，鲸尾从后腰出；第一话 #80–#83 用 CG，#84 起回 B02A+立绘。第一人称擦本子版本模型反复画成美人鱼下半身，弃用 | 已修 |
| #93、#136 jpgy8sfu / s8tmtnhe（P06 常服戒备中好奇） | 图很诡异 | 整张重画：别脸抱臂、偷瞄，照 P01 的脸、服装和 C05 鲸尾标准 | 已修 |

说明：立绘分辨率 1024×1536 是生成尺寸，游戏里显示约 1000 像素高，不存在被放大；P14 的问题是生成本身画歪。

抠图新流程（之后所有立绘照此）：模型出白底图 → rembg isnet-anime 取 alpha → 阈值收紧去雾 → 按白底反解边缘颜色去白边。脚本见工作区 fix2/mat.py（未入库）。

#### 第二批（账本 01:14）
| 台词 | 问题 | 计划 | 状态 |
|---|---|---|---|
| #161 帐篷_黄昏 B15 | 上一张 O12 门口有烤鱿鱼，切到帐篷图鱿鱼没了 | 做 B15 变体：帐篷门口那串烤小鱿鱼，第一话 #161–#167 换成新背景 B15A「帐篷_黄昏_门口烤小鱿鱼」（门口小木桌+一盘烤小鱿鱼，与 O12 一致） | 已修 |
| #400 深海_珊瑚礁 | 场景切换割裂 | 用户自己想方案，先记着 | 用户处理 |
| #439 CG C06 深海之光 | 图很好，水下脚上不该穿鞋 | 仅脚部区域截取放大重画为赤脚，羽化合成，其余不变 | 已修 |
| #453 L19 潜水 | 膝盖方向错、尾巴没从背后长出 | 整张重画（回眸拎裙），膝盖朝向与脚一致，尾根从后腰裙下出 | 已修 |
| #529/#585/#636 L13/L14/L15 吊带裙 | 尾巴和前面不统一 | L13–L16 只换尾巴为 C05 标准鲸尾（扇贝分界、双翼尾鳍、新月纹），人物不动 | 已修（L13 尾巴偏小，待验收） |
| #816 P03 裹毯夜谈怔住 | 头发和前一张 L35 割裂 | 只改头发对齐 L35，去掉左侧半透明鼓包 | 已修 |

#### 操作：方向键翻句（用户 01:16）
- 引擎 index.html：→ = 下一句（同空格/回车），← = 回到上一句；控制栏最左加「上一句」按钮。
- 回退时变量（好感等）、回看记录一起退回到那一句进入前的状态；可退回选项句重新选。历史从本次开始游玩/读档处算起，最多 500 句。

#### 第三批（账本 01:33 + 截图 01:50）
| 台词 | 问题 | 处理 | 状态 |
|---|---|---|---|
| #1311 otj3frsj（L03 害羞） | 发梢一圈白边；问为何不直接出透明底 | 白底合成后本地 isnet-anime 重抠去白边。说明：Image2.5 直接出透明底时边缘留半透明白雾（就是看到的"脏"），所以改为白底生成+专用动漫抠图 | 已修 |
| #1321 k6abs9mx（L01） | 没问题 | — | 保持 |
| #1331 2sr3f82h（L06 慌乱） | 尾巴从两腿间穿到前面 | 只改尾巴：后腰出、绕到身后上扬，双腿完整露出 | 已修 |
| #1515 4oeeyc4i（C12 CG_电话） | 手有小问题 | 截取手部区域放大重画（她握手机的双手、左下伸来的手），羽化合成回原图 | 已修 |

#### 第四轮：全量审视（2026-10-18 02:06–，用户睡前要求"从头到尾仔细审视一轮，显眼问题能搞定的就改，剩下的列出来"）

方法：按 game.js 实际用到的 120 个素材（50 立绘 + 70 背景/CG），带首次句号与使用次数拼成对照表逐张看，再放大复查可疑处。

##### 本轮已修
| 素材 | 首次句 | 问题 | 处理 |
|---|---|---|---|
| 泳装 nvgbi1x6 → L37 | #3045 | 仍是旧版素材：发色偏黑、外套+短裙、鳗鱼状尾巴，与全片画风不符 | 按现行角色与 C05 鲸尾标准重画：深蓝泳装、白过膝袜一边滑落 |
| 泳装害羞 jtp36q4e → L38 | #3035 | 同上 | 同上，脸红、耳鳍泛红、拽裙摆 |
| P17 坐姿嗔怪 | #2895 | 发色淡紫、黄发夹、无袖，和 P13/P15/P16 不是一套 | 以 P16 为底只改表情和手势 |
| L09 常服认真验收 | #2013 | 裙下看不到腿，尾巴像美人鱼下半身 | 补出双腿鞋袜，尾巴改为后腰附加 |
| L13 吊带裙 | #522 | 尾巴悬空、看不到尾根 | 尾根接后腰，沿腿侧垂下 |
| L06 慌乱 / P03 怔住 | #32 / #816 | 抠图后脚下、发梢残留灰色投影 | fix3/deshadow.py 去投影 |
| C13 深水区 | #1719 | 水下仍穿鞋袜（同 C06 问题） | 改赤脚，局部合成 |

##### 留给你决定 / 未修
1. #3035 台词写"蓝黑色的长发""拢在一侧"，全片立绘都是亮蓝长发；新 L37 也没把头发拢到一侧。改台词还是改图？
2. L03 害羞（用 251 次）尾巴明显比其它立绘小一圈。
3. L15 吊带裙害羞：右胯后尾根处有块深灰色色块。
4. C13 改赤脚后，脚踝留着一圈白色袜口痕，看着像脚链。
5. C05 入水回头：裙下胯部画得像裸露皮肤和褶皱，不像有内衣，偏暴露。你定过第 10 版，没敢动。
6. C20 尾巴缠手腕：尾巴过长、像蛇。
7. 浅滩_正午 / 上午 / 午后 三个时段共用 B02 同一张图；沙洲_上午 B08 与沙洲_午后 B09 几乎一样。光线没有时段差。
8. #400 深海场景切换（等你方案）。

#### 第五轮（10-18 10:35）L06 发丝镂空
- 用户：发丝之间的蓝色不该有，应由 Image2.5 直接出透明底。查明：浅蓝是白底生成时模型自己画进发卷之间的，不是抠图残留。
- L06 改为 Image2.5 直接透明底生成（发丝间真实镂空），首版尾巴跑到腿间，再做一次透明底编辑去掉；尾巴形状位置与上一版一致（用户认可此图尾巴，作为其它图的尾巴基准）。
- 立绘流程改为：Image2.5 background=transparent 直出 → 轻度去薄雾（alpha<16% 清零），不再白底+rembg。
- 10:56 用户：新 L06 腿不对（膝盖拧在一起、右大腿接错、腿间夹一缕蓝）。以旧版腿为参照透明底重画，只把裙下腿部区域羽化合成回来，头发镂空与尾巴保持不变。
- 11:27 用户发来自己改好的 L03 害羞（白底 1254x1254），要求换进游戏。处理：抠图，去掉发丝间残留的白色，按旧版人物高度放大约 1.25 倍放进 1024x1536 画布。原稿入库 docs/collab/playtest/。
- 11:45 用户发来自己改好的 L05 生气（透明底），已原样换入。
- 12:20 用户发来自己改好的 L07 柔和，已换入。用户规定：以后发图默认就是换图，不必重做单文件试玩版。

#### L11 尾巴对齐 L01（10-18 13:21）
- 用户给 L11 救援后红眼稿，要求 Image2.5 sunburst 照 L01 对齐尾巴。两版取第 2 版（尾鳍位置、扇贝分界最贴 L01）。人物未动，透明底。

#### 音乐切换节奏（10-18 13:44）
- 用户：「不要出现一首歌放几秒就被切」。按台词时长（配音时长或字数×0.18s+1.2s）估算每段同曲连续时长，把过短的 8 段并入前后：第二话开头直接起 E1；M2 下潜延续到第一段深海结束（原 21 秒就切 E2）；深海中间插的 E7 并入 E2；第七话开头直接起 M1；第八话主题/E5E6 交替统一为主题；第十一话末 T4 延续 E5；第十四话开头直接起 E5/E6；第十五话附近主题中间插的 M1 并入主题。停奏段不动。明细在 game.js musicPacing。
- 仍保留的 45–60 秒段：开场 E7、c2m4 T3、第三话末 E7 日记、E4 夕阳等待、晚饭 E5、浅滩夜 T4、终章两段——都是一整场戏，未改。
- 13:56 返工：sunburst 版头发不干净（用户）。改为以用户原 L11 为底，仅在 y≥700、x≥600 且非皮肤/裙子的区域合成新尾巴，头发与人物逐像素保留原稿（fix5/L11_tailonly.png）。
- 14:18 配音 #032 i99npm13「那是水流！海流懂不懂！」换成用户给的「新B 笑着嫌弃」版，原件存 docs/collab/playtest/。

- 10-18 14:38 L12 背身尾巴改为 C05 式：尾巴从后摆下钻出、裙边压住尾根（旧L12+C05 同传 gpt-image-2.5，用户选第1版），上半身保留原稿。

<a id="source-064"></a>

## 角色与场景贴合打磨

原文档：`docs/collab/work-ledger/scene-character-integration.md`；整理前 SHA-256：`0b27503f4246bf40b5fb5bce0a95abbee589eef896b4dc37baf75806519b0ebf`。

- 负责人 / 执行 agent：Codex，本次用户要求继续打磨角色与背景的贴合。
- 状态：已集成、已验证当前检查点；未完成的美术列为接续任务。
- 更新时间：2026-10-15。
- 任务分支：`fix/character-performance`。
- 基线提交：`0f44363`；开工工作区干净，远端 main 仍为 `0f6de470e5ef1b96c0dfe91605c913f15251c0b9`。
- 交付：用户最新要求先上传当前进度；推送当前工作分支，保留探索状态，不编发布版本、不自动合入main。

#### 本次目标与影响范围

逐镜检查光色、肖像大小和环境承托。已发现夜滩坐姿错误采用无坐面的 B04，夕阳和营地人物偏日光。修改原生播放器、画面微调页及 game.js 的视觉配置；不改变剧情、音乐音效、存档 ID，也不改已经返工的坐姿原件。

#### 兼容变化与交叉点

背景资产 `sceneFit` 存默认光色，立绘 `sceneFit` 可继承、关闭或自定；位置/高度仍由编辑数据控制。原生 JSON、完整 HTML 保存这些字段，纯文本剧本交接仍有既有视觉元信息限制。保留 look、暗化非说话人、灰色情绪及快速点击的异步图像保护。

#### 依赖与尚未对齐的内容

日常肖像不冒充实体远景，不为隐藏的脚画悬空脚影。光色校正只能缓和中性立绘与背景差异，不能替代有方向的光照重绘。涉水差分与原文泳装、P16 戒指分别登记，后两项不重试被拒绝的请求。

#### 实际验证与交付

1. 54个B/O背景配置轻度光色，保留look/dim/灰色情绪；逐句手动覆盖可撤销、JSON/HTML保留，单独光色会划开关联范围与时间轴片段。
2. 193句写诗周边及结局对话改为有前景岩面的B07，保留月亮；用户指出拼接与CG不一致后，提笔到诗句展示13句统一为C08，取消居中拼接写诗立绘。
3. 用户明确柜台必须一体生成，P18试摆已退选。C26用B39、C15、P18参考，订阅生图桥请求`gpt-image-2.5-flare/max`，实际1672×941/medium、模型名未回传；整图与实机检查后接入5句，不叠立绘。原PNG、提示词、参考SHA和生成回传均入库。
4. 中间状态40个有角色背景ID/38种背景抽样、14类大图、8对相邻切换、18处演出；三条第一话路线、两个窗口选项避让、快速换姿、减少动态效果和编辑调用通过。58项融合/离线检查通过；85项项目测试通过、2项跳过。最终两处CG另做实机截图，不把中间状态截图冒充最终画面。
5. 3315节点原ID/顺序、全部剧情非画面字段及103音频资产未改；118个实际播放视觉ID，其中116采用重制图、2泳装按既定人工处理。133项审核可调用，开发库472项/644文件。

本地完整离线HTML：`outputs/scene-integration/海风与布丁_场景融合试玩.html`，也同步到现有单文件入口；约158MB，仓库保存源文件/素材和打包工具，单HTML不塞入Git对象。队友可运行`python tools/build_single_file_game.py`重建。未编发行版本，当前审美仍需后续复审。

#### 下一位 agent 的接续点

首先读[专项审核与缺口](<production.md#content-backlog>)。用户明确同一动作中的立绘拼接与一体CG不一致不能仅靠滤镜掩盖，关键环境接触应一体生成或共用同一母图差分。

尚缺：半身涉水、背向擦盘、睡衣及常服抱膝、趴桌、白裙坐小桌、准确方向光，以及原文泳装和P16戒指。C26与C15的脸/灯光连续性也待下一轮，不写成全部统一。不要恢复P18柜台试摆；不要直接重跑`direct_character_scenes.py`或整体试装工具覆盖这轮CG分配与背景，重建须核对本轮场景工具和记录。

<a id="source-065"></a>

## 《海风与布丁》剧情矛盾修正 · fix9

原文档：`docs/collab/work-ledger/script-fix-20261018.md`；整理前 SHA-256：`3c52cfff3e0983bcecb395c7aa1869a569d6397cf18b7e05163b83c9292c6460`。

基于 `play/g/game.js`（= `Liyang1145/galLingS@fix/character-performance` 2ade73c，外加用户 21:30 更新的 vo_otgvk12p、vo_yh5ghjft 两条配音元数据，对应仓库 42527d6）。产出为原制作沙箱内的 `fix9/game.js`。**未推送**。

行号 # 为 0 起序号，与审查报告同一口径。改动全部按句 ID 定位；节点 3315 个不变，ID 顺序不变，第一话 #2–#166 逐字段不变，BGM/停奏字段、配音字段、选项（数量、文字、目标）都没变。

#### 静态检查（check.py，结果存 check_result.json）

| 检查 | 结果 |
|---|---|
| 节点数 / ID 顺序 / ID 唯一 | 3315 → 3315；顺序一致；无重复 |
| 第一话 #2–#166 | 逐字段相同 |
| assets 及其他顶层字段 | 与当前 play/g/game.js 完全相同（含 21:30 两条配音元数据）；只有 `lines` 和 `vars` 有变化 |
| 改动字段统计 | text 93 句，choices 1 处（只改 set），jump 3、jumpIf 3、label 3，bg 9 |
| 跳转与选项目标 | 全部存在；标签无重复；所有边仍然向后跳，没有回环 |
| 结局可达（忽略条件的图搜索） | 海风与布丁、退潮之后、番外篇一、番外篇二 全部可达；没有死路 |
| 不可达节点 | 原有的 #158/#159/#162（retired 空句）＋ R02 有意跳过的 #1994–#2020 |
| 变量 | 新增 `海星放生`；条件里用到的变量都已声明（内置“结局数”除外） |
| 蒙特卡洛（随机选择，15000 局） | 海风与布丁 70.8%，退潮之后 29.2%；番外一、番外二从选单进入都能走到各自结局 |
| 有配音但文字被改的句子 | 只有 #1769 `05ee3el4`（需重录） |

#### 需要重录或负责人留意

- **#1769 `05ee3el4` 文字与配音不符，需重录**：现在的文字是「要把我们怎么认识的，怎么在集市上买小鱼干，怎么在帐篷里吃布丁，怎么捧起那只海星——」，旧配音念的是“怎么把海星搬进鱼缸”。
- #1514 `4oeeyc4i`「主人」有配音，没改；要统一称呼，需要先按「呜！人类刚才给谁打电话呢？！」重录。
- 前 200 句台词清单.csv 不受影响（本次改动的配音句只有 #1769，不在前 200 句里）。
- 干地动作声（S06 + R13）共 7 处，列在 S06、R13 两节，方便配音效。

#### R01

**问题**：第八话结尾与第九话开头把“换个听话的”电话演了两遍，时间（搬家第一夜/第三天下午）和她的位置（端糖水在门口/在书房嚼鱼干）对不上。

**怎么改**：保留第九话完整、有配音的那一场（它和后面的抢手机、#1514 起的配音直接衔接）。第八话结尾改成同一个编辑来电的“前情”：主角只说“再给我两天”，她端糖水上楼时他没提这通电话，最后一句交代“两天后，它又响了”，正好接第九话“搬家后的第三天”。第八话这几句都没有配音。章末存档名同步改掉原来的“换个听话的”。没有跳过任何节点。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 1472 | `8f4p54b1` | text | 我叹了口气，半开玩笑，半是真的烦了： | 我揉了揉眉心，没力气争： |
| 1473 | `zcoba3lf` | text | 「行，那这样——我考虑换个听话的。」 | 「……行，我再想想办法。」 |
| 1474 | `x14pf3dn` | text | 「什么？什么叫这是我自己选的？」 | 「知道。再给我两天。」 |
| 1475 | `vtzrbklz` | text | 「那来个能写小说的。」 | 「嗯。先挂了。」 |
| 1476 | `caneibql` | text | 身后，端着桂花糖水的手—— | 身后，楼梯上传来她端着桂花糖水上楼的脚步声。 |
| 1478 | `pvqe4nho` | text | 停在了门口。 | 我把手机扣在桌上，没提这通电话。——两天后，它又响了。 |
| 1480 | `djo1xhg7` | text | 【第八话完】 存档点：换个听话的 | 【第八话完】 存档点：再给我两天 |

#### R02

**问题**：第十二话结尾 #1994–#2020 与第十三话 #2075–#2106 的“三点方案演说”“转正为合伙人”几乎逐字重复，好感结算两次。

**怎么改**：保留第十三话版本（招工之后再讲“员工成长”更顺，且有“转什么正？”的反应）。第十二话 #1993 `l7i7ovig` 加 jump → 新标签 `c12m3`（加在 #2021 `hkq3m6vy`「打烊。最后一盏灯。」），#1994–#2020 共 27 个节点保留但不再经过。被跳过段里只有 #2020 `i6e35ch0` 的 set「好感 += 10; 尾鳍 += 1」，不再结算；第十三话的 +8（`q3fviwig`）、+8（`149kqb0z`）照旧，所以这件事只算一次。被跳过段内没有选项，无配音。#2021 本来就在这里切 BGM（T4 夜曲），配乐不受影响。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 1993 | `l7i7ovig` | jump | （空） | c12m3 |
| 2021 | `hkq3m6vy` | label | （空） | c12m3 |

#### R03

**问题**：第七话后半段同一个下午出现两次“收工前”和两次“夕阳沉下去之前”，人物先在回程背上、又坐下讲故事，时间绕圈。

**怎么改**：只改叙述，排成一条线：穿过碎贝壳区（背着她）→ 走出碎贝壳区坐下歇脚，夕阳正落（讲《贝壳姑娘》，#1124 抱膝因此成立）→ 起身时发现海星 → 回程前的验收总结 → 最后一点夕阳时要珍珠 → 夜里帐篷。#1115 背景此前已是 沙洲_黄昏，没动。均无配音。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 1051 | `m9sfto61` | text | 收工前，她把那颗淡蓝色的贝壳塞进了我手里。 | 穿过碎贝壳区之前，她把那颗淡蓝色的贝壳塞进了我手里。 |
| 1115 | `lvip64kt` | text | 夕阳沉下去之前，她忽然想起什么似的，回过头。 | 走出碎贝壳区，我们在沙洲边坐下歇脚。夕阳正往海面落。 |
| 1149 | `saqg1vhn` | text | 收工前，她在潮水边发现了一颗明黄色的海星。 | 起身的时候，她在潮水边发现了一颗明黄色的海星。 |
| 1194 | `irsfbuwm` | text | 夕阳沉下去之前，她忽然想起什么似的，转过头。 | 最后一点夕阳贴着海面的时候，她又想起什么似的，转过头。 |

#### R04

**问题**：海星选“送回深水区”（c7q7b）后，后文仍写海星在家、搬回深水区、搬进鱼缸等。

**怎么改**：新增变量 `海星放生`（初值 0），选项 c7q7b 的 set 追加「海星放生 = 1」。7 处逐一处理：
- #1582 `kzr515f8`、#1585 `c0q7ryv9`（都有配音，文字不动）：放生路线用 jumpIf 跳过。#1581 `efeiv5ck` 加 jump→`c9star1`（#1583）条件「海星放生 == 1」；#1584 `53ot3kuk` 加 jump→`c9star2`（#1586）同条件。放生路线读作「她顿了顿。/零食箱也搬走了。/你要是敢趁我不在……——/零食全部没收。/让你一个人……」。被跳过的两句没有 set、没有选项。
- #1687、#1752、#2760、#3087：改成两条路线都成立的文字（见下表）。#3087 在番外一里，番外从选单进入时变量会重置，所以用中性写法而不是 jumpIf。
- #1769 `05ee3el4`（有配音）：这一句没法跳过（夹在一段连续台词中间），只能改文字：「怎么把海星搬进鱼缸」→「怎么捧起那只海星」（两条路线她都捧起过海星）。**文字与配音不符，需重录**（vo_05ee3el4）。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 1687 | `wb6pq7fp` | text | 海星没有倒回海里，零食没有没收——因为她的威胁，这次一条都没有送达。 | 零食没有没收——因为她的威胁，这次一条都没有送达。 |
| 1752 | `bcjqicvu` | text | 「你站在这里，会为了我的电话生气，会半夜回来看我一次，会把海星搬回深水区……」 | 「你站在这里，会为了我的电话生气，会半夜回来看我一次，会亲手把海星送回深水区……」 |
| 1769 | `05ee3el4` | text | 「要把我们怎么认识的，怎么在集市上买小鱼干，怎么在帐篷里吃布丁，怎么把海星搬进鱼缸——」 | 「要把我们怎么认识的，怎么在集市上买小鱼干，怎么在帐篷里吃布丁，怎么捧起那只海星——」 |
| 2760 | `8g96zoez` | text | 「如果真写不出来，今天的稿子就免了。但你要负责去收拾鱼缸。」 | 「如果真写不出来，今天的稿子就免了。但你要负责去收拾本小姐的贝壳山。」 |
| 3087 | `pqa60pza` | text | 「……再提一句，今晚你去沙滩上跟海星睡。」 | 「……再提一句，今晚你去沙滩上跟寄居蟹睡。」 |
| 1581 | `efeiv5ck` | jump | （空） | c9star1 |
| 1581 | `efeiv5ck` | jumpIf | （空） | 海星放生 == 1 |
| 1583 | `amyvc8xc` | label | （空） | c9star1 |
| 1584 | `53ot3kuk` | jump | （空） | c9star2 |
| 1584 | `53ot3kuk` | jumpIf | （空） | 海星放生 == 1 |
| 1586 | `6c06yccj` | label | （空） | c9star2 |
| 1153 | `h5ghodhs` | choice→c7q7b.set | 好感 += 4 | 好感 += 4; 海星放生 = 1 |
| — | `-` | vars | （空） | {"name": "海星放生", "init": "0"} |

#### R05

**问题**：#2727“赌约周第三天”出现在赌约兑现（早安吻）之后；#2549–#2552 早餐时已把三条当现行规矩宣布，#2605–#2607 又作为赌约条件提出；#2541“第三周的第三天”与 #2546“这一周定的最后一份”冲突。

**怎么改**：#2727 改为「赌约兑现后的第三天」；#2541 改为「第三周的最后一天」；#2549–#2552 改成只说“菜单本小姐说了算、规矩回头再立”，并只留一件小事（不许把海藻夹到她碗里），接住后面“比如？/比如海藻/上周你偷偷把海藻夹回我碗里”。三条规矩只在 #2605 起作为赌约条件出现一次。均无配音。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 2727 | `csl3yegj` | text | 赌约周的第三天。稿子，还是没交。 | 赌约兑现后的第三天。稿子，还是没交。 |
| 2541 | `hcjzl4ps` | text | 她的菜单，第三周的第三天。 | 她的菜单，第三周的最后一天。 |
| 2549 | `vrpj5iu0` | text | 「一周的菜单由本小姐定，一周之内不准重样——这是规矩。」 | 「菜单的事，本小姐说了算。」 |
| 2550 | `xd3epnxv` | text | 「你只用执行。采购，赖床不许，让店里人代劳，更不许。」 | 「你只用执行。至于怎么执行——回头再跟你立规矩。」 |
| 2551 | `9g70qgf6` | text | 她掰着手指，一条一条数。 | 她竖起一根手指。 |
| 2552 | `5gnl5vm9` | text | 「还有最后一条。本小姐吃什么，你就吃什么。本小姐不许挑食的东西，你也不许挑。」 | 「眼下先说一件：你碗里的东西，不许偷偷夹到本小姐碗里。」 |

#### R06

**问题**：珍珠数量：藤箱一颗（#1296）、饰品巷买一颗、珍珠摊再选一颗，银匠铺两颗镶成一对戒指，第十六话又出现带天青珍珠的银链；#2192 把“家里那颗”说成三天前。

**怎么改**：定为三颗：饰品巷那颗 + 珍珠摊那颗 → 一对戒指（与 #2194「两颗珍珠」#2196「第二颗珍珠」一致）；藤箱那颗 → 银链（#2196 的贝壳项链换成银链）。#2192 改成「很久之前」——就在今天早上（她早上刚翻藤箱找到它，#2162）。第十六话两处银链明确写“藤箱里那颗”。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 2192 | `suonw5bo` | text | （尾鳍悬停。「很久之前」——三天。） | （尾鳍悬停。「很久之前」——就在今天早上。） |
| 2940 | `nspynsn1` | text | 天青色的珍珠贴着锁骨，像一颗坠在陆地上的海。 | 藤箱里那颗天青色的珍珠，如今坠在银链上，贴着锁骨，像一颗坠在陆地上的海。 |
| 2978 | `jb79ngo4` | text | 天青色的珍珠，在她掌心里转了一圈。 | 银链上坠着藤箱里那颗天青色的珍珠，在她掌心里转了一圈。 |

#### R07

**问题**：第十六话说“礁石后看了三天”“第四天才想出‘路过’”“糍粑是海鸥送错的”，与新第一话（醒来当场摸到她尾巴、糍粑是她当面给的“酬劳”、她先喂了海鸥一块）矛盾。

**怎么改**：只改第十六话：改成她前一天感觉到他，第二天把昏睡的他推上浅滩、守了一上午，他醒来摸到尾巴尖时她才临时编出“路过”；糍粑一句改为“你以为真是酬劳？那本来不是给你的”，接原有的「那本来是给谁的？」「给本小姐的！」。#2952 的「三天礁石」随之改为「浅滩上那一上午」（这一句原意可能是指第十话主角守在水线边的几天，有歧义；若文案原意如此，可改回）。第十六话这些句子都没有配音。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 2908 | `43dcjtyw` | text | 「第二天，你醒了。抱着你的本子，坐在水底下发呆。」 | 「第二天，是本小姐把你从深水那边推上浅滩的。你抱着本子，睡得像块木头。」 |
| 2909 | `sfgxomrb` | text | 「本小姐在礁石后面，看了三天。」 | 「本小姐就在你旁边，守了一整个上午。」 |
| 2910 | `69nugc0p` | text | 「看你给本子擦水。看你写那些看不懂的字。」 | 「看你睡着了都抱着本子不撒手。看本子里那些看不懂的字。」 |
| 2911 | `rwd3qe0r` | text | 「看你对着大海念叨『智能的原理』。」 | 「听你说梦话，念叨『智能的原理』。」 |
| 2912 | `pevt6ns0` | text | 「看你啃了半块泡烂的糍粑——那是海鸥送错的，本来不是给你的。」 | 「还有那半块糍粑。你以为真是酬劳？那本来不是给你的。」 |
| 2917 | `my1hybkh` | text | 「重点是，第四天，本小姐才想出来『路过』这个理由。」 | 「重点是，你醒过来摸到尾巴尖那一下，本小姐才临时想出『路过』这个理由。」 |
| 2918 | `fde1uw7m` | text | 「想了三天，就只想出来这个。」 | 「守了一上午，就只想出来这个。」 |
| 2923 | `4d7rdwgb` | text | 『她说「看了三天」的时候，忽然明白了什么，声音低下去——』 | 『她说「守了一上午」的时候，忽然明白了什么，声音低下去——』 |
| 2952 | `qul76av0` | text | 『是四十次焦糖。是三天礁石。是桂花不断供。』 | 『是四十次焦糖。是浅滩上那一上午。是桂花不断供。』 |

#### R08

**问题**：第七话起 13 句叫主角“主人”，同段自称常由“本小姐”变“我”；第十四话主角突然叫她“亲爱的”。

**怎么改**：“主人”→“人类”（必要时补“你”使句子通顺），同一段里的自称“我”→“本小姐”，只改语气不受影响的句子；“呜”等语气词保留。
- 保留不改：#3102 `2qjpljhf`「喊主人。」——番外一女仆装情境，她在列举“女仆装、喊主人、买珍珠”这些会被误会的事，是有意为之。
- 保留不改（有配音）：#1514 `4oeeyc4i`「呜！主人刚才给谁打电话呢？！」，同段 #1519 `ots5j0of`「还是嫌我帮不上你写书的忙？！」。要统一的话需要先重录，再改成「呜！人类刚才给谁打电话呢？！」。
- “亲爱的”三处（#2323、#2350、#2473）删掉称呼。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 1006 | `gddlochb` | text | 「主人快点讲，她到底说了什么？」 | 「人类，快点讲，她到底说了什么？」 |
| 1062 | `789u6831` | text | 「呜……主人讲这个故事，是什么意思？」 | 「呜……人类，你讲这个故事，是什么意思？」 |
| 1066 | `ck1far20` | text | 「我警告你。你要是敢回答『是』——」 | 「本小姐警告你。你要是敢回答『是』——」 |
| 1067 | `2aks90oo` | text | 「我现在就跳下去，自己游回深海，让你一个人慢慢找更美的贝壳去！」 | 「本小姐现在就跳下去，自己游回深海，让你一个人慢慢找更美的贝壳去！」 |
| 1073 | `nfjied5l` | text | 「就算你以前是个不会挑贝壳的笨蛋——至少，你最后遇到了我。」 | 「就算你以前是个不会挑贝壳的笨蛋——至少，你最后遇到了本小姐。」 |
| 1125 | `426sxbet` | text | 「呜！主人这个故事是什么意思！」 | 「呜！人类，你这个故事是什么意思！」 |
| 1131 | `davjddhk` | text | 「而且我才不会每天晚上偷吃你准备的零食——」 | 「而且本小姐才不会每天晚上偷吃你准备的零食——」 |
| 1132 | `tolq52wt` | text | 「我都是当着你的面，光明正大吃的！」 | 「本小姐都是当着你的面，光明正大吃的！」 |
| 1228 | `ze49o299` | text | 『另：她说「我都是当着你的面光明正大吃的」。』 | 『另：她说「本小姐都是当着你的面光明正大吃的」。』 |
| 1137 | `rk6e6vg8` | text | 「我不管，如果这个故事里还要有什么贝壳姑娘——」 | 「本小姐不管，如果这个故事里还要有什么贝壳姑娘——」 |
| 1138 | `6iizj03u` | text | 「那她也只能是我！」 | 「那她也只能是本小姐！」 |
| 1140 | `yxubctia` | text | 「我就把你绑在礁石上，让海鸥来啄你的头！」 | 「本小姐就把你绑在礁石上，让海鸥来啄你的头！」 |
| 1145 | `onlwirdv` | text | 「还有——接下来换你当贝壳姑娘，我来当捡贝壳的。」 | 「还有——接下来换你当贝壳姑娘，本小姐来当捡贝壳的。」 |
| 1146 | `tuwz6do2` | text | 「我每天给你喂……喂布丁！」 | 「本小姐每天给你喂……喂布丁！」 |
| 1195 | `vyb3i318` | text | 「喂，主人。」 | 「喂，人类。」 |
| 1197 | `f6nndjrj` | text | 「那我的珍珠呢？」 | 「那本小姐的珍珠呢？」 |
| 1201 | `u1nu6e9q` | text | 「明天除了海盐奶油蛋糕和芒果酸奶，你还得给我找一颗真的珍珠来。」 | 「明天除了海盐奶油蛋糕和芒果酸奶，你还得给本小姐找一颗真的珍珠来。」 |
| 1202 | `3nnvr3w2` | text | 「要那种带着海水温度的，我才认账。」 | 「要那种带着海水温度的，本小姐才认账。」 |
| 1923 | `0f95kmna` | text | 「……主人这是给谁打的电话？」 | 「……人类，你这是给谁打的电话？」 |
| 1946 | `nkh1ywm2` | text | 「主人。这就是你说的，『很快就能找到』的地方？」 | 「人类。这就是你说的，『很快就能找到』的地方？」 |
| 2328 | `1pyd6tl0` | text | 「呜……主人这话是什么意思。什么叫做把我们的记忆安置好了，什么叫做本小姐会记错细节。」 | 「呜……人类，你这话是什么意思。什么叫做把我们的记忆安置好了，什么叫做本小姐会记错细节。」 |
| 2329 | `hruipkpp` | text | 「我可清醒得很。你说说看，我把哪件事记错了？」 | 「本小姐可清醒得很。你说说看，本小姐把哪件事记错了？」 |
| 2330 | `hag21xqo` | text | 「要是你说不出个所以然来，我可要当你是在故意编造奇怪的理由，逃避今天的采购任务。」 | 「要是你说不出个所以然来，本小姐可要当你是在故意编造奇怪的理由，逃避今天的采购任务。」 |
| 2354 | `ek5d340t` | text | 「呜！主人今天是不是存心来气我的？」 | 「呜！人类，你今天是不是存心来气本小姐的？」 |
| 2389 | `b5x65ife` | text | 「呜。主人现在知道错了？」 | 「呜。人类现在知道错了？」 |
| 2391 | `bc1p4als` | text | 「我告诉你。带鱼不是我不想要——」 | 「本小姐告诉你。带鱼不是本小姐不想要——」 |
| 2392 | `erzib74e` | text | 「是你今天的态度，让我很不高兴。」 | 「是你今天的态度，让本小姐很不高兴。」 |
| 2510 | `2zz2du9p` | text | 「主人。」 | 「人类。」 |
| 3190 | `2f4xv901` | text | 「主、主人怎么把这两颗贝壳串起来了？」 | 「人、人类，你怎么把这两颗贝壳串起来了？」 |
| 2323 | `tyvi8695` | text | 「亲爱的。」 | 「跟你说件事。」 |
| 2350 | `x4g7su2j` | text | 「这不怪你。亲爱的，我已经记录了我们的记忆。」 | 「这不怪你。我已经记录了我们的记忆。」 |
| 2473 | `1h0nmugs` | text | 「亲爱的。你喜欢这个想法吗？」 | 「你喜欢这个想法吗？」 |

#### R09

**问题**：随机选择下只有约 1.2% 进“退潮之后”。

**怎么改**：只调阈值：#2933 `uxdrpmrb` 的 jumpIf「好感 < 320」→「好感 < 362」，选项分值不动。用脚本按引擎规则做蒙特卡洛（每个可见选项等概率，含限时选项的沉默项，从第一话开始，结局数=0），这次修改后（含 R02 少算的 10 点）判定点好感分布约为：1% 307、10% 338、25% 358、30% 362、50% 379、90% 415。结果：15000 局里 29.2% 进“退潮之后”（另一组 12000 局为 28.5%）。按两条海星路线拆开，两个结局都能到。认真选好的选项仍远高于 362（理论上限约 561）。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 2933 | `uxdrpmrb` | jumpIf | 好感 < 320 | 好感 < 362 |

#### R10

**问题**：暗号编号缺第九、十条；【碎片】从其十四开始；几处叙述滑到第三人称“他”；#854“十五年”。

**怎么改**：#1399 第十一条→第九条（第四到第九条从此连续）。#1610 原来写“暗号手册第八条失灵”，可第八条是“光明正大”，改成「沉默这一招，第一次失灵了」，接下句「沉默不再是满分」。【碎片】重编为其一到其五：#2129（c13q2a）和 #2149（c13q2c）在互斥分支里，都编“其一”，每个玩家只看到一个。#853 他→我；#854「你找了十五年」→「我找了十五天」（全文都是十五天，前文有 #470、#793）；#2626「他喝了」→「我喝了」。
- 保留不改：#1800 `1e4r74cv`、#1801 `geex1uj1`：这是她看到油布里的笔记本时，从她的视角“忽然明白了——他背下来的”，属于有意的她的视角。#2133 等『』碎片本来就是她的视角，也不改。
- 本次没有处理的 R10 子项：贝壳项链来历（D10）、番外一围裙/外套先后（D14）。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 1399 | `4q1fiimp` | text | 「这个条款，写进暗号手册。第十一条。」 | 「这个条款，写进暗号手册。第九条。」 |
| 1610 | `fytjxaxo` | text | 『另：暗号手册第八条，第一次失灵了。』 | 『另：沉默这一招，第一次失灵了。』 |
| 2129 | `khih9brj` | text | 【碎片·其十四】 | 【碎片·其一】 |
| 2149 | `w4ubqg1u` | text | 【碎片·其十五】 | 【碎片·其一】 |
| 2242 | `wx5k8zr1` | text | 【碎片·其十六】 | 【碎片·其二】 |
| 2300 | `257o0qib` | text | 【碎片·其十七】 | 【碎片·其三】 |
| 2366 | `m0h78duq` | text | 【碎片·其十八】 | 【碎片·其四】 |
| 2516 | `rapy8n8f` | text | 【碎片·其十九】 | 【碎片·其五】 |
| 853 | `lezxw6p2` | text | 他没有说出口的是—— | 我没有说出口的是—— |
| 854 | `p5jjwnj3` | text | 这不就是你找了十五年的答案吗。 | 这不就是我找了十五天的答案吗。 |
| 2626 | `hq0s5hxx` | text | 第一周。周一，海鲜粥。周二，贝肉蒸蛋。周三，深海海藻蛋花汤——他喝了，没皱眉。她验收，『表情勉强合格。』 | 第一周。周一，海鲜粥。周二，贝肉蒸蛋。周三，深海海藻蛋花汤——我喝了，没皱眉。她验收，『表情勉强合格。』 |

#### R12

**问题**：“蓝黑色长发”与亮蓝立绘不符。

**怎么改**：第一话以外的 7 处“蓝黑色”→“亮蓝色”（#171 发顶、#438、#474、#1597、#1671、#1845、#3035）。第一话的 2 处按规定不动：#62 `no3hzp1r`「蓝黑色的长发在水里铺开」、#150 `4l0q4r5l`「蓝黑色的长发在水面上留下一道弧线」。#1712「蓝黑色的、没有星星的、深水区的黑」写的是海水，不是头发，不改。#1671、#1845 带有入水音效（整句触发），改字不影响。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 171 | `h2tzp1sk` | text | ……以及礁石后面，露出的一小截蓝黑色的发顶。 | ……以及礁石后面，露出的一小截亮蓝色的发顶。 |
| 438 | `n910kr47` | text | 她仰着头，蓝黑色的长发在水里散开。 | 她仰着头，亮蓝色的长发在水里散开。 |
| 474 | `7uc2ce54` | text | 我的手指拨开那缕蓝黑色的长发。 | 我的手指拨开那缕亮蓝色的长发。 |
| 1597 | `8hypo8dx` | text | 蓝黑色的长发在水面上留下最后一道弧线。 | 亮蓝色的长发在水面上留下最后一道弧线。 |
| 1671 | `v84tpy1e` | text | 蓝黑色的长发没入水面。 | 亮蓝色的长发没入水面。 |
| 1845 | `vot6c0xu` | text | 蓝黑色的长发没入水面。 | 亮蓝色的长发没入水面。 |
| 3035 | `2y38jh12` | text | 蓝黑色的长发拢在一侧，耳鳍通红。 | 亮蓝色的长发拢在一侧，耳鳍通红。 |

#### R13

**问题**：#2427（集市街道）、#2450（店内）写尾巴“在水里”。

**怎么改**：改成干地上的动作：尾巴垂下、拖在身后；尾巴尖从地上抬起一点。两句都是尾鳍信号（各有「尾鳍 += 1」，没动）。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 2427 | `gqkrx13n` | text | （整条尾巴，沉在水里。一动不动。） | （整条尾巴垂了下去，拖在身后。一下都没有摆。） |
| 2450 | `4smyo4io` | text | （尾巴尖从水里浮起来一点点。还没翘。只是不再沉着了。） | （尾巴尖从地上抬起来一点点。还没翘。只是不再垂着了。） |

#### S06

**问题**：干地拍水 5 处：场景在集市或室内，却写“尾鳍拍水”。

**怎么改**：改成拍地面、地板或柜台，方便配“拍地/拍木头”类音效（这 5 句目前都没有 seEvents）。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 580 | `vnymith9` | text | （尾鳍拍水一下。） | （尾鳍拍了一下地面。） |
| 624 | `33rrox32` | text | （尾鳍拍水一下。） | （尾鳍拍了一下地面。） |
| 1534 | `6d8dd6m2` | text | （尾鳍拍水一下。不重。比拍沙那次轻得多。） | （尾鳍拍了一下地板。不重。比拍沙那次轻得多。） |
| 1539 | `c2556srw` | text | （尾鳍拍水一下。） | （尾鳍拍了一下地板。） |
| 2064 | `8q6fi63f` | text | （尾鳍拍水一下。） | （尾鳍拍了一下柜台。） |

#### R14

**问题**：#328 深夜写日记用的是 礁石_夜；#3133 老奶奶出现在 集市_珍珠摊，但前文她的摊子在饰品巷（#3125「看向饰品巷的方向」、#3127「巷口老奶奶的摊子」）。

**怎么改**：#328：#328–#343 整段都是 礁石_夜（还有浪声环境音），只换一句会闪背景，所以只改文字，交代“天黑透了，我还坐在礁石上”，背景不动。#3133–#3141（9 个节点）的背景从 集市_珍珠摊（hihrcqx5）换成 集市_饰品巷（p8guxpyy），立绘、BGM、环境音都没动。#3302 起的配乐按要求不动。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 328 | `qmcoedvg` | text | 我翻开笔记本，契约那一页的最下方，多了一行不是她写的、也不是我写的字。 | 天黑透了，我还坐在礁石上。翻开笔记本，契约那一页的最下方，多了一行不是她写的、也不是我写的字。 |
| 3133 | `d2by7sop` | bg | hihrcqx5 | p8guxpyy |
| 3134 | `ygjuk30q` | bg | hihrcqx5 | p8guxpyy |
| 3135 | `fbn63uta` | bg | hihrcqx5 | p8guxpyy |
| 3136 | `7ymzppb2` | bg | hihrcqx5 | p8guxpyy |
| 3137 | `77xb0qrx` | bg | hihrcqx5 | p8guxpyy |
| 3138 | `p8qfa6a3` | bg | hihrcqx5 | p8guxpyy |
| 3139 | `kckvx43n` | bg | hihrcqx5 | p8guxpyy |
| 3140 | `xyhiph9f` | bg | hihrcqx5 | p8guxpyy |
| 3141 | `gvuo4ujc` | bg | hihrcqx5 | p8guxpyy |

#### N05

**问题**：#400 从深水区黑暗直接切到发光珊瑚礁，显得割裂。

**怎么改**：图不动。在切图的那一句 #399（深海_珊瑚礁 的第一句）前面加过渡「她拉着我又往下沉了一段。」，#400 原文不动。

| # | ID | 字段 | 原 | 新 |
|---|---|---|---|---|
| 399 | `smyc1237` | text | 是从海床深处，一点一点亮起来的、蓝色的、星星点点的光。 | 她拉着我又往下沉了一段。然后，是从海床深处，一点一点亮起来的、蓝色的、星星点点的光。 |

<a id="source-066"></a>

## 《海风与布丁》本轮修改记录

原文档：`docs/collab/work-ledger/settings-rollback-ui.md`；整理前 SHA-256：`5194d9374fb9dcf9d148fd49c9c7ea82c2910b95e3283d5f56fd020b9e659372`。

> 用于 GitHub 版本更新说明。修改对象为当前试玩版单文件 HTML；本轮没有改动配乐工作台。

#### 更新文件

- 正式游戏：`海风与布丁_试玩版_账本 (4).html`
- 本轮原始备份：`海风与布丁_试玩版_账本 (4).original-20261019-020018.html`
- 本轮验证副本：`海风与布丁_试玩版_账本 (4)-设置优化版.html`

#### 版本范围

本轮将此前验证通过的“设置与回看 UI”改动正式写回游戏本体。原始游戏在写回前已备份，备份 SHA256 为：

`c50613b70846e8a71811cdfc14c3e1c57faa5cc3d7d498cca074a958d6febe00`

写回后的正式游戏 SHA256 为：

`c1d1c9c3b7ee5fac6483a723a83c1bb6af621ec5d7bb2388b30e67ad98232781`

#### 功能修改

##### 1. 对话历史记录支持回退

在游戏内“对话回看”列表的每条历史记录下增加“回退到这里”按钮。

点击后会：

- 回到选中对白节点；
- 恢复进入该句前的变量状态；
- 截断该句之后的回看历史；
- 清理自动播放、快进和限时选项计时器；
- 重新同步当前画面、音乐和演出状态。

回退使用剧情节点稳定状态，不是单纯把显示文字滚回去。原有手动存档和读档流程保持不变。

##### 2. 设置中增加对话框不透明度

设置页新增：

> 对话框不透明度

当前范围为 **35%–95%**，最低不透明度提高到 35%，避免文本框背景过淡而影响阅读。

旧版本如果在浏览器偏好中保存过低于 35% 的值，读取时会自动限制到 35%。该设置会实时作用于游戏内对话框背景，包括当前新版游戏的对话框皮肤伪元素。

##### 3. 设置控件采用 C「海底刻度」样式

设置页内部的滑块、按钮、开关和关闭按钮改为深海控制台风格：

- 深蓝黑色控件底色；
- 青蓝色细边框；
- 青色发光滑块；
- 方形刻度感滑块按钮；
- 悬停、焦点和按下状态；
- 移动端扩大开关和分段按钮触控区域。

样式作用域限定在 `#psettings` 设置面板，未修改主页、选项按钮、文本框、账本、回看主体或其他游戏 UI。

##### 4. 滑块进度高亮与数值显示

设置页所有范围滑块均已接入动态显示：

- 音乐：百分比；
- 音效：百分比；
- 环境音：百分比；
- 语音：百分比；
- 文字大小：百分比；
- 文字速度：毫秒；
- 自动播放等待：倍率；
- 对话框不透明度：百分比。

拖动滑块时：

1. 青色进度高亮实时移动；
2. 滑块右侧数值实时更新；
3. 设置值实时写入现有偏好系统。

#### 兼容性与边界

- 保留原项目 ID、剧情节点 ID、资产 ID、变量和分支逻辑。
- 不改变原有语音、音效、环境音和音乐编排。
- 不改变原有存档结构。
- 不改变配乐工作台文件。
- 不新增网络请求，不依赖服务器。
- 浏览器中的旧偏好会继续读取；仅对 `ghost` 不透明度增加 0.35 的下限钳制。

#### 建议提交信息

```text
feat(ui): add dialogue rollback and submarine-style settings controls
text
本次更新增加了对话回看中的“回退到这里”功能，并在设置中加入对话框不透明度调节。设置控件采用深海刻度样式，滑块支持实时进度高亮和数值显示。对话框不透明度最低为35%，以保证阅读清晰度。除设置面板和历史记录回退功能外，主页、选项、文本框及原有剧情演出保持不变。
```

<a id="source-067"></a>

## 缺失音效接入（2026-10-18）

原文档：`docs/collab/work-ledger/sfx-20261018.md`；整理前 SHA-256：`344bec315f02c0759b9aee5ee01614945d17c0ee57b61f4e3605d5e05d68a014`。

用户 12:43 交付「缺失音效.zip」（3 个 WAV），要求检查是否已装配、未装则接入。检查结果：sfx-gaps 清单中的 5 处动作声此前均未配置，现已接入。

| 节点 | 台词 | 资源 ID | 原件 / 截取区间 | 行内增益 |
|---|---|---|---|---|
| `d8i8u3h4` 第二话 | 她用笔杆敲了敲纸面。 | sfx_pen_tap_paper_double | 笔杆轻敲纸面.wav 0.10–1.22s（开头两下） | 0.45 |
| `u7y6341c` 第七话 | 尾巴在我腿边不满地拍了一下。 | sfx_tail_pat_leg_ch07 | 第七、八话轻拍.wav 0.10–0.95s（第一下，较重） | 0.6 |
| `9xk3kgzb` 第八话 | 我伸手要拿，被尾巴拍了一下。 | sfx_tail_pat_hand_ch08 | 第七、八话轻拍.wav 0.98–1.67s（第二下，较轻） | 0.45 |
| `lcxadwvr` 第十二话 | （尾鳍拍了一下。） | sfx_tail_pat_floor_ch12 | 第十二、十四话.wav 18.64–19.45s | 0.55 |
| `7ehvyu17` 第十四话 | （尾鳍在柜台下面，很轻地拍了一下。像在盖章。） | sfx_tail_pat_floor_soft_ch14 | 第十二、十四话.wav 41.93–42.55s（较轻的一下） | 0.3 |

- 处理：按区间裁出，5ms 淡入、120ms 淡出，峰值对齐 -3 dBFS，48 kHz Vorbis q6，放 assets/audio/。未降噪、未改音色。
- 原件（WAV）保存在 content/assets/audio/originals/sfx-20261018/。长录音里有多下可选，截取点是按波形挑的单次干净动作，听感由音乐负责人确认；要换哪一下告诉我时间点即可。
- 第四/九/十三话“干地拍水”5 处文案矛盾仍未处理（不是缺文件）。

<a id="source-068"></a>

## 鲸尾结构与情绪受伤误画修正

原文档：`docs/collab/work-ledger/tail-skin-corrections.md`；整理前 SHA-256：`764af6204540777ad7a9cf0351d300299d5625af5c57a4e10a1a7547b24b752f`。

- 执行：Codex；用户明确继续修改当前 Image2.5 制作批次，不使用 Larry 旧图库。
- 状态：四张修正通过对照审核，已装配并完成实机/开发页/离线验证；本轮保存在本地分支，未推送。
- 分支：`fix/character-performance`；基线 `7c50dd2`，开工干净；远端main仍为`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`。
- 范围：当前制作图的尾根/尾柄/一对鲸尾鳍、误把情绪受伤画成肉体擦伤；原图错误稿保留对照，不改变剧情或音频。

#### 已定位

| 图 | 问题 | 处理 |
|---|---|---|
| C12 电话后抢手机 | 手臂和膝部多处红色擦伤，剧情是情绪受伤。 | 去除身体伤痕，保留委屈、泪眼、手机、对白情境和室内构图。 |
| C18 鱼摊争执 | 手臂及腿部擦伤；左侧尾鳍呈单叶而非明确双叶。 | 还原健康皮肤、保留低落情绪；尾端改为一对鲸尾鳍。 |
| P09 嘴硬回望 | 正常双叶外又多长一片向上弯的尾鳍，共三叶。 | 移除多余鳍，保留回望姿态、脸、身体及透明通道。 |
| O11 月光尾鳍圈影（备用） | 末端像单片巨大叶状鱼鳍，尾柄与双叶结构不清。 | 改为一根连续尾柄与一对清楚的鲸尾鳍，保留两人和影子。 |

L10本轮复查为已去伤痕版本；原件中退选旧擦伤稿不能恢复。其他画面有裁切或正常透视扭转，不仅因看到一侧就判定多尾/缺尾。P16此前被拒绝的戒指编辑和既定原文泳装保持人工缺口，不在本轮重复尝试。

#### 兼容与验证

生成采用用户此前授权的 Codex OAuth 图片桥，请求 Image2.5/max，实际模型/质量以回传记录为准。每次修改保留旧PNG/提示词/生成元信息；修正后逐图放大看全身和尾根，再更新原ID的播放副本、开发索引与单文件游戏。不得重跑整体剧情装配覆盖已统一的写诗C08和柜台C26。

#### 实际采用与保存

2026-10-16完成同图局部编辑，不回退到Larry原件。四张PNG原尺寸不变：C12/C18/O11为1672×941，P09为1024×1536，后端回传medium、未回传模型ID；请求max不代表原生最高档或路由已核实。

| 图 | 当前源PNG SHA-256 | 剧情引用 |
|---|---|---|
| C12 | `d81231cbbfc1785e16fbae9f41c9c0074644106cc9c751fad690c0690f16a2db` | 原5句，去除手臂/膝部擦伤，保留泪眼与手机。 |
| C18 | `8674df9f0588b29ff08a68bc49d4cfc4b8acc64a1c808206f84551a9d73dd87c` | 原4句，健康皮肤、同一尾柄的明确双叶鲸尾鳍。 |
| P09 | `6f85d5b718070b94bd37011f8538c63a9a603409d857fd0644d16acfb14fb5cf` | 原11句，去除多余第三片鳍；灰底、实景复查透明边缘。 |
| O11 | `3c6e3bd002e3841ce6a529e708681ecfc5c4715f2450f146e74833ebb12e5ab8` | 0句，仅修正备用CG的单片叶状尾端，不新增剧情位置。 |

每张旧PNG、提示词和原生成/生产记录保存为`*_rejected_*`；开发库标记“退选留档”，引用0句，不自动恢复。新图审核绑定新SHA；PNG母版、runtime及游戏WebP同步；P09眼位不变，只更新acting-frames源SHA。原制作清单JSON/CSV/Markdown和当前overrides已明确“情绪受伤、皮肤无外伤”，避免后续再把文意画成伤疤。

图像对照：[审核目录](<../A素材库/art-upgrade/review/tail-skin-corrections>)。[源图、运行副本与逐句引用清单](<../A素材库/art-upgrade/tail-skin-corrections.json>)。接口/素材ID、角色动作、站位与场景光色均不改；无需改动game.js。队友接续不要调用整体剧情重装脚本覆盖写诗C08和柜台C26。

<a id="source-069"></a>

## 鲸尾统一（C05 标准）— 2026-10-17

原文档：`docs/collab/work-ledger/tail-unify-c05.md`；整理前 SHA-256：`068acf7459e6a6b5a86d49f1924d1e1c6c9fcea7a3d03fa06e006b5701b27684`。

用户要求（2026-10-17 09:56）：所有角色的尾巴，尤其转身/侧身/背面，统一按精修包 C05 的尾巴设计。

#### 标准
后腰/胯部裙下长出、根部粗壮渐细；偏紫矢车菊蓝；浅白紫腹面，与蓝色以醒目圆浪/扇贝线分界；一对翅状大尾鳍带中缝，浅色内面+羽状细棱+深蓝边；每片鳍一个白色新月旋纹。转身时尾根必须接在腰下。

#### 方法
Rinko `gpt-image-2.5` / quality=high / stream=true。立绘两步：①以 C05 尾巴裁图（及已通过的站姿立绘 L19/L29）为参考只重画尾巴，强约束保留双腿、姿势、构图；②单独抠出真实透明 alpha。CG 一步重画尾巴。

#### 结果
- 已替换：50 张立绘（54 张除 L13–L16）+ 11 张 CG（C14、C26、O04–O11、T01；O11 基于 O11_c）。
- 未替换：L13、L14、L15、L16（白色长裙）—— 4 次尝试模型都把双腿画成美人鱼下半身或完全去掉尾巴，保留上一版，待单独处理。
- 排除：P02（精修包原件）、C25（用户要求不画尾巴）。C05 为标准本身（右腿另行修正，见 2e7a671a）。
- 退选：首轮 17 张立绘腿被尾巴替换或改构图，T01 腿变尾巴，O10 尾巴未接腰；均重做后再审。
- 上一版原件/提示词/记录保留为 `*_superseded_before_tail_c05`。
- game.js 未改；同名 WebP 替换。

<a id="source-070"></a>

## 2026-10-18 傍晚 尾巴与换图

原文档：`docs/collab/work-ledger/tails-20261018-evening.md`；整理前 SHA-256：`8dbdefa71b6ceab2d206f4fa4341c910b08304c662c073894982c444a0b85c1b`。

- C05：用户朋友手修版整张替换（右手、右腿），原稿 docs/collab/playtest/C05_friend_20261018.webp。
- L37：尾巴取 L01 原尾巴像素（单一旋纹），按用户要求再加长加粗；尾根交接、头发左缘用 gpt-image-2.5 局部补。
- O11：用户朋友手修版整张替换，原稿 docs/collab/playtest/O11_friend_20261018.webp。
- C26：用户提供版整张替换（此前未接入），原稿 docs/collab/playtest/C26_user_20261018.webp。
- L14、L15：尾巴照 L16（gpt-image-2.5 双图编辑：原图 + L16），只按差异区合成回原图，灰底抠 alpha。
- L20：尾巴最终照 L12（从后摆下钻出、裙边盖住尾根）；双腿擦掉后参照 L12 腿部重画为背面（膝窝、无膝盖骨、鞋跟朝镜头），只合成裙摆以下腿部区域。
- P12：尾鳍太薄"像纸片"→ 以 L01 尾巴裁图为参考重画尾端，按差异区合回。

<a id="source-071"></a>

## 《海风与布丁》界面修复报告（fix9 重做版，2026-10-18）

原文档：`docs/collab/work-ledger/ui-fix-20261018.md`；整理前 SHA-256：`227f4aa8de211268143e6fc76067dd025e65142368f7c24637e54d54ce35e8d7`。

**结论：** 5 项都做完了，在 1280×720、390×844（竖屏）、844×390（横屏）三种尺寸下用 playwright 跑过。控制台无报错，存档读档能把变量读回来。没有推送。

#### 产出（原制作沙箱的 `fix9/ui/` 目录）
| 文件 | 说明 |
|---|---|
| `index.html` | 引擎：基于 `play/g/index.html`，按 `fix9/patch_ui.py` 改了 6 处（替换都校验过只命中 1 次，可以重放：`python3 fix9/patch_ui.py <输出路径>`） |
| `game-polish.css` | 在 `play/g/game-polish.css` 末尾加了一段 “fix9 界面体验”（前面 115 行没改） |
| `game.js` | 只改了 `settings.uiSe` 和 10 个 UI 音效素材的 `auditionOnly`，`lines` 逐项比对过，和原来一致 |
| `shots/` | 截图（`desk_* / phone_* / phoneland_*`），每次运行的数据记录在 `*_log.json` |

#### 1. 竖屏 390×844（选“就这样竖着玩”）
- `fit()`：竖屏时（高 > 宽×1.15）`body.vport`，画面按**整宽**铺满（390px，左右无黑边；初版对齐到 16 的倍数，两边各留了 3px 黑边，已经改掉），放在上方。下面从上到下依次是对话框、选项区和两排控制按钮（5+4），位置由 `--vp*` 变量用真实像素算出来。
- 实测：正文 17px，名字 16px，控制按钮 69×46px，选项按钮 360×48px、字号 16px。53 字的最长台词放得下，没有溢出（scrollHeight = clientHeight = 198）。
- 弹出层（设置、存读档、回看、章节、声音收藏）在竖屏下按 1:1 屏幕像素排版：设置项文字 18px，开关按钮 ≥44px 高，章节和声音列表改成单列。
- 点画面外：竖屏下画面本身铺满整屏，空白区点一下就推进（实测 idx 4→5）。“画面”模式（隐藏界面）下点一下会先恢复界面。
- 竖屏标题：菜单放在下半部居中，按钮 280×44px，在角色脸的下方。

#### 2. 横屏 844×390（`body.smallstage`，缩放比例 0.5375）
- 正文 15px，名字 14px，控制按钮 36px 高（9 个排一行），选项按钮 40px 高、字号 15px。最长台词（53 字，第 1121 句）两行放下，没有溢出。
- 左右黑边（16:9 画面放不满这个尺寸，两边是黑边）能点：点一下推进剧情（实测 idx 4→5）。“画面”模式下点黑边**只恢复界面、不推进**（实测 idx 没变），再点一次才推进。
- 设置开关按钮 ≥36px；回看、存档格的文字放大到 ≥14–16px（之前存档格里的“还没有记录”只有约 9px）。

#### 3. 标题菜单靠左
- 原来的问题：`settings.cover.menu` 本来就是 `"left"`，但被鲸鱼 UI 的 `right:66px` 盖掉了。现在用 `body.game #title .menu.m-left` 把位置固定在左侧水面：宽 340px，从上往下每项往左收 18px（阶梯），最下面一项贴左边。
- 1280×720：菜单在 x 68–516、y 242–656，角色的脸（约 x 800）和脚（约 x 440–560、y 620 以下）都避开了。
- 844×390：菜单收窄到 160px 并贴左，避开右下方的脚（第一版 220px 宽时“插件”压到了袜子，已改）。
- 触屏设备不显示键盘操作提示（`.play-help`）。

#### 4. 好感数值显示（剧透向）
- 设置里新增一行“好感数值｜显示（剧透向）”，**默认关**（`pref('showStats')`，存在玩家自己的设置里）。在游戏中打开后，这一行会显示当前值；在标题页打开会提示“开始游戏后显示在每话结尾”。
- 开启后，章末存档点句子（正则 `^【…完…】 存档点`，19 句全部命中）后面追加 `〔好感 X · 尾鳍信号 Y〕`。
  实测：`【第一话完】 存档点：酸梅汤·加桂花　〔好感 0 · 尾鳍信号 0〕`；关闭后恢复原句。
- 变量名取自 `settings.soul`（aff = 好感，signal = 尾鳍），只在显示时追加，台词数据不变。

#### 5. 界面音效
- 引擎：`UI_SE_KEYS` 加入 `btnClick` 和 `btnHover`；`UI_SE_GAIN = { btnClick:.35, btnHover:.22, favorDown:.75 }`，最终音量是 `effectVolume()`（vse）× 增益。
- 点按：点舞台里的按钮会响（选项按钮和存档格不响，它们本身有专门的音效；快进时、打开声音收藏时也不响）。悬停：只认 `pointerType === 'mouse'`。实测触屏点按只触发点按音（选项确认 ×0.35），不会触发悬停音；桌面鼠标悬停触发选项出现 ×0.22。
- 设置里出现“按钮音效｜点按 / 悬停时轻响”开关（只在配了 btnClick 或 btnHover 时显示，默认开）。关掉后点按钮不响，已实测。
- `game.js` 的 `settings.uiSe`：choiceShow=b6keau2r（选项出现）、choiceConfirm=f8c9r2uu（选项确认）、timeoutTick=084gbl61（退潮线倒计时）、favorUp=yq8tcybf、favorDown=dwromo3v、tailfin=ayhs65mz、cg=mni51ori、save=jsxl4tcf、chapterEnd=84dehvnk（话末）、endingNew=ubotdcr5、btnClick=f8c9r2uu、btnHover=b6keau2r。**没有填 timeoutSilence。**
- 上面这 10 个 UI 素材的 `auditionOnly` 改成 false；`0l5canwg`（UI_超时沉默）保持 true。实测好感下降按 0.75 倍播放，超时沉默不响。
- 写回方式：`json.dumps(ensure_ascii=False, separators=(',',':'))`，前后缀原样保留。

#### 判断与遗留
- 原 patch 里还有一条“选项确认 ×0.7”。这次的要求没提到，所以去掉了，选项确认按原音量播放。需要的话在 `UI_SE_GAIN` 里加回 `choiceConfirm:.7` 即可。
- 竖屏时画面上方留了 0–48px 的深青色渐变（给刘海或状态栏留位置），颜色和面板一致，不是黑边。觉得多余的话，在 `patch_ui.py` 里把 `top` 改成 0。
- 横屏 844×390 是 16:9 画面放进约 2.16:1 的屏幕，左右各有约 78px 黑边，这是保持画面比例的必然结果。这两条黑边已经可以点击推进。
- 竖屏标题的菜单会盖住角色的身体（脸没有被盖住）。窄屏放不下 7 个按钮又同时避开整个人物，所以做了取舍。
- `play/g/` 原文件没有动。要上线的话，用本目录的 3 个文件覆盖 `play/g/` 里的同名文件。

<a id="source-072"></a>

## VN Studio 作品交付与接口

原文档：`docs/collab/work-ledger/vn-export.md`；整理前 SHA-256：`ad64e5bdb7d4856cee6a9afe9aa7723ab8d446e60dd6dd7922be604d7ab4f1d7`。

- 协作联系人：@LarryE135；本次由音乐负责人 @Liyang1145 提供ZIP并授权代提交。
- 状态：已交付、已验证独立作品；正式音乐/后端集成待核对。
- 更新时间：2026-10-13。
- 本次提交分支：`delivery/larry-latest-game`，基线 `661bfb9`。
- 交付入口：原件清单（历史位置 `archive/deliveries/larry-vn/README.md`）、[验证结果](<../A素材库/归档/deliveries/larry-vn/validation.json>)。

#### 已有证据

新旧仓库检查时均无开放PR，Larry分支未提供更新的完整游戏包。本次ZIP SHA-256为 `89e03de2b9a3fed80a04e48e7831203654e19dc1b9f155404d58311ffc9cbd2b`。作者游戏目录137个文件原样提交；18章、3308句、83图片与52音效。独立Edge会话检查18章进入、全部资源解码，无脚本错误。

#### 接口与待集成

作者包原生提供 `VNHost`，其偏好含 `vamb`；外层继续按 `prefs()` 动态渲染。仍无主曲资产，需要音乐负责人按此包重新接入并核对混音、存档定位和播放生命周期。界面音/尾巴情绪音未作听感验收。

本次未覆写作者图、声音与剧情，未套入代理旧整合包。AI后端、同源手账连接、新旧存档迁移须分别验收，不能由独立资源检查推断通过。

<a id="source-073"></a>

## 2026-10-19 鲸鱼小姐第一～七话新音色接入

原文档：`docs/collab/work-ledger/vo-ch1-7-new-voice-20261019.md`；整理前 SHA-256：`ebbe50216b506c21a83903048b399318f017834359b1aa83841d3d7602f15ec9`。

- 来源：用户 01:19 上传 `鲸鱼小姐_第一至七话_新音色.zip`（说明、清单、试玩反馈处理表已存 docs/collab/playtest/）。
- 接入：583 个文件（鲸鱼小姐 569 = 第一～七话 568 + #1769 重录；老奶奶 14）。文件名 `句号_句ID.mp3`，句号与节点序号一致，全部核对说话人无误。
- 其中替换旧语音 398 句，新挂语音 185 句；有配音的句子 530 → 715。
- game.js 资产条目（dur/sha256/generator/voiceBatch）与 content/audio/voice-over.json 同步。
- 9 句无台词语气句保留旧版；第八话以后 927 句仍是旧音色。
- 待听：0876「喂。学者。」转写为“学长”。
- 回归：fix6/reg.py 3315 节点，0 报错。

<a id="source-074"></a>

## 角色配音（Qwen-Audio-3.1-TTS-Next）

原文档：`docs/collab/work-ledger/voice-over.md`；整理前 SHA-256：`3b6b05326b1977310f54007743655953b8e9f74335220a685439d24c03e97d79`。

- 负责人：@Liyang1145（音乐/音频负责人）授权，Hark 执行
- 分支：`fix/character-performance`（不合 main，不编版本号）
- 日期：2026-10-17

#### 范围
- 配音对象：鲸鱼小姐（含第一话"???"首句）与配角老奶奶、银匠、摊主/摊主甲/摊主乙，共 1525 句。
- 主角"我"按 galgame 惯例不配音（玩家视角），旁白不配音。
- 3315 句的文案、视觉、BGM/音效字段均未改，只写入每句的 `voice` 字段。

#### 做法
- 模型：阿里云百炼 `qwen-audio-3.1-tts-next`（北京）。
- 音色锁定：先做声音设计选出参考音，之后每句以 `@voice1` 引用同一参考，保证全篇同一个声音。参考音在 `content/audio/voice-refs/`（whale=鲸鱼小姐，granny=老奶奶，smith=银匠）；摊主各 1 句，按人设文字生成。
- 表演：按整话上下文为每句写情绪/语气/语速指示（见清单 `direction` 字段）；台词里的动作括号不念。
- 质检：每条用 qwen3.8-omni 逐字转写，与台词相似度 ≥0.88 记 `ok`，否则换种子最多重试 3 次，取最佳并记 `review`（待人工听审）。
- 规格：MP3 44.1kHz 单声道 64kbps，去首尾静音，响度归一 -18 LUFS。

#### 接入
- 文件：`content/imports/vnstudio/海风与布丁/assets/vo/<句ID>.mp3`
- game.js：素材 `vo_<句ID>`（type `vo`），对应句 `voice` 指向它；播放器已有语音轨，到下一句自动停，自动模式等语音结束；设置里出现"语音"音量。
- 清单：`content/audio/voice-over.json`（每句台词、表演指示、转写、相似度、时长、sha256）。

#### 进度（本次提交）
- 已配：530 / 1525 句。第一至六话、第九至十一话基本完成；第七话仅 12 句。
- 未配：第七话其余、第八话、第十二至十六话、番外一二。原因：百炼账户欠费（Arrearage），充值后用同一参考音续跑，音色不变。
- 无可念文字的反应句（如"——！！"）暂留白，待决定是否补气声。
- 播放解码通过 ≠ 听感验收；`review` 条目与整体音色需音乐负责人试听确认。

<a id="source-075"></a>

## WAV 的 MP3 播放副本

原文档：`docs/collab/work-ledger/wav-mp3-playback.md`；整理前 SHA-256：`ad88dc6d0db02c6fe4cf64c22b1964e5ea532e7650083ae58bfacea94ab23b24`。

- 执行：Codex，用户要求检查并将 WAV 压为 MP3。
- 状态：已转换、已验证；本次随已授权的素材开发页和音乐接入共同交付。WAV原件继续保留。
- 分支：`feat/art-editor-library`（复用当前未提交工作区，保留此前未完成修改）。
- 基线：`34293625f66f7956d6d52d63d57f7b22133f0791`。

#### 范围与兼容

转换时运行作品193个资产中，99份音频为53份MP3、46份OGG，零WAV；随后Atri接入使运行作品变为197资产、103音频，仍为MP3/OGG。单文件HTML内嵌同一批压缩音频。素材库有32份WAV原件，全量制作MP3副本于 `content/assets/audio/mp3/`，总素材清单以 `playback_variants` 关联到原ID。原WAV及其既有SHA、原始来源、音量和材质分类保留。没有把未采用音效重新加进剧情，没有更换已有OGG或动作裁剪。

MP3使用LAME VBR质量2；保留声道，不裁剪、不改变响度，96kHz源重采样至48kHz供MP3编码。每份检查完整解码、声道、时长误差及原件SHA。转码成功不代替听感验收。

<a id="source-076"></a>

## 透明鲸鱼 UI 与平滑渐变接入

原文档：`docs/collab/work-ledger/whale-ui-fades.md`；整理前 SHA-256：`10e526ca157e9d73b0bae7bc9453e44daea914f3099561b07ac5bd52e40999c0`。

- 负责人 / 执行 agent：@Atri-Lobato 的 agent（用户授权“根据更新说明和仓库逻辑更新游戏”）
- 状态：已集成（视觉方向待团队试玩确认）
- 更新时间：2026-10-17
- 任务分支：`feat/whale-ui-fades`
- 基线提交：`0f6de470e5ef1b96c0dfe91605c913f15251c0b9`
- 交付提交 / PR / 附件：见本分支 PR；交付清单 archive/deliveries/whale-ui（历史位置 `archive/deliveries/whale-ui/README.md`）

#### 本次目标与影响范围

把作者本地修改的透明鲸鱼 UI 与界面叠化接入当前运行作品。只改 `content/imports/vnstudio/海风与布丁/index.html`；新增交付归档与本记录。

#### 兼容变化与交叉点

- 剧情、变量、选项、存档结构、项目/节点/素材 ID、`game.js`、assets 均不变。
- 与 [玩家体验打磨](<sources.md#source-062>) 交叉：保留 `game-polish.css` 的底栏文字标签、选项左右排布、7 项主页；鲸鱼皮肤叠加其上，`WHALE_UI_REPO_ADAPTER` 只调间距与底栏宽度。
- 与 [美术重制](<sources.md#source-053>) 交叉：主页按原稿放右侧，会叠在新封面人物上；用户确认按原稿、封面不改。

#### 依赖与尚未对齐的内容

- 主页位置与错位步长按原稿；仅因 7 项把间距由 44 px 收为 26 px。
- 单文件版未重新生成；Firefox/Safari/触屏、GalAgent 手账停靠、听感未测。
- DeepSeek 鲸鱼图形许可待核实。

#### 实际验证与交付

本地 Chromium（Playwright，`file://`，1280×720）：

- 内联脚本语法检查通过；页面无脚本错误。
- 主页 7 项、对话、剧情选项截图与合并前对比：皮肤生效，标签完整，主页 7 项完整在画面内。
- 开始→推进→存档→再推进→读档，回到同一句；切换后无残留叠化层。

#### 下一位 agent 的接续点

作者再出 UI 修改时，以 `archive/deliveries/whale-ui/original-files/index.html` 为新祖先做三方合并，不要整包覆盖运行目录。

<a id="source-077"></a>

## 第一话：音乐负责人新文案接入稿

原文档：`docs/content/opening-revision-20261015.md`；整理前 SHA-256：`39fff28a8d63d7d247352b01fddedf4eea0cc1e2020cef7ad04a00335b80e67a`。

用户于2026-10-15提供。下面为实际接入稿，保留原选项/汇合ID，仅作上述轻微标点与错字整理。原运行稿完整留档，后续十五话及两篇番外不改写。

#### 已执行与待人工统一

- 第一组选项B“沉默”扣10好感；糍粑选项C扣1好感。
- 作死线五次尾鳍拍水采用现有真实双拍片段两次、轻拍一次，延迟播放，切句取消未发生的拍水；尾鳍情绪信号仍只计一次。
- 新开场50天与第六话15天冲突留待人工统一。
- 原文“衣负”按“衣角”接入；“在那”保留为停顿；删除孤立（）编辑占位。
- 结尾烤鱿鱼CG须无人、无蓝黑丝线，不提前揭示送礼者。

#### 接入文本

【定位 第一话 · fhww88n3】
旁白：盛夏的正午，浅滩的水被太阳晒得温热。

旁白：醒过来的时候，半边身子泡在齐腰深的海水里。

旁白：手里还死死抱着一个……呃……似乎很重要的……笔记本？

我：「……所以这是哪儿？」

旁白：最后的记忆，……好像是……是坐在屏幕前对着大肥鱼敲了50天的字。

旁白：再然后，就是这片海。

旁白：撑着水底站起来——指尖碰到了一样东西。

旁白：凉凉的。滑滑的。似乎还带着一点鳞片的纹路。

旁白：顺着指缝，滑了一下。

???：「——！！」

旁白：整条“东西”猛地一甩。

旁白：啪！

旁白：被拍得横着飞出去三米多远，结结实实喝了一大口海水。

旁白：笔记本脱手，在空中划出一道绝望的弧线——

我：不！！！！！！！！

旁白：在那——

旁白：一只手接住了它。

旁白：你看着眼前这个似乎是罪魁祸首，又似乎是……救命恩人的家伙。

？？？：「人类。」

？？？：「你刚才，摸的是本小姐的尾巴尖。」

鲸鱼小姐：「……说话。」

A 「我可以解释——」 → c1q1a；无好感变化
B 「沉默」 → c1q1b；好感 -= 10
C 「……手感不错。」 → c1q1c；好感 -= 5

【定位 c1q1a · k1t4gr6o】
鲸鱼小姐：「解释？」

鲸鱼小姐：「鲸鱼的尾巴摸不得。」

旁白：（尾鳍拍水两下。）

鲸鱼小姐：「尾巴尖。也不行。」

【定位 c1q1b · lt5k0xiy】
鲸鱼小姐：「喂！你这家伙，碰到了别人不知道道歉么！」

旁白：（尾鳍拍水两下。）

鲸鱼小姐：「真是没礼貌。」

【定位 c1q1c · s3arg4rw】
旁白：她僵住了。

旁白：整条鲸尾缓缓立出水面，像一面涨满的帆。

鲸鱼小姐：「……你刚才，说什么？」

我：「手感——」

旁白：第二记尾击。这次的力道更重。

鲸鱼小姐：「流氓！」

旁白：（尾鳍拍水五下。）

【定位 c1m1 · 8divye5i】
旁白：她翻开潮湿笔记本，扫了一眼里面密密麻麻的字。

鲸鱼小姐：「‘记录单元、反思单元、验证单元’……」

鲸鱼小姐：「写的什么乱七八糟的东西。」

鲸鱼小姐：「你们人类掉海里都不忘带奇怪的本子吗？」

我：「等等，那个很重要——」

旁白：对呀！重要！为什么重要！快想想！快……

鲸鱼小姐：「重要？」

旁白：她把笔记本举高。尾鳍在水里卷出一个威胁的弧度。

鲸鱼小姐：「那你说——」

鲸鱼小姐：「是本小姐的尾巴重要，还是你的本子重要？」

A 「你的尾巴重要。」 → c1q2a；好感 += 10
B 「本子重要。」 → c1q2b；好感 -= 10
C 「都重要。」 → c1q2c；好感 += 3

【定位 c1q2a · 2360dvsq】
鲸鱼小姐：「哼。」

鲸鱼小姐：「算你还有点眼光。」

旁白：她把笔记本抛回给你。刚好落进怀里。

旁白：（尾鳍尖卷了一个小圈。）

【定位 c1q2b · sb63ua0q】
鲸鱼小姐：「哦？」

鲸鱼小姐：「很好。」

鲸鱼小姐：「那你的本子喂鱼，你喂本小姐。」

旁白：笔记本以一个完美的抛物线飞向深水区……快去捡回来！

旁白：你的心里如是说。

旁白：我扑过去捞了回来。呛了三口水。

鲸鱼小姐：「……啧。」

旁白：（尾鳍拍水一下。扔得很轻。）

【定位 c1q2c · 7y5p4ecl】
鲸鱼小姐：「都重要？」

鲸鱼小姐：「人类，太贪心是会被淹死的。」

【定位 c1m2 · no3hzp1r】
旁白：她转身要走。蓝黑色的长发在水里铺开，像一小片退潮前的夜。

我：「喂——至少告诉我，这是哪儿？」

旁白：她停下，半侧过脸。耳尖有点红。

鲸鱼小姐：「浅滩，人类。往东三里是小镇。」

鲸鱼小姐：「往西——」

旁白：尾巴尖遥遥点了点深水区。

鲸鱼小姐：「是本小姐家。你这种连游泳都费劲的家伙，最好别去。」

我：「你救了我？」

鲸鱼小姐：「谁救你了！」

旁白：水花拍了我一脸。

鲸鱼小姐：「本小姐只是路过！」

鲸鱼小姐：「顺便！懂吗，顺便！」

旁白：（尾鳍在水里悄悄勾住我的脚踝，把我往岸边带了一下。）

旁白：你低头看了一眼。

鲸鱼小姐：「看什么看！」

鲸鱼小姐：「那是水流！海流懂不懂！」

旁白：（尾鳍慌乱甩圈。此地无银。）

旁白：下午。我坐在礁石上晒干笔记本。

旁白：她抱臂站在三米开外“监视”我。

鲸鱼小姐：「别误会。」

鲸鱼小姐：「本小姐是防止可疑人类污染这片海域。」

旁白：中途有海鸥落下来，歪着头看她。

旁白：她瞪了海鸥一眼，从不知道哪儿摸出半块糍粑，掰了一小块丢过去。

旁白：海鸥叼走了。

旁白：她盯着剩下的半块。

旁白：又看了看我。

旁白：——以及我正在用衣角一页页吸干的笔记本上。

旁白：她游近了半米。

鲸鱼小姐：「……喂。」

我：「嗯？」

鲸鱼小姐：「你那个本子里——」

鲸鱼小姐：「记的，都是什么？」

A 「记一个问题的答案。」 → c1q3a；无好感变化
B 「记你。」 → c1q3b；好感 += 5
C 「商业机密。」 → c1q3c；好感 -= 2

【定位 c1q3a · fuij1wic】
我：「记一个问题的答案。」

鲸鱼小姐：「什么问题？」

我：「生命，或者说智能的原理，究竟是什么。」

旁白：她沉默了一会儿。

旁白：尾巴尖在水里一点一点，像有什么东西在很深的地方被碰了一下。

【定位 c1q3b · 7bjpv8xn】
我：「记你。」

旁白：（整条尾巴“啪”地拍平在水面上。）

鲸鱼小姐：「……哈？」

鲸鱼小姐：「人类，你搭讪的方式是抄的哪本破书？」

旁白：（嘴上嫌弃，耳朵红了。）

【定位 c1q3c · 002u68h7】
我：「商业机密。」

鲸鱼小姐：「呵。」

鲸鱼小姐：「可疑人类，笔记本没收。」

旁白：她真的来抢了。抢过去翻了五秒钟。

旁白：然后被里面全是术语的鬼画符劝退，扔了回来。

鲸鱼小姐：「什么嘛。无聊。」

【定位 c1m3 · u7ne78gd】
旁白：她哼了一声，把剩下的半块糍粑掰成两半。

旁白：大的那一半，塞进自己嘴里。

旁白：小的那一半——塞进我手里。

鲸鱼小姐：「答案哪有那么好找的。」

鲸鱼小姐：「你们人类就是爱想这些没用的。」

我：「这个是——」

鲸鱼小姐：「酬劳！」

旁白：她抢在你问出口之前凶巴巴地宣布。

鲸鱼小姐：「你摸了本小姐尾巴尖，按理说要被拍进深海的。」

鲸鱼小姐：「看在你本子快烂了的可怜份上，赦免你。」

鲸鱼小姐：「吃了糍粑就走。天黑之前离开这片海域，听懂了没有？」

A 「手艺真好。是你做的吗？」 → c1q4a；好感 += 5
B 「谢谢，很好吃。」 → c1q4b；好感 += 3
C （默默吃掉） → c1q4c；好感 -= 1

【定位 c1q4a · 66ms5xlq】
我：「手艺真好。是你做的吗？」

旁白：她整个人像被噎了一下。耳鳍都立了起来。

鲸鱼小姐：「是、是外婆做的！」

鲸鱼小姐：「深海的！海鸥带过来的！」

鲸鱼小姐：「跟本小姐一点关系都没有！」

我：「哦。那替我谢谢外婆。」

鲸鱼小姐：「谁要替你——」

鲸鱼小姐：「人类！你这个人怎么听不懂话啊！」

旁白：（尾鳍在水里小幅度地画着圈。）

【定位 c1q4b · d237bw02】
我：「谢谢，很好吃。」

鲸鱼小姐：「……嗯。」

鲸鱼小姐：「算你有品位。」

【定位 c1q4c · w4wesv59】
旁白：我默默吃掉糍粑。

旁白：她盯着我看了三秒钟，一副“就这？”的表情。

鲸鱼小姐：「……吃完就走啊。还愣着干嘛。」

旁白：（尾鳍拍水一下。轻得几乎没有。）

【定位 c1m4 · o3ik0z6e】
我：「明天还来。」

鲸鱼小姐：「不准来！」

我：「我带酸梅汤来。」

旁白：……她愣住。

旁白：我翻开笔记本新的一页，写下今天的日期。

我：「冰镇的那种。就当，谢礼。」

旁白：她盯着我看了足足五秒钟。

旁白：天青色的眼睛里，有什么飞快地转了一圈——

旁白：警惕。好奇。一点被冒犯的恼火。

旁白：最后全部沉下去，只剩一句轻飘飘的——

鲸鱼小姐：「……随便你。」

旁白：（尾鳍在水下，慢慢地、慢慢地，卷出了一个小小的圈。）

旁白：她转身扎进深水区。

旁白：蓝黑色的长发在水面上留下一道弧线，很快消失了。

旁白：只有一句话顺着浪花漂回来。

旁白：凶巴巴的，尾音却软得不像话——

鲸鱼小姐：「酸梅汤里要加桂花！」

鲸鱼小姐：「不加的话，连人带壶一起扔进深海！」

旁白：回到帐篷的时候，门口放着一串烤小鱿鱼。

旁白：还温着。

旁白：这附近没有什么住户。当然……海鸥也不会生火。

旁白：你低头，在笔记本的日期下面，补了一行小字。

旁白：『今日验证：智能的最小单元之外，似乎还需要一个“价值观”单元。』

旁白：想了想，又补了一行。

旁白：『明天带酸梅汤。加桂花的。』

旁白：【第一话完】 存档点：酸梅汤·加桂花　　好感 {好感}　尾鳍信号 {尾鳍}

<a id="cg-loops-delivery"></a>

## CG 循环动画交付记录

原文档：`docs/collab/work-ledger/cg-loop-animations-20261023.md`；来源提交：`be8a6e5763537de8295c4743c49df5d86fd5c1f5`；原字节 SHA-256：`6ddbc62fe5ff97c84e0afe47ba28f6034261fe516bfc4cdb37a861d2b17a69b9`。

下列模型、算力、循环效果与规格为原交付方的记录，保留用于追溯；本次没有视频、生成环境或效果验收。

### 1. 交付概述
- **模型与算力**：使用 3 台并行 Google Colab `NVIDIA A100-SXM4-80GB` 实例运行 `MiniMax-H3`（`minimax_h3_fl2va_pruned_int8_convrot` + `8-step Turbo LoRA` + `Qwen3-VL-32B` 文本编码器）。
- **首尾帧一致无缝循环（`first_frame == last_frame`）**：严格按照团队同学要求“给 CG 做一段首尾帧一致的循环动画”，在 `MiniMaxH3ImageToVideo` 中将 `first_frame` 与 `last_frame` 同时锚定为最新精修版 CG 原画（`海风与布丁/assets/art-upgrade/*.webp`），固定镜头零切镜、零旋转眩晕，中间帧呈现自然的呼吸、眨眼、耳鳍轻颤、发丝拂动、鲸尾摇曳与环境光影（水波、焦散、篝火、热气、月光），并在尾帧平滑回到与起始帧完全一致的姿态。
- **交付目录**：`A素材库/cg-animations/loops/`（包含全部 27 支 `.mp4` 循环动画、`index.html` 在线预览画廊、`manifest.json`、[完整提示词](#cg-loop-prompts) 及 3 张首尾帧核验总表 `cg_loop_verify_batch1~3.jpg`）。

### 2. 27 支无缝循环 CG 清单
| 编号 | 名称 | 视频文件 | 原画来源 | 规格 |
| :--- | :--- | :--- | :--- | :--- |
| `C01` | CG_初登场（主角初登场·举画本） | `A素材库/cg-animations/loops/C01_loop.mp4` | `海风与布丁/assets/art-upgrade/C01.webp` | 1344×768 · 24fps · 5.17s |
| `C02` | CG_糍粑（下午礁石分享红糖糍粑） | `A素材库/cg-animations/loops/C02_loop.mp4` | `海风与布丁/assets/art-upgrade/C02.webp` | 1344×768 · 24fps · 5.17s |
| `C03` | CG_烤鱿鱼（营地门口·无人留下的烤鱿鱼远景） | `A素材库/cg-animations/loops/C03_loop.mp4` | `海风与布丁/assets/art-upgrade/C03.webp` | 1344×768 · 24fps · 5.17s |
| `C04` | CG_立约（礁石趴姿写契约） | `A素材库/cg-animations/loops/C04_loop.mp4` | `海风与布丁/assets/art-upgrade/C04.webp` | 1344×768 · 24fps · 5.17s |
| `C05` | CG_入水回头确认（浅海水下牵手回眸） | `A素材库/cg-animations/loops/C05_loop.mp4` | `海风与布丁/assets/art-upgrade/C05.webp` | 1344×768 · 24fps · 5.17s |
| `C06` | CG_深海之光（深海荧光星光定情） | `A素材库/cg-animations/loops/C06_loop.mp4` | `海风与布丁/assets/art-upgrade/C06.webp` | 1344×768 · 24fps · 5.17s |
| `C07` | CG_手链（黄昏晚霞手链代管） | `A素材库/cg-animations/loops/C07_loop.mp4` | `海风与布丁/assets/art-upgrade/C07.webp` | 1344×768 · 24fps · 5.17s |
| `C08` | CG_诗句（月夜礁石膝头写诗） | `A素材库/cg-animations/loops/C08_loop.mp4` | `海风与布丁/assets/art-upgrade/C08.webp` | 1344×768 · 24fps · 5.17s |
| `C09` | CG_原来是你（月夜营地篝火裹毯夜谈） | `A素材库/cg-animations/loops/C09_loop.mp4` | `海风与布丁/assets/art-upgrade/C09.webp` | 1344×768 · 24fps · 5.17s |
| `C10` | CG_海豚（晴日沙洲跃海豚与吃醋） | `A素材库/cg-animations/loops/C10_loop.mp4` | `海风与布丁/assets/art-upgrade/C10.webp` | 1344×768 · 24fps · 5.17s |
| `C11` | CG_新家（海景新家花园第一次揭示） | `A素材库/cg-animations/loops/C11_loop.mp4` | `海风与布丁/assets/art-upgrade/C11.webp` | 1344×768 · 24fps · 5.17s |
| `C12` | CG_电话（海景客厅电话后护手机） | `A素材库/cg-animations/loops/C12_loop.mp4` | `海风与布丁/assets/art-upgrade/C12.webp` | 1344×768 · 24fps · 5.17s |
| `C13` | CG_深水区（深水区潜入拉手救援） | `A素材库/cg-animations/loops/C13_loop.mp4` | `海风与布丁/assets/art-upgrade/C13.webp` | 1344×768 · 24fps · 5.17s |
| `C14` | CG_和解（满月礁石双手相握和解） | `A素材库/cg-animations/loops/C14_loop.mp4` | `海风与布丁/assets/art-upgrade/C14.webp` | 1344×768 · 24fps · 5.17s |
| `C15` | CG_翡翠之梦（翡翠之梦店吧台尾帆起舞） | `A素材库/cg-animations/loops/C15_loop.mp4` | `海风与布丁/assets/art-upgrade/C15.webp` | 1344×768 · 24fps · 5.17s |
| `C16` | CG_珍珠（手作工坊同款天青珍珠戒指特写） | `A素材库/cg-animations/loops/C16_loop.mp4` | `海风与布丁/assets/art-upgrade/C16.webp` | 1344×768 · 24fps · 5.17s |
| `C17` | CG_打烊后披毯与海鲜面 | `A素材库/cg-animations/loops/C17_loop.mp4` | `海风与布丁/assets/art-upgrade/C17.webp` | 1344×768 · 24fps · 5.17s |
| `C18` | CG_布丁（海滨集市生鲜鱼摊） | `A素材库/cg-animations/loops/C18_loop.mp4` | `海风与布丁/assets/art-upgrade/C18.webp` | 1344×768 · 24fps · 5.17s |
| `C19` | CG_早安（清晨玄关踮脚早安吻） | `A素材库/cg-animations/loops/C19_loop.mp4` | `海风与布丁/assets/art-upgrade/C19.webp` | 1344×768 · 24fps · 5.17s |
| `C20` | CG_尾巴缠手腕约定（窗边十指相扣） | `A素材库/cg-animations/loops/C20_loop.mp4` | `海风与布丁/assets/art-upgrade/C20.webp` | 1344×768 · 24fps · 5.17s |
| `C21` | CG_月下共读初遇稿 | `A素材库/cg-animations/loops/C21_loop.mp4` | `海风与布丁/assets/art-upgrade/C21.webp` | 1344×768 · 24fps · 5.17s |
| `C22` | CG_海风与布丁（月夜浅滩终幕） | `A素材库/cg-animations/loops/C22_loop.mp4` | `海风与布丁/assets/art-upgrade/C22.webp` | 1344×768 · 24fps · 5.17s |
| `C24` | CG_集市女仆（集市黑白女仆装递苹果） | `A素材库/cg-animations/loops/C24_loop.mp4` | `海风与布丁/assets/art-upgrade/C24.webp` | 1344×768 · 24fps · 5.17s |
| `C25` | CG_人鱼公主（贝壳番外·帐篷睡衣抱鲸鱼玩偶） | `A素材库/cg-animations/loops/C25_loop.mp4` | `海风与布丁/assets/art-upgrade/C25.webp` | 1344×768 · 24fps · 5.17s |
| `C26` | CG_打烊柜台坐姿·谈起梦想 | `A素材库/cg-animations/loops/C26_loop.mp4` | `海风与布丁/assets/art-upgrade/C26.webp` | 1344×768 · 24fps · 5.17s |
| `O12` | 门口温热烤小鱿鱼（正式采用近景版） | `A素材库/cg-animations/loops/O12_loop.mp4` | `海风与布丁/assets/art-upgrade/O12.webp` | 1344×768 · 24fps · 5.17s |
| `CG_DRY` | 浅滩_午后_抱臂监视（晾晒画本与偷瞄） | `A素材库/cg-animations/loops/CG_DRY_loop.mp4` | `海风与布丁/assets/art-upgrade/CG_DRY.webp` | 1344×768 · 24fps · 5.17s |

<a id="cg-loop-prompts"></a>

## CG 循环动画完整提示词

原文档：`A素材库/cg-animations/loops/CG_循环动画提示词总表.md`；来源提交：`be8a6e5763537de8295c4743c49df5d86fd5c1f5`；原字节 SHA-256：`3388621c14f4ace0a69732e6c257c9e3396e0d04a46af815824145ddbb0dc11b`。

提示词按原制作记录完整保留。批次标题中的“正在生成中”是历史表述，不代表当前存在生成任务；121 帧/5.04 秒与交付清单的 5.17 秒差异保留，未通过本次整理作视频核实。

> **无缝循环核心约束（全片统一）**：
> - **首尾帧完全一致**：在 `MiniMaxH3ImageToVideo` 节点中同时传入 `first_frame = <CG>.png` 与 `last_frame = <CG>.png`（同一张精修原画）。
> - **固定机位零眩晕**：所有提示词均显式锁定**固定镜头（禁止切镜头、禁止镜头旋转、禁止推拉摇移晃动）**，仅让人物呼吸/眨眼/发丝/耳鳍/鲸尾与环境光影（水波、焦散、篝火、热气、月光）做自然的周期性微动作，并在尾帧平滑归位至起始姿态。
> - **生成规格**：`1344 × 768` · `24 fps` · `121 帧（5.04 秒）` · `MiniMax-H3 8-step Turbo`。

---

### 第一批（Batch 1 · 正在 `minimax` A100-80GB #1 生成中）

#### 1. `C01` — CG_初登场（主角初登场）
- **原画路径**：`海风与布丁/assets/art-upgrade/C01.webp` (`first_frame = C01.png`, `last_frame = C01.png`)
- **微动作设计**：眨眼 + 呼吸起伏 + 海风吹拂蓝发与胸前浅蓝丝带 + 蓝白耳鳍轻颤 + 右侧蓝白双叶鲸尾上下轻摆泛起阳光水波后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。正午阳光透亮的蔚蓝海岸浅滩，身穿深蓝色水手领连衣裙的蓝发少女（鲸鱼小姐，头顶环形呆毛、两侧蓝白耳鳍系浅蓝蝴蝶结）站在波光粼粼的清澈浅海水中，右手举着带鲸尾徽记的蓝色画本。她自然眨眼、脸颊带着骄傲又俏皮的微红轻轻呼吸，海风温柔吹拂她散落的蓝色长发与胸前浅蓝丝带，两侧蓝白耳鳍轻轻颤动，右侧水面上的蓝白双叶鲸尾（带白色新月星纹）优雅地轻轻上下摆动拍起细腻晶莹的阳光水波涟漪，随后一切动作平滑自然地回到与起始帧完全一致的姿态。柔和清澈的正午海浪与海风环境音。
```

#### 2. `C02` — CG_糍粑（下午分享糍粑）
- **原画路径**：`海风与布丁/assets/art-upgrade/C02.webp` (`first_frame = C02.png`, `last_frame = C02.png`)
- **微动作设计**：害羞眨眼 + 蓝白耳鳍娇羞轻抖 + 暖风吹动蓝发与裙摆 + 身后鲸尾在金色海面上轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。午后暖金阳光下的海岸礁石，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）坐在礁石上，右手拿着半块红糖糍粑在唇边，左手将另一半拉丝的红糖糍粑递向前景张开的手掌。少女害羞地眨眼，绯红的脸颊带着娇羞神情，蓝白耳鳍可爱地轻轻抖动，暖风吹拂她的蓝色长发与裙摆，身后的蓝白双叶鲸尾在金色海面上轻轻摇晃，随后平滑自然地回到与起始帧完全一致的姿态。温暖午后海浪与微风环境音。
```

#### 3. `C03` — CG_烤鱿鱼（营地门口·无人留下的烤鱿鱼）
- **原画路径**：`海风与布丁/assets/art-upgrade/C03.webp` (`first_frame = C03.png`, `last_frame = C03.png`)
- **微动作设计**：烤鱿鱼袅袅升起白色热气 + 木箱露营提灯火光微闪 + 帐篷边缘与前景草叶随晚风轻摆 + 夕阳海面波光闪烁。
- **提示词（Prompt）**：
```text
高质量二次元Galgame道具事件CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧画面完全一致。黄昏海岸米白色帆布帐篷门口，木制踏板上的陶瓷盘里放着一串烤得色泽诱人的三只小鱿鱼，烤鱿鱼表面泛着温润光泽并袅袅升起轻柔的白色热气；帐篷旁木箱上的露营提灯火光温暖微闪，帐篷帆布边缘与前景草叶在傍晚海风中微微摇曳，远处夕阳海面波光柔和闪烁，随后平滑回到与起始帧完全一致的画面。静谧黄昏海浪与晚风环境音。
```

#### 4. `C04` — CG_立约（礁石写契约）
- **原画路径**：`海风与布丁/assets/art-upgrade/C04.webp` (`first_frame = C04.png`, `last_frame = C04.png`)
- **微动作设计**：专注害羞眨眼 + 右手握笔在纸面做自然书写微动 + 海风轻拂书页角与蓝发 + 左后方高扬鲸尾悠然轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。明媚阳光下的海岸礁石，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）趴在礁石上，右手握笔在摊开的笔记本上认真书写契约，抬眼望向右侧眼镜青年。少女专注而害羞地眨眼，握笔的右手在纸面上做细腻自然的书写微动，海风轻拂笔记本页角与她的蓝色长发，左后方高扬的蓝白双叶鲸尾在阳光下悠然轻摆，随后平滑自然地回到与起始帧完全一致的姿态。明朗海岸波涛与海风吹拂书页声。
```

#### 5. `C05` — CG_入水回头确认
- **原画路径**：`海风与布丁/assets/art-upgrade/C05.webp` (`first_frame = C05.png`, `last_frame = C05.png`)
- **微动作设计**：水下丁达尔光束与焦散波光流动 + 温柔眨眼 + 蓝发与裙摆在水中失重飘动 + 银色气泡上升 + 鲸尾柔美摆动后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。阳光穿透清澈蔚蓝的浅海水下，丁达尔光束与水下焦散波光在四周柔和流动，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）在水中轻盈牵着前景伸出的手，回眸露出温柔安心的微笑。她温柔地眨眼，深蓝长发与裙摆在清澈水流中失重般柔美飘动，晶莹的银色气泡从水下缓缓升起，身后的蓝白双叶鲸尾在水波中轻柔摆动，随后平滑自然地回到与起始帧完全一致的姿态。静谧梦幻的水下暗流与气泡声。
```

#### 6. `C06` — CG_深海之光（深海星光定情）
- **原画路径**：`海风与布丁/assets/art-upgrade/C06.webp` (`first_frame = C06.png`, `last_frame = C06.png`)
- **微动作设计**：眼波泪光微颤与轻柔眨眼 + 蓝发在深海柔流中飘逸 + 四周青蓝色生物荧光微粒明灭浮动 + 鲸尾轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。幽蓝梦幻的深海星光水下，四周漂浮着发光的蔚蓝与青色生物荧光微粒，左侧青年温柔抚摸蓝发少女（鲸鱼小姐）的脸颊，少女含着晶莹泪光深情仰望。少女眼波微颤、轻柔眨眼，蓝色长发在深海柔流中缓缓飘逸，四周璀璨的深海荧光星点明灭闪烁、轻轻浮动，她的蓝白双叶鲸尾在深海微光中温柔轻摆，随后平滑自然地回到与起始帧完全一致的姿态。空灵静谧的深海共鸣与柔和水流声。
```

#### 7. `C07` — CG_手链（黄昏手链代管）
- **原画路径**：`海风与布丁/assets/art-upgrade/C07.webp` (`first_frame = C07.png`, `last_frame = C07.png`)
- **微动作设计**：羞怯眨眼 + 指尖悬挂的浅蓝珍珠贝壳手链在夕阳下微晃 + 晚风吹拂蓝发与白裙摆 + 左侧鲸尾轻摇后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。漫天橘红与金紫色绚烂晚霞下的海岸礁石，身穿白色蓝边夏日连衣裙的蓝发少女（鲸鱼小姐）坐在礁石上，右手将一串精致的浅蓝珍珠贝壳手链递向前景的手掌。少女脸颊绯红、温柔羞怯地眨眼，指尖悬挂的蓝珍珠手链在夕阳金光下微微轻晃，晚风吹拂她的蓝色长发与白色裙摆，左侧的蓝白双叶鲸尾在暮色海风中轻轻摇曳，随后平滑自然地回到与起始帧完全一致的姿态。温柔的黄昏海浪与晚风声。
```

#### 8. `C08` — CG_诗句（诗签礁石写字）
- **原画路径**：`海风与布丁/assets/art-upgrade/C08.webp` (`first_frame = C08.png`, `last_frame = C08.png`)
- **微动作设计**：恬静眨眼 + 右手笔尖在膝头诗签本上细微书写 + 夜风拂动蓝发 + 礁石上的鲸尾尾尖在月光下轻摆 + 海面银波闪烁。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。皎洁满月照耀的夜晚海岸礁石，银色月光洒满深蓝海面，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）端坐礁石上，低头在膝头摊开的深蓝诗签本上握笔写诗。少女神情恬静地轻轻眨眼，右手笔尖在纸上做细微书写动作，夜风轻拂她的蓝色长发与发丝，身后横卧在礁石上的蓝白双叶鲸尾尾尖在月光下轻轻摆动，海面银波闪烁，随后平滑回到与起始帧完全一致的姿态。静谧月夜海浪声。
```

#### 9. `C09` — CG_原来是你（营地裹毯夜谈）
- **原画路径**：`海风与布丁/assets/art-upgrade/C09.webp` (`first_frame = C09.png`, `last_frame = C09.png`)
- **微动作设计**：右下角篝火火苗欢快跳动与火星升起 + 暖光在两人脸庞与印花毛毯上摇曳 + 少女温柔眨眼 + 篝火后方鲸尾轻晃后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。满月下的海岸露营地，米白帐篷前青年与披着深蓝印花毛毯的蓝发少女（鲸鱼小姐）并肩而坐、温柔对视，右下角篝火温暖燃烧。橘红色的篝火火苗欢快跳动、零星火星缓缓升起，温暖火光在两人脸庞与毛毯上柔和摇曳，少女温柔眨眼微笑，蓝色长发随夜风微微拂动，篝火后方的蓝白鲸尾尾尖轻轻晃动，随后平滑回到与起始帧完全一致的姿态。温暖篝火噼啪声与夜海波涛声。
```

---

### 第二批（Batch 2 · 正在 `minimax2` A100-80GB #2 生成中）

#### 10. `C10` — CG_海豚（沙洲海豚与吃醋）
- **原画路径**：`海风与布丁/assets/art-upgrade/C10.webp` (`first_frame = C10.png`, `last_frame = C10.png`)
- **微动作设计**：鼓起脸颊吃醋傲娇眨眼 + 耳鳍微颤 + 海风吹拂蓝发与裙摆 + 左侧沙洲鲸尾轻拍细碎水花后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。晴朗碧蓝的夏日沙洲浅滩，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）侧坐在湿润沙滩上，脸颊鼓起、带着吃醋又傲娇的可爱眼神回望镜头，远处碧海上有海豚跃出水面。少女傲娇地眨眼、耳鳍微微轻颤，海风吹拂她的蓝色长发与裙摆，左侧沙洲上的蓝白双叶鲸尾轻轻摆动拍起细碎水花，海面阳光波光粼粼，随后平滑回到与起始帧完全一致的姿态。欢快的夏日海浪与海风声。
```

#### 11. `C11` — CG_新家（新家第一次揭示）
- **原画路径**：`海风与布丁/assets/art-upgrade/C11.webp` (`first_frame = C11.png`, `last_frame = C11.png`)
- **微动作设计**：灿烂微笑眨眼 + 树影斑驳阳光在花园绿植与蓝发间摇曳 + 左侧高扬鲸尾欢快轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。阳光明媚的海滨花园小径，身后是白墙蓝瓦的二层海景新家洋房，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）右手牵着前景青年的手，左手指引向身后的新家，绽放灿烂幸福的笑容。少女开心地眨眼微笑，树影斑驳的阳光随微风在花园绿植与她飘逸的蓝色长发间轻轻摇曳，左侧高扬的蓝白双叶鲸尾欢快地轻轻摆动，随后平滑回到与起始帧完全一致的姿态。明快温暖的海滨微风与鸟鸣声。
```

#### 12. `C12` — CG_电话（电话后抢手机）
- **原画路径**：`海风与布丁/assets/art-upgrade/C12.webp` (`first_frame = C12.png`, `last_frame = C12.png`)
- **微动作设计**：护住手机慌张害羞眨眼 + 蓝白耳鳍微颤 + 窗边白纱帘与蓝发随海风轻拂 + 右侧鲸尾紧张轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。阳光洒满的海景客厅木地板上，窗外是碧蓝大海，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）坐在地板上双手紧紧把手机护在胸前，满脸羞红、又急又羞地望着前景伸手过来的青年。少女慌张害羞地眨眼，两侧蓝白耳鳍微微颤动，窗边白纱帘与她的蓝色长发在海风中轻轻拂动，右侧的蓝白双叶鲸尾紧张地轻轻摆动，随后平滑回到与起始帧完全一致的姿态。温馨室内海风轻拂声。
```

#### 13. `C13` — CG_深水区（深水区救援）
- **原画路径**：`海风与布丁/assets/art-upgrade/C13.webp` (`first_frame = C13.png`, `last_frame = C13.png`)
- **微动作设计**：深水光束流转 + 关切眨眼 + 蓝发与裙摆在上升气泡间飘动 + 身后鲸尾有力而优雅地轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。幽深蔚蓝的深水区海面之下，阳光从上方海面射入道道光束，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）潜入水中，右手紧紧抓住前景青年的手腕奋力救援，眼神坚定而关切。少女急切而温柔地眨眼，蓝色长发与裙摆在水流与晶莹上升的气泡间柔美飘动，身后的蓝白双叶鲸尾有力而优雅地轻轻摆动，水下波光流转，随后平滑回到与起始帧完全一致的姿态。深水涌动与气泡上升声。
```

#### 14. `C14` — CG_和解（月夜和解）
- **原画路径**：`海风与布丁/assets/art-upgrade/C14.webp` (`first_frame = C14.png`, `last_frame = C14.png`)
- **微动作设计**：含泪释怀眨眼微笑 + 夜风吹拂散落蓝发 + 身后扬起的鲸尾在月光与银波间缓缓摇曳后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。皎洁满月下的夜晚海岸礁石，银色月光铺满海面，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）双手紧紧握住前景青年的手，脸颊微红、眼角闪烁感动的泪光，露出释怀而温柔的微笑。少女含泪轻轻眨眼，夜风温柔吹拂她散落的蓝色长发，身后扬起的蓝白双叶鲸尾在月光与海浪声中缓缓摇曳，海面银波荡漾，随后平滑回到与起始帧完全一致的姿态。温柔的月夜海浪声。
```

#### 15. `C15` — CG_翡翠之梦（翡翠之梦尾帆）
- **原画路径**：`海风与布丁/assets/art-upgrade/C15.webp` (`first_frame = C15.png`, `last_frame = C15.png`)
- **微动作设计**：吧台桌面起舞姿态明媚眨眼 + 蓝发与裙摆随室内微风轻飘 + 身后鲸尾优雅轻摆 + 窗外月色海波微闪。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。夜晚温馨的海滨甜品店「翡翠之梦」室内，大落地窗外是满月与深蓝大海，店内暖黄吊灯散发柔和光芒；身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）俏皮地单脚轻点站在木制吧台桌面上，双臂舒展如扬帆起舞，笑容明媚灿烂。少女开心地眨眼，蓝色长发与裙摆随微风轻轻飘动，身后的蓝白双叶鲸尾优雅轻摆，窗外月色海波微闪，随后平滑回到与起始帧完全一致的姿态。温馨静谧的夜晚咖啡馆环境音。
```

#### 16. `C16` — CG_珍珠（同款珍珠戒指）
- **原画路径**：`海风与布丁/assets/art-upgrade/C16.webp` (`first_frame = C16.png`, `last_frame = C16.png`)
- **微动作设计**：阳光在两枚天青珍珠与银戒表面流转闪烁光泽 + 指尖细微自然的呼吸停驻微动 + 窗外海面波光与树影轻摇。
- **提示词（Prompt）**：
```text
高质量二次元Galgame道具特写CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。洒满明媚阳光的海滨手作工坊桌面近景，深蓝天鹅绒垫上放着一枚镶嵌天青色珍珠的银戒，右侧手掌指尖轻拈着另一枚同款天青珍珠戒指，窗外可见碧蓝海湾与白帆。阳光在两枚天青珍珠圆润的表面与银戒戒圈上流转闪烁细腻光泽，持戒指的手指做极其细微自然的呼吸停驻微动，窗外树影与海面波光微微摇曳，随后平滑回到与起始帧完全一致的画面。温暖晴朗的海滨午后微风声。
```

#### 17. `C17` — CG_打烊后披毯与海鲜面
- **原画路径**：`海风与布丁/assets/art-upgrade/C17.webp` (`first_frame = C17.png`, `last_frame = C17.png`)
- **微动作设计**：两碗海鲜面袅袅升起白色热气 + 少女单手托腮温柔眨眼微笑 + 暖黄灯光闪烁 + 身后鲸尾愉快轻晃后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。打烊后的海滨小店靠窗木桌旁，窗外是满月夜海，桌面上摆着两碗热气腾腾的海鲜面；披着米色针织披肩的蓝发少女（鲸鱼小姐）单手托腮，右手拿着筷子挑起面条，满脸幸福温暖的笑意望向对面的青年。两碗海鲜面袅袅升起轻柔的白色热气，少女温柔地眨眼微笑，暖黄灯光在她的蓝发与眼眸间柔和闪烁，身后的蓝白鲸尾愉快地轻轻晃动，随后平滑回到与起始帧完全一致的姿态。温馨夜晚室内与轻微热汤热气声。
```

#### 18. `C18` — CG_布丁（布丁是不是假的 / 集市鱼摊）
- **原画路径**：`海风与布丁/assets/art-upgrade/C18.webp` (`first_frame = C18.png`, `last_frame = C18.png`)
- **微动作设计**：害羞好奇眨眼 + 头顶环形呆毛与蓝发随集市海风轻晃 + 碎冰海鲜泛起晶莹微光 + 身后鲸尾轻轻摆动后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。阳光明媚的海滨集市街道生鲜鱼摊前，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）微微俯身站在铺满碎冰的海鲜摊位旁，左手轻扶右手臂，脸颊微红、眼神好奇又害羞地望向右侧指向摊位的青年。少女轻轻眨眼，头顶环形呆毛与蓝色长发在集市海风中轻轻晃动，碎冰上的海鲜在阳光下泛着晶莹微光，她身后的蓝白双叶鲸尾好奇地轻轻摆动，随后平滑回到与起始帧完全一致的姿态。热闹明朗的海滨集市微风声。
```

---

### 第三批（Batch 3 · 正在 `minimax3` A100-80GB #3 生成中）

#### 19. `C19` — CG_早安（正装门口早安）
- **原画路径**：`海风与布丁/assets/art-upgrade/C19.webp` (`first_frame = C19.png`, `last_frame = C19.png`)
- **微动作设计**：清晨阳光微尘浮动 + 少女长睫毛轻颤 + 微风吹拂蓝发与裙摆 + 身后鲸尾幸福地轻轻摇摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。清晨温暖阳光洒入海景新家玄关走廊，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）踮起脚尖双手环住白衬衫青年的脖颈，温柔甜蜜地亲吻青年的脸颊道早安。晨光尘埃在空气中柔和浮动，少女长睫毛轻轻颤动，窗外微风吹拂她柔顺的蓝色长发与裙摆，身后的蓝白双叶鲸尾幸福地轻轻摇摆，随后平滑回到与起始帧完全一致的姿态。温馨宁静的清晨阳光与微风声。
```

#### 20. `C20` — CG_尾巴缠手腕约定
- **原画路径**：`海风与布丁/assets/art-upgrade/C20.webp` (`first_frame = C20.png`, `last_frame = C20.png`)
- **微动作设计**：深情害羞眨眼与呼吸 + 窗边海风轻拂蓝发与窗帘 + 缠绕在青年手腕上的蓝白鲸尾尾尖轻柔摩挲微动后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。阳光温暖的海景卧室窗边，身穿深蓝连衣裙的蓝发少女（鲸鱼小姐）坐在床畔，右手与前景青年的手十指相扣，她光滑柔美的蓝白双叶鲸尾温柔地缠绕在青年的小臂与手腕上，少女脸颊绯红、眼神深情而害羞地凝视镜头。少女温柔眨眼、轻轻呼吸，阳光与海风轻拂她的蓝色长发与窗帘，缠绕在手腕上的蓝白鲸尾尾尖极其轻柔地摩挲微动，随后平滑回到与起始帧完全一致的姿态。静谧温柔的海滨室内微风声。
```

#### 21. `C21` — CG_月下共读初遇稿
- **原画路径**：`海风与布丁/assets/art-upgrade/C21.webp` (`first_frame = C21.png`, `last_frame = C21.png`)
- **微动作设计**：托腮温柔眨眼微笑 + 夜风吹动膝头初遇手稿书页与蓝发 + 提灯暖光与海面银月光辉映 + 鲸尾悠然轻摆后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。满月照耀的夜晚海岸礁石上，一盏温暖的露营提灯亮在身旁，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）与青年并肩而坐，膝上摊开当年的初遇手稿本，她右手托腮、带着怀念而温柔的微笑望向镜头。少女轻轻眨眼，夜风微微吹动膝头的手稿书页与她的蓝色长发，提灯暖光与海面银色月光交相辉映，身后的蓝白双叶鲸尾悠然轻摆，随后平滑回到与起始帧完全一致的姿态。温柔月夜海浪与书页轻响。
```

#### 22. `C22` — CG_海风与布丁（海风与布丁终幕）
- **原画路径**：`海风与布丁/assets/art-upgrade/C22.webp` (`first_frame = C22.png`, `last_frame = C22.png`)
- **微动作设计**：深情眨眼微笑 + 月光在无名指天青珍珠戒指与浅浪间闪烁 + 海风轻拂蓝发 + 身后鲸尾在月色海水中缓缓摆动后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame终幕剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。皎洁满月下的海岸浅滩，银色月光与浪花围绕身旁，身穿深蓝水手领连衣裙、无名指戴着天青珍珠戒指的蓝发少女（鲸鱼小姐）坐在浅水中，双手温柔握住前景青年的手贴在胸前，眼神无比温柔幸福。少女深情地眨眼微笑，月光在她的天青珍珠戒指与浅浪间闪烁，海风轻拂她的蓝色长发，身后的蓝白双叶鲸尾在月色海水中缓缓摆动，随后平滑回到与起始帧完全一致的姿态。永恒温柔的月夜海风与海浪声。
```

#### 23. `C24` — CG_集市女仆（集市上的女仆）
- **原画路径**：`海风与布丁/assets/art-upgrade/C24.webp` (`first_frame = C24.png`, `last_frame = C24.png`)
- **微动作设计**：递红苹果娇羞眨眼 + 蓝白耳鳍微颤 + 海风吹拂蓝发与黑白女仆围裙荷叶边 + 身后鲸尾害羞轻摇后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。阳光明媚的夏日海滨集市水果摊前，身穿黑白荷叶边可爱女仆装的蓝发少女（鲸鱼小姐）左臂挎着装满果蔬的藤编篮，右手拿起一颗红彤彤的苹果递向左侧青年，满脸羞红、眼神娇羞又可爱。少女害羞地眨眼，蓝白耳鳍微微颤动，海风吹拂她的蓝色长发与女仆围裙荷叶边，身后的蓝白双叶鲸尾害羞地轻轻摇晃，随后平滑回到与起始帧完全一致的姿态。明快热闹的海滨集市环境音。
```

#### 24. `C25` — CG_人鱼公主（贝壳番外·睡衣夜谈）
- **原画路径**：`海风与布丁/assets/art-upgrade/C25.webp` (`first_frame = C25.png`, `last_frame = C25.png`)
- **微动作设计**：抱着小鲸鱼毛绒玩偶均匀轻柔地睡眠呼吸起伏 + 床头露营提灯暖光摇曳 + 夜风轻拂枕畔蓝发与耳鳍。
- **提示词（Prompt）**：
```text
高质量二次元Galgame番外剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。夜晚温馨的海滩帆布帐篷内，床头露营提灯散发柔和暖光，帐篷外可见满月与夜海；身穿浅蓝色睡衣的蓝发少女（鲸鱼小姐）躺在柔软被褥上，怀里紧紧抱着一只圆滚滚的蓝色小鲸鱼毛绒玩偶，闭着双眼露出甜美安详的微笑。少女胸口随睡眠均匀轻柔地起伏呼吸，提灯暖光微微摇曳，夜风轻拂她散落在枕畔的蓝色长发与耳鳍，随后平滑回到与起始帧完全一致的姿态。静谧安详的夏夜海浪与轻柔呼吸声。
```

#### 25. `C26` — CG_打烊柜台坐姿·谈起梦想
- **原画路径**：`海风与布丁/assets/art-upgrade/C26.webp` (`first_frame = C26.png`, `last_frame = C26.png`)
- **微动作设计**：憧憬温柔眨眼 + 蓝发与垂在吧台边的双腿及蓝白双叶鲸尾轻轻晃动 + 店内暖黄灯光与窗外月海微闪。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。夜晚打烊后的「翡翠之梦」海景甜品店室内，大窗外是满月银海，店内暖光静谧；身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）优雅地坐在木制吧台边缘，双手轻扶吧台，温柔地诉说着心中的梦想。少女温柔眨眼、神情憧憬而恬静，蓝色长发与垂在吧台边的双腿及蓝白双叶鲸尾轻轻晃动，店内暖黄灯光柔和闪烁，随后平滑回到与起始帧完全一致的姿态。静谧温柔的深夜咖啡馆与远海波涛声。
```

#### 26. `O12` — 门口温热烤小鱿鱼（正式采用近景版）
- **原画路径**：`海风与布丁/assets/art-upgrade/O12.webp` (`first_frame = O12.png`, `last_frame = O12.png`)
- **微动作设计**：近景白瓷盘里的三只烤小鱿鱼袅袅升起细腻白色热气 + 后方提灯火光微闪 + 右侧夕阳海面金波荡漾。
- **提示词（Prompt）**：
```text
高质量二次元Galgame道具事件CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧画面完全一致。黄昏海岸米白色帆布帐篷门口近景，木制矮桌上的白色陶瓷盘里放着一串刚烤好的三只小鱿鱼，焦糖色烤鱿鱼表面泛着诱人光泽，正向上袅袅升起温柔细腻的白色热气；后方木箱上的露营提灯火光温暖微闪，右侧夕阳海面金波荡漾，随后平滑回到与起始帧完全一致的画面。温柔静谧的黄昏海浪与海风声。
```

#### 27. `CG_DRY` — 浅滩_午后_抱臂监视（晾晒画本与偷瞄）
- **原画路径**：`海风与布丁/assets/art-upgrade/CG_DRY.webp` (`first_frame = CG_DRY.png`, `last_frame = CG_DRY.png`)
- **微动作设计**：少女抱臂偷瞄轻轻眨眼 + 海风吹拂蓝发与左侧礁石上晾晒的笔记本页微微颤动 + 鲸尾尾尖轻轻点水泛起涟漪后归位。
- **提示词（Prompt）**：
```text
高质量二次元Galgame剧情CG无缝循环动画，固定镜头，严禁切镜头、严禁镜头旋转或推拉晃动，首尾帧姿态与构图完全一致。午后暖金阳光下的蔚蓝浅滩，左侧礁石上摊开晾晒着一本打开的笔记本与纸页；右侧清澈浅水中，身穿深蓝水手领连衣裙的蓝发少女（鲸鱼小姐）双臂抱胸站立，好奇地偷瞄礁石上的笔记本。少女轻轻眨眼，海风吹拂她飘逸的蓝色长发与礁石上的书页微微颤动，她身后的蓝白双叶鲸尾尾尖在阳光水面上轻轻点水泛起涟漪，随后平滑回到与起始帧完全一致的姿态。温暖午后海浪与微风声。
```
