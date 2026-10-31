# 《海风与布丁》项目交接与团队协作文档

> **版本**：v0.1.2 剧本精修与演出增强版  
> **更新时间**：2026-10-09  
> **当前状态**：第一话全流程就绪、81 分支自动化验证通过、发行包构建完成

---

## 一、 项目背景与版本基线

《海风与布丁》（*Seabreeze & Pudding*）是基于同名原创剧本（原稿约 7800 行，共十六话+番外）制作的 **Ren'Py 独立桌面 Galgame / 视觉小说**。

### 1.1 当前实现范围（0.1.2）
- **剧本范围**：第一话《浅滩上的偶遇》（从正午浅滩苏醒到傍晚带酸梅汤的约定）。
- **流程体量**：共 154 个对话文本块、4 次三选一分支，排列组合共 **81 种走向组合**。
- **好感度系统**：按玩家选择实时浮动，全话好感度结算范围为 `[-17, +20]`。
- **演出系统**：已接入全套相机冲击力震屏（`hpunch` / `vpunch`）、文本断句节奏停顿（`{w=...}`）、以及【※ 尾鳍诚实标记】专属青蓝高亮与视觉徽章。
- **美术资产**：已接入 5 张高分辨率手绘风格场景（正午、午后、黄昏前、黄昏、帐篷外），人物立绘目前保持占位隐藏。
- **打包发行**：已构建完整的 Windows 独立绿色运行包及一键运行脚本。

---

## 二、 目录结构与模块职责

```text
GALgame demo/
├── 海风与布丁_第一季_全卷_v5.0.md   # 核心剧本原稿（文案/策划维护源文件）
├── 运行游戏.bat                     # 根目录一键启动脚本（直接拉起 0.1.2 绿色版）
├── README.md                        # 项目总览、快速运行说明
├── HANDOFF.md                       # 本交接文档（架构、工种指南、设计决策）
├── NEXT.md                          # 当前里程碑进度与后续待办
├── SCENES.md                        # 场景规格清单与构图参考规范
├── VALIDATION.md                    # 引擎基线与自动化测试验收记录
│
├── Seabreeze/                       # Ren'Py 游戏工程源码
│   └── game/
│       ├── chapter01.rpy            # 编译生成的第一话剧本与演出脚本
│       ├── core.rpy                 # 角色定义、系统UI、对话框、存读档与设置
│       ├── options.rpy              # 视窗尺寸、发行规则、存档目录隔离配置
│       ├── tests.rpy                # Ren'Py 原生自动化测试套件（81 分支/菜单/场景）
│       ├── fonts/                   # 开源中文字体（Noto Sans SC，OFL 开源许可）
│       └── images/scenes/           # 5 张手绘风格场景背景图
│
├── tools/                           # 自动化构建与工程工具链
│   ├── build_chapter.py             # 语义状态机编译器（原稿 Markdown -> Ren'Py 脚本）
│   ├── source_map.json              # 原稿行号与生成脚本双向映射（SHA-256 校验）
│   ├── prepare_assets.py            # 占位图生成与字体准备脚本
│   └── scene_manifest.json          # 场景背景资产哈希与大小清单
│
├── dist/                            # 发行输出目录
│   ├── SeabreezePudding-0.1.2-win/  # 解压即玩的完整绿色版（开发/玩家直接运行）
│   └── SeabreezePudding-0.1.2-win.zip # 独立分发压缩包（55.3 MB）
│
└── .tools/                          # 本地开发依赖（包含免配置的 Ren'Py 8.5.3 SDK）
```

---

## 三、 快速启动与环境说明

### 3.1 玩家 / 策划试玩体验
- **方式一（最简）**：直接双击根目录下的 `运行游戏.bat`。
- **方式二**：进入 `dist/SeabreezePudding-0.1.2-win/` 目录，双击 `SeabreezePudding.exe`。
- *无需额外安装 Python、Ren'Py 或任何运行库。*

### 3.2 开发者环境与工具链
本项目已在 `.tools/renpy-8.5.3-sdk` 预置了完整的 Ren'Py 8.5.3（基于 Python 3.10）运行环境。

**常用构建与测试指令（PowerShell）：**

```powershell
# 1. 编译剧本（从 Markdown 生成 chapter01.rpy 与 source_map.json）
python tools/build_chapter.py

# 2. Ren'Py 静态代码检查（Lint）
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' lint

# 3. 运行自动化测试套件（测试存档隔离至 .tools/test-saves）
# 3.1 跑遍全部 81 条分支路径（测试好感度计算、视线标记、通关标记）
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test chapter --savedir '.tools/test-saves'

# 3.2 界面 Smoke 测试（测试标题、设置、存读档、读档后重选、历史记录）
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test smoke --savedir '.tools/test-saves'

# 3.3 场景切换与 Dissolve 测试
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' 'Seabreeze' test scenery --savedir '.tools/test-saves'

# 4. 构建 Windows 发行包（自动输出至 dist/）
& '.tools/renpy-8.5.3-sdk/lib/py3-windows-x86_64/python.exe' '.tools/renpy-8.5.3-sdk/renpy.py' '.tools/renpy-8.5.3-sdk/launcher' distribute 'Seabreeze' --package win --destination dist
```

---

## 四、 各工种接手与协作指引

### 4.1 文案 / 策划接手指引

