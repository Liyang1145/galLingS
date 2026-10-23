# 《海风与布丁》全剧 27 支精修 CG 首尾帧一致无缝循环动画交付记录（2026-10-23）

## 1. 交付概述
- **模型与算力**：使用 3 台并行 Google Colab `NVIDIA A100-SXM4-80GB` 实例运行 `MiniMax-H3`（`minimax_h3_fl2va_pruned_int8_convrot` + `8-step Turbo LoRA` + `Qwen3-VL-32B` 文本编码器）。
- **首尾帧一致无缝循环（`first_frame == last_frame`）**：严格按照团队同学要求“给 CG 做一段首尾帧一致的循环动画”，在 `MiniMaxH3ImageToVideo` 中将 `first_frame` 与 `last_frame` 同时锚定为最新精修版 CG 原画（`海风与布丁/assets/art-upgrade/*.webp`），固定镜头零切镜、零旋转眩晕，中间帧呈现自然的呼吸、眨眼、耳鳍轻颤、发丝拂动、鲸尾摇曳与环境光影（水波、焦散、篝火、热气、月光），并在尾帧平滑回到与起始帧完全一致的姿态。
- **交付目录**：`A素材库/cg-animations/loops/`（包含全部 27 支 `.mp4` 循环动画、`index.html` 在线预览画廊、`manifest.json`、`CG_循环动画提示词总表.md` 及 3 张首尾帧核验总表 `cg_loop_verify_batch1~3.jpg`）。

## 2. 27 支无缝循环 CG 清单
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
