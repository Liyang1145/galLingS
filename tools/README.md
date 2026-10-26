# tools/ 索引

2026-10-26 唯一作者源已迁至 `content/story/`，详见[分章源](../docs/rebuild/author-source.md)。`author_project.py` 提供保留工具共用的只读旧格式投影，`game_data.load` 对原作品地址转读新源，旧写入明确拒绝；不运行历史采纳脚本回灌当前作品。旧提取器 `content/inventory.mjs` 已退出，固定基线只作历史证据。

随后已[清退旧解释/回放链](../docs/rebuild/cleanup.md)：旧核心/托管专项检查 `check_full_regression.py`、`check_hosted_galcore.py` 已删除，不再作为现行工具列举；旧完整制作所需的导出/往返工具仍保留。本轮未执行命令、测试、构建或服务。

## 日常在用

新本体的唯一游戏/两端构建入口为根目录 `npm run game:build`、`windows:prepare` 和 `android:prepare`，详见 [实施入口](../docs/rebuild/README.md)。用户安排最后统一测试，当前不自动执行。旧 Windows Python/Steam 打包、Android 复制桥及三条旧游戏自动交付工作流已按 2026-10-25 授权删除，详见 [清理记录](../docs/rebuild/cleanup.md)。

| 脚本 | 做什么 |
|---|---|
| `build_playtest_html.py` | 保留的制作批注产物生成（含 `playtest_ledger.js`）；不是新本体或两端发行入口 |
| `build_single_file_game.py` | 保留的制作项目/原素材打包导出，不是新本体构建，也不承担旧档兼容 |
| `check_editor_roundtrip.py` | 仅旧制作的 JSON/HTML/文件夹往返对照；不是新分章源写回验收，不能直接套新作者目录 |
| `check_md_links.py` | 文档检查：仓库内所有 `.md` 的相对链接都指向存在的文件（`python tools/check_md_links.py`，有断链时退出码 1） |
| `build_art_catalog.py` | 生成编辑器用的美术目录 `art-catalog.js` |
| `build_current_art_gallery.py` | 只含当前在用图片的图库 |
| `compress_art_upgrade.py`、`compress_wav_assets.py` | 生成播放副本（webp / mp3），母图和 WAV 原件不动 |

上述制作导出工具随暂停重构的旧制作入口保留，没有自动构建或发布接线；历史交接中的旧工作流/审批不再适用。Android 现在只消费 `tools/game/android.ts` 准备的同份新游戏包。

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