1. **原稿编辑文件**：直接在 `海风与布丁_第一季_全卷_v5.0.md` 中编辑。
2. **语法标记规范**：
   - 场景转换：`【场景】浅滩 · 午后`
   - 背景音乐：`【BGM】「翡翠之梦」完整版`
   - 立绘状态：`【立绘】鲸鱼小姐（生气·叉腰）`
   - 选项菜单：`（选项）`，随后紧跟 `A 「...」`、`B 「...」`、`C 「...」`
   - 分支标记：`——A线——`、`——B线——`、`——C线——`、`——汇合——`
   - 数值结算：`◆好感度+10` 或 `◆好感度-5`
   - 尾鳍信号：`※尾鳍拍水×2（收着力）` 或 `（尾鳍在水里悄悄勾住我的脚踝……）`
   - 对话台词：`鲸鱼小姐「...」`、`我：「...」`、`旁白：...`
3. **重新编译**：
   修改原稿后，运行 `python tools/build_chapter.py` 即可。编译器已重构为**语义状态机**，会自动扫描语法结构，无需手动调整行号。
4. **扩展第二话**：
   第二话《暗号契约》已在原稿第 439 行之后，后续可参照第一话的编译结构扩展 `build_chapter.py`，支持多章节连续编译。

### 4.2 美术接手指引

1. **场景背景**：
   - 存放在 `Seabreeze/game/images/scenes/`。
   - 运行时标准显示分辨率为 1280×720，高分辨率原图会自动通过 `Transform` 缩放到 1280×720。
   - 场景风格与构图规范请详阅 [SCENES.md](file:///./SCENES.md)。
2. **角色立绘（鲸鱼小姐）**：
   - 规格：透明 PNG 格式，画面需完整保留下半身的鲸尾。
   - 当前在 `core.rpy` 中通过 `define show_portrait_placeholder = False` 暂时隐藏了纯文字占位框。
   - 正式立绘就绪后，在 `images/` 目录下放置 `whale_angry.png`、`whale_shy.png` 等，并在 `core.rpy` 中声明 `image whale angry = ...`。
3. **事件 CG**：
   - 第一话目前预留了 2 处 CG 锚点：
     - `CG-001`：初登场（蓝黑长发垂肩，天青色眼眸，雪白鲸尾拍打浅滩）；
     - `CG-002`：掰糍粑（大半塞自己嘴里鼓起两腮，小半塞给玩家）。

### 4.3 音频 / 音乐接手指引

1. **音频接入点**：
   - 位于 `Seabreeze/game/core.rpy` 中的 `MUSIC` 字典。
   - 示例：
     ```python
     MUSIC = {
         "潮声（环境音）": "audio/bgm_waves.ogg",
         "角色曲「翡翠之梦」前奏": "audio/bgm_emerald_dream_intro.ogg",
         "「翡翠之梦」完整版": "audio/bgm_emerald_dream_full.ogg",
     }
     ```
2. **静音容错机制**：
   - 目前如果 `MUSIC` 中未找到文件或文件不存在，引擎会安全地静音淡出（`fadeout=0.7`），绝不崩溃。
   - 正式音频就绪后，将 `.ogg` 或 `.mp3` 放入 `Seabreeze/game/audio/` 并更新映射即可。

### 4.4 程序 / 引擎接手指引

1. **UI 与样式定制**：
   - 全局主题色为深海蓝青调：主色 `#092935`、强调亮青色 `#5eead4`、文字象牙白 `#f3eee2`。
   - 对话框 `screen say`、快捷栏 `quick_menu`、存读档 `screen files`、历史记录 `screen history` 均集中在 `Seabreeze/game/core.rpy` 中维护。
2. **存档隔离**：
   - 玩家存档目录配置在 `options.rpy`：`config.save_directory = "SeabreezePudding-0.1-player"`。
   - 自动化测试存档配置为 `--savedir '.tools/test-saves'`，确保测试不会污染玩家正式存档。
3. **自动化测试套件**：
   - 测试脚本位于 `Seabreeze/game/tests.rpy`。
   - 打包发行时，`options.rpy` 已配置排除规则：自动忽略 `tests.rpy`、`tests.rpyc` 以及 `tests/` 目录，防止开发测试文件泄漏到公开发行包中。

---

## 五、 关键设计决策沉淀（Design Decisions）

1. **攻略第二套信号系统（尾鳍诚实标记）**：
   - **决策**：游戏中**不向玩家显示好感度数值**（如不弹出 +10/-5 飘字），保持沉浸感与傲娇角色的心理防御。
   - **实现**：玩家追的是少女潜意识的身体语言——对话框右上角接入【※ 尾鳍诚实标记】，并以高亮斜体青蓝色突出尾鳍的真实动作（卷圈、拍水、甩圈）。
2. **第四组 C 选项（默默吃掉）逻辑闭环**：
   - **决策**：C 分支不导向 Game Over，也不中断剧情，而是平滑接回黄昏共同约定。
   - **实现**：通过男主安静吃完、拍掉碎屑的从容钝感，反衬少女期待落空后的傲娇炸毛，在男主说出「明天还来」时完美完成情感闭环。
3. **严格受控的语义状态机编译器**：
   - **决策**：不使用无规则的第三方通用 Markdown 解析器，也不使用脆弱的行号硬编码。
   - **实现**：基于原稿标准标记行（`【场景】`、`（选项）`、`——A/B/C线`）进行分词和状态转换，确保剧本原稿在修改文笔和增减行数时，编译管线与源码映射 100% 稳健。

---

## 六、 后续迭代规划（Roadmap）

- [ ] **收集试玩反馈**：由文案和玩家进行第一话实际通关体验，调整打字停顿与震屏演出节奏。
- [ ] **美术资源接入**：替换 AI 场景背景为正式原画；接入透明底鲸鱼小姐立绘（含表情差分）。
- [ ] **音频接入**：录制并混音第一话环境音（海风、潮声、海鸥）与主题曲《翡翠之梦》。
- [ ] **扩展第二话《暗号契约》**：接入暗号确认契约与家规系统。
- [ ] **进阶系统（后续章节）**：碎片收集系统、日记回看系统、Steam SDK 与成就系统对接。
