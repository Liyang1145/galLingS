# 2026-10-12 当前制作已恢复

用户已重新授权继续完整 Live2D 制作，最新原生源与下一步见 HANDOFF-LIVE2D.md。以下“暂停/上传快照”段落为此前阶段记录，不代表当前目标暂停。

---

# 2026-10-12 当前入口：完整工作区交接快照

Live2D 制作已按用户要求暂停，当前 v6 仍是制作中检查点。最新交接读 [UPLOAD-HANDOFF.md](UPLOAD-HANDOFF.md) 和 [HANDOFF-LIVE2D.md](HANDOFF-LIVE2D.md)。此前团队 galLingS 架构选择继续有效；保留的 RenPy 游戏、SDK、发行包和旧企划属于历史备份。此次用户明确授权立即上传全部非隐私工作区，覆盖旧的“不上传/待验收后上传”限制。

---

# 当前项目入口：团队重建的 galLingS

2026-10-10 用户明确要求完全弃用此前本地 Galgame 设计，以团队仓库重新开始。
当前工作目录为 `galLingS/`，权威入口为 `galLingS/README.md`、`galLingS/docs/PLAN.md`、`galLingS/docs/decisions.md`。
下方内容及根目录 `Seabreeze/`、`art/`、`dist/`、`tools/` 均为旧项目历史，不再作为新项目设计或素材来源。`运行游戏.bat` 仅启动旧版。

---

# 历史：海风与布丁 · 0.1.1 场景体验版

2026-10-09 按用户要求撤回 0.1.2 精修，恢复原版文案和 0.1.1 演出。双击根目录 `运行游戏.bat`，或运行 `dist/SeabreezePudding-0.1.1-win/SeabreezePudding.exe`。

第一话：153 段文本、4 次三选一、81 种选择组合；五张背景已接入，立绘留空，暂无正式音乐。支持存读档、回退、自动、快进、历史记录和设置。未接入 Steam。

## 开发

原稿为 `海风与布丁_第一季_全卷_v5.0.md`；`tools/build_chapter.py` 是固定行范围的第一话转换器。原稿增删行必须同步调整转换器，不能视作通用 Markdown 编译器。

```powershell
python tools/build_chapter.py
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' lint
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test chapter --savedir '.tools/test-saves'
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test smoke --savedir '.tools/test-saves'
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test scenery --savedir '.tools/test-saves'
```

## 保留的原版接入决定

- 第四组 C 选项暂接共同结尾，未向原稿添加新台词。
- 好感依分支计算为 -17 至 +20；原稿章末 +23 的差异保留待策划确认。
- `CG-001` 是初登场记录；掰糍粑未另行分配 CG ID。`CG-002` 属于第二话立约。
- 背景位于 `Seabreeze/game/images/scenes`，说明见 SCENES.md。
- 音乐文件可通过 `core.rpy` 的 MUSIC 字典接入；缺资源时静音。
- 原版存档机制保留，不承诺精修版存档兼容，回退后推荐新开游戏。

精修源码和文档已备份在 `backups/before-rollback-20261009-210044`；0.1.2 发行包仅作为历史保留，不是当前版本。
