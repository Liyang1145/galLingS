# 海风与布丁 · 剧本精修与演出增强版 0.1.2

基于《海风与布丁_第一季_全卷_v5.0.md》的 Ren'Py 独立桌面项目。首版范围是第一话，从浅滩醒来到“明天带酸梅汤，加桂花的”。

0.1.2 版本完成了剧本文学精修、全套镜头震颤与文本停顿演出接入，并重构了语义状态机编译工具链。

## 玩游戏

打开 `dist` 内 Windows 解压目录里的 `SeabreezePudding.exe`，或解压同名 ZIP 后启动。无需另装 Python 或 Ren'Py。

操作方式：
- 左键 / 空格：推进对话
- 滚轮向上：回退文本（Rollback）
- Esc：打开系统菜单
- 文本框底部快捷栏：提供回退、记录（历史）、快进、自动播放、存档、读档与设置
- 默认只跳过已读内容，可在设置中切换跳过全部

当前 0.1.2 接入五张场景背景（见 SCENES.md）；人物立绘按要求保持占位隐藏，未填充 CG、音乐或配音。没有接入 Steam SDK、成就和云存档。

## 工程结构与工具链

- `Seabreeze/game/chapter01.rpy`：编译生成的第一话脚本，154 段文本、4 次三选一分支，整合镜头震颤与打字停顿演出。
- `Seabreeze/game/core.rpy`：人物、状态、菜单及对话框界面（集成【※ 尾鳍诚实标记】专属青蓝高亮与视觉徽章）。
- `Seabreeze/game/options.rpy`：桌面和发行配置（版本号 0.1.2）。
- `Seabreeze/game/tests.rpy`：Ren'Py 原生运行自动化测试（81 全分支路径测试、smoke 菜单存读档测试、scenery 场景过渡测试）。
- `tools/build_chapter.py`：重构升级的语义状态机编译器，自动解析剧本结构标记与分支区间，彻底摆脱脆弱硬编码行号。
- `tools/source_map.json`：原稿 SHA-256 和生成的源码双向行映射。
- `tools/prepare_assets.py`：背景资源准备脚本与开源中文字体下载。
- `HANDOFF.md`：项目交接与团队协作文档（各工种指引、架构说明、设计决策与后续路线）。
- `VALIDATION.md`：自动化测试与引擎验收日志。
- `NEXT.md`：里程碑进度追踪与后续待办。

开发用 Ren'Py 8.5.3 SDK 位于 `.tools`，不应提交到 Git。普通玩家使用发行包。

```powershell
# 1. 语义编译第一话
python tools/build_chapter.py

# 2. 静态检查
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' lint

# 3. 自动化测试套件
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test chapter --savedir '.tools/test-saves'
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test smoke --savedir '.tools/test-saves'
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test scenery --savedir '.tools/test-saves'

# 4. Windows 发行包构建
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' '.tools/renpy-8.5.3-sdk/launcher' distribute 'Seabreeze' --package win --destination dist
```

## 内容接入决定

1. **分支平滑汇合**：第一话末组 C 选项（默默吃掉）已精修补齐吃完糍粑后的傲娇微表情、视线相对与轻微拍水细节，平滑汇入黄昏前共同结局。
2. **好感度数值体系**：好感按各分支严格执行，范围为 -17 至 +20；不使用原稿章末 +23 的汇总值。
3. **视线状态追踪**：第三组选 B（“记你”）后保留“她避开你的视线”演出标记。
4. **尾鳍诚实标记**：尾鳍说明接入对话框专属青蓝高亮（`#5eead4` / `#c8f5ed`）与【※ 尾鳍诚实标记 · 真实的身体信号】视觉徽章，作为独立的身体真实信号演出呈现，不折算成好感度，不向玩家暴露分值。
5. **事件与 CG**：`CG-001` 仅记录初登场事件已见，不代表正式 CG 已交付；不额外登记“掰糍粑”CG。
6. **存档机制**：章节结束自动保存 `auto-chapter-one`，通过读档界面的“自动”分页访问。普通存档、回滚均使用 Ren'Py 原生机制。
7. **数据兼容性**：全局已读与首次事件记录保留；路线好感与选择记录随存档恢复。

## 团队接入指南

- **音乐/音效**：在 `core.rpy` 的 `MUSIC` 字典把原稿 cue 映射到 `audio/...`。当前缺资源时安静停止，避免运行时网络下载。后续建议将环境音与音乐分独立通道接入。
- **美术**：当前背景位于 `images/scenes/`，运行时按 1280×720 缩放适配。鲸鱼小姐正式立绘需透明背景，并保留完整尾鳍，当前按要求隐藏占位卡。字体采用开源 Noto Sans SC。
- **策划/文案**：编译工具已升级为语义状态机，可自动识别 `【场景】`、`（选项）`、`——A/B/C线`、`【事件】` 等标准标记，无需手动调整硬编码行号。原稿修改后只需执行 `python tools/build_chapter.py` 即可自动完成重构与 source_map 生成。
- **仓库**：当前工程保存在本地，尚未推送到远端仓库。
