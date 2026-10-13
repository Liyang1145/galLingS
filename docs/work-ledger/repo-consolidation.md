# 仓库收敛：只留一个 galgame / galagent

- 负责人 / 执行 agent：@TanPowasd / Hark
- 状态：进行中（盘点完成，收敛方案待用户确认）
- 更新时间：2026-10-14
- 任务分支：`tanpowasd/dev`
- 基线提交：`f45ec51`
- 交付提交 / PR / 私有附件：本分支

## 本次目标与影响范围

按 PLAN §17.1 把仓库收敛成一个引擎、一个播放器、一份内容。第一步只盘点分类，见 [inventory.md](../inventory.md)；未移动、未删除任何文件。

## 兼容变化与交叉点

后续会涉及 `content/vn/`、`web/vn.*`、`游玩.html`、`start.bat`、`music/`、`docs/deliveries/` 的位置；与 Larry（VN Studio 作品）、boliyer（GalAgent）、@Liyang1145（音乐/素材）、`feat/art-editor-library` 交叉。存档定位按 C05 保留原节点 ID。

## 依赖与尚未对齐的内容

- 唯一运行时选哪套（建议：引擎为准，VN Studio 作品经导入插件转 OP）待用户确认。
- `ch01.md` / `beats.yaml` / `whale.yaml` 仍未入库。

## 实际验证与交付

仅文档；没有改代码，没有运行测试。

## 下一位 agent 的接续点

确认路线后：先写 `importer-vnstudio` 与 `web/player/`，跑通后再按 inventory §4 挪目录。
