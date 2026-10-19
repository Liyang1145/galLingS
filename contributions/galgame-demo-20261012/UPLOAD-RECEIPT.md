# 工作区上传回执（2026-10-19 第一话关键剧情 CG 动画集 & Live2D v6 傲娇精修）

日期：2026-10-19，Asia/Shanghai。

- 仓库地址：<https://github.com/Liyang1145/galLingS>
- 主分支动画资产目录：`content/assets/cg-animations/chapter1/`
- 独立工作区快照分支目录：`contributions/galgame-demo-20261012/output/chapter1-cg-animations/`

---

## 本次更新内容（2026-10-19 · 第一话关键剧情 CG 动画集）

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

## 历史更新内容（2026-10-16 · Live2D v6 傲娇精修完成版）

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
