# 海风与布丁 · 0.1.1 场景体验版

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
