# tools/ 索引

## 日常在用
| 脚本 | 做什么 |
|---|---|
| `build_playtest_html.py` | 单文件试玩版（含对白账本，账本脚本 `playtest_ledger.js`）：`python tools/build_playtest_html.py 输出.html [作品文件夹]` |
| `build_single_file_game.py` | 早期的单文件打包（不含账本），保留兼容 |
| `build_desktop_dist.py` | 作品页离线包，供 `desktop/` Tauri 外壳和静态服务器 |
| `check_full_regression.py` | 全作回归：走完 3315 节点，报 nbad / nerrs |
| `check_editor_roundtrip.py` | D04：编辑器 JSON / 单文件 HTML / 文件夹导出往返无损 |
| `check_hosted_galcore.py` | B02：托管作品页下 galcore 接管剧情、连推、0 分歧 |
| `check_md_links.py` | 文档检查：仓库内所有 `.md` 的相对链接都指向存在的文件（`python tools/check_md_links.py`，有断链时退出码 1） |
| `build_art_catalog.py` | 生成编辑器用的美术目录 `art-catalog.js` |
| `build_current_art_gallery.py` | 只含当前在用图片的图库 |
| `compress_art_upgrade.py`、`compress_wav_assets.py` | 生成播放副本（webp / mp3），母图和 WAV 原件不动 |

安卓包相关脚本在 `mobile/`（`prepare_assets.py`、`host.js`），由 `.github/workflows/android.yml` 调用。

预发布 `html-playtest` 的自动构建（`.github/workflows/playtest-html.yml`：推送工作分支且改了作品文件夹、`build_playtest_html.py` 或 `playtest_ledger.js` 时用本脚本构建并上传 `haifeng-pudding-playtest.html`）已于 2026-10-20 按用户要求暂停；删不删先问用户（见 [待办总表](../docs/collab/待办总表.md) C06）。需要单文件时本地运行本脚本。

## 历次流水线（已执行，留作复现与审计）
下列脚本对应 10-13～10-16 各轮美术、音乐、演出接入，详情见对应 work-ledger。**它们基于当时的基线，直接重跑会覆盖之后的修改，不要在现行分支上重跑。**

| 类别 | 脚本 |
|---|---|
| 美术重制与修正 | `produce_art_upgrade.py`、`stage_art_upgrade.py`、`review_art_upgrade.py`、`apply_art_upgrade.py`、`verify_art_upgrade.py`、`build_art_upgrade_gallery.py`、`build_art_editor_preview.py`、`queue_art_corrections.py`、`queue_art_review_round2.py`、`queue_art_review_round3.py`、`queue_art_revision.py`、`continue_refined_cg_direction.py` |
| 开场与第一话 | `integrate_opening_revision.py`、`queue_opening_art_revision.py`、`prepare_opening_art_corrections.py`、`refine_opening_candidates.py`、`adopt_opening_refined_art.py`、`check_opening_art_sound.py` |
| 鲸尾与皮肤 | `prepare_tail_skin_corrections.py`、`adopt_tail_skin_corrections.py` |
| 坐姿与写诗 CG | `queue_seated_anatomy.py`、`rebuild_seated_anatomy.py`、`refine_seated_details.py`、`queue_writing_cg.py` |
| 角色演出 | `queue_character_direction.py`、`direct_character_scenes.py`、`check_character_direction.py`、`queue_character_performance.py`、`queue_character_performance_round2.py`、`restore_character_performance.py` |
| 场景融合 | `integrate_scene_staging.py`、`check_scene_integration.py` |
| 音乐接入 | `integrate_atri_music.py`、`integrate_e4_music.py`、`integrate_m1_music.py` |

## tools/hark/（保留仓库提交工具）
- `commit_tree.py` / `push_retry.sh`：blobless 浅克隆下不 checkout 直接提交、按需补 blob 推送。

生图和配音生产工作流已按负责人要求下载转本地，见[清理记录](../docs/collab/work-ledger/local-production-workflows-20261020.md)。
