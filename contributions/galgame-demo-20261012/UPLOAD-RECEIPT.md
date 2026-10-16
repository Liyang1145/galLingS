# 工作区上传回执（2026-10-16 傲娇精修完成版）

日期：2026-10-16，Asia/Shanghai。

- 仓库地址：<https://github.com/Liyang1145/galLingS>
- 独立分支与目录：<https://github.com/Liyang1145/galLingS/tree/handoff/galgame-workspace-20261012/contributions/galgame-demo-20261012>
- 历史完整依赖包 Release：<https://github.com/Liyang1145/galLingS/releases/tag/workspace-20261012>

## 本次更新内容（2026-10-16）

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
   - 支持 5 组傲娇表情预设切换、镜头景别切换（面部特写 / Galgame半身 / 全身立绘）、鼠标视线/头部实时跟随及 13 项核心参数滑块实时微调。
5. **渲染验收图集**：
   - 见 `output/whale-girl-live2d-base/previews-v6-final/`（含修复前后对比、多姿态傲娇表情特写与全身渲染、互动预览器实机截图）。
