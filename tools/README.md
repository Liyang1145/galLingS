# tools/ 索引

`tools/` 根目录保留 **日常长期使用的工具脚本**（分成「构建与打包」「回归与检查」「素材与数据管线」三类）；历史一次性批次脚本已统一归档至 `tools/oneoff/`。

## 1. 构建与打包（Build & Release）
| 脚本 | 用途 |
|---|---|
| [build_steam_release.py](build_steam_release.py) | 一键构建《海风与布丁》Steam 发行包（双模架构：Python 灵枢完整引擎 + `galcore.wasm` 离线兜底 + 多模型插件 + 灵枢认知图 MCP + GalAgent 完整工具链） |
| [build_desktop_dist.py](build_desktop_dist.py) | 生成作品页离线包 `dist/desktop/`，供 `desktop/` Tauri 外壳和静态服务器使用 |
| [build_playtest_html.py](build_playtest_html.py) | 生成单文件试玩版 HTML（含对白账本 [playtest_ledger.js](playtest_ledger.js)）：`python tools/build_playtest_html.py 输出.html [作品文件夹]` |
| [build_single_file_game.py](build_single_file_game.py) | 生成无账本单文件 HTML 及 `.manifest.json`（保留兼容与单测验证） |

## 2. 回归与检查（Regression & Checks）
| 脚本 | 用途 |
|---|---|
| [check_full_regression.py](check_full_regression.py) | 全作回归：在浏览器中走完 3315 节点，检查 `nbad` / `nerrs`、CG 解码与存读档往返 |
| [check_editor_roundtrip.py](check_editor_roundtrip.py) | D04：编辑器 JSON / 单文件 HTML / 文件夹导出往返无损验证 |
| [check_hosted_galcore.py](check_hosted_galcore.py) | B02：托管作品页下 `galcore` 接管剧情、连推、0 分歧验证 |
| [check_md_links.py](check_md_links.py) | 文档检查：校验仓库内所有 `.md` 的相对链接是否指向存在的文件（有断链时退出码 1） |

## 3. 素材与数据管线（Assets & Data）
| 脚本 | 用途 |
|---|---|
| [game_data.py](game_data.py) | 作品 `game.js` 读写公共辅助函数（`load_game` / `save_game`，自动输出多行 diff 友好格式） |
| [build_art_catalog.py](build_art_catalog.py) | 生成编辑器用的美术目录 `art-catalog.js` |
| [build_current_art_gallery.py](build_current_art_gallery.py) | 生成当前在用图片图库 |
| [compress_art_upgrade.py](compress_art_upgrade.py)、[compress_wav_assets.py](compress_wav_assets.py) | 生成播放副本（WebP / MP3），母图和 WAV 原件不动 |
| [produce_art_upgrade.py](produce_art_upgrade.py)、[stage_art_upgrade.py](stage_art_upgrade.py)、[apply_art_upgrade.py](apply_art_upgrade.py)、[verify_art_upgrade.py](verify_art_upgrade.py) | 美术重制生成、暂存、应用与校验四步流水线 |

安卓包相关脚本在 `mobile/`（`prepare_assets.py`、`host.js`），由 `.github/workflows/android.yml` 调用。

预发布 `html-playtest` 的自动构建（`.github/workflows/playtest-html.yml`）已于 2026-10-20 按用户要求暂停；删不删先问用户（见 [待办总表](../docs/collab/待办总表.md) C06）。需要单文件时本地运行 `build_playtest_html.py`。

## 4. `tools/oneoff/`（历次一次性流水线归档）
下列脚本对应 10-13～10-21 各轮美术、音乐、演出接入，详情见对应 work-ledger，已全部移入 `tools/oneoff/` 留作审计与复现。**它们基于当时的基线，不要在现行分支上直接重跑。**

| 类别 | 脚本（位于 `tools/oneoff/`） |
|---|---|
| 美术重制与修正 | `review_art_upgrade.py`、`build_art_upgrade_gallery.py`、`build_art_editor_preview.py`、`queue_art_corrections.py`、`queue_art_review_round2.py`、`queue_art_review_round3.py`、`queue_art_revision.py`、`continue_refined_cg_direction.py` |
| 开场与第一话 | `integrate_opening_revision.py`、`queue_opening_art_revision.py`、`prepare_opening_art_corrections.py`、`refine_opening_candidates.py`、`adopt_opening_refined_art.py`、`check_opening_art_sound.py` |
| 鲸尾与皮肤 | `prepare_tail_skin_corrections.py`、`adopt_tail_skin_corrections.py` |
| 坐姿与写诗 CG | `queue_seated_anatomy.py`、`rebuild_seated_anatomy.py`、`refine_seated_details.py`、`queue_writing_cg.py` |
| 角色演出 | `queue_character_direction.py`、`direct_character_scenes.py`、`check_character_direction.py`、`queue_character_performance.py`、`queue_character_performance_round2.py`、`restore_character_performance.py` |
| 场景融合 | `integrate_scene_staging.py`、`check_scene_integration.py` |
| 音乐接入 | `integrate_atri_music.py`、`integrate_e4_music.py`、`integrate_m1_music.py` |

## 5. `tools/hark/`（保留仓库提交工具）
- `commit_tree.py` / `push_retry.sh`：blobless 浅克隆下不 checkout 直接提交、按需补 blob 推送。

生图和配音生产工作流已按负责人要求下载转本地，见[清理记录](../docs/collab/work-ledger/local-production-workflows-20261020.md)。
