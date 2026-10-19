# galLingS ·《海风与布丁》

团队 Galgame《海风与布丁》的仓库：完整作品（十六话 + 两篇番外，3315 个节点）、AI 驱动的后端引擎，以及桌面版、安卓试玩包的打包。

**开工先读**：[AGENTS.md](AGENTS.md) → [文档目录 docs/README.md](docs/README.md) → [接手说明](docs/collab/接手说明.md) → [工作流速查](docs/collab/工作流速查.md) → [最新交接](docs/collab/handoff/Hark会话交接_20261020.md) → [待办总表](docs/collab/待办总表.md) → [决策记录](docs/decisions.md)。

## 怎么玩

| 方式 | 入口 |
|---|---|
| 浏览器离线剧情 | 双击根目录 [游玩.html](游玩.html)（读 `content/imports/vnstudio/海风与布丁/`） |
| 编辑器（美术、剧情、舞台） | [引擎开发.html](引擎开发.html)，或作品页加 `?editor=1` |
| 托管作品页 + AI 结局后聊天 | 运行 `start.bat`，打开 `http://127.0.0.1:8765/vn.html`（模型在设置里配置） |
| 单文件试玩版（含对白账本） | `python tools/build_playtest_html.py 输出.html`；预发布 `html-playtest` 的自动构建（`.github/workflows/playtest-html.yml`）已于 10-20 按用户要求暂停 |
| 安卓 APK | 推工作分支后由 `.github/workflows/android.yml` 自动构建，见预发布 `android-playtest` |
| Windows 桌面版 | `.github/workflows/desktop.yml`（main、tanpowasd/dev） |

## 现状（2026-10-20）

- 接续分支 `fix/character-performance`；`main` 停在 f336b35，合 main 要先问音乐负责人 @Liyang1145。分支细节和未完成事项见 [Hark 会话交接 20261020](docs/collab/handoff/Hark会话交接_20261020.md)。
- 作品：Larry 的 VN Studio 作品为基线，接入了用户新写的第一话（开场演出 10-19 重做）、Image2.5 修图（尾巴一律对齐 L01，图片改动先给用户验收）、背景/CG 3840 高清化、Atri 与用户的配乐、鲸鱼小姐配音（第一～七话新音色）、Atri 的回退/设置界面。
- 后端：Rust 确定性核心 galcore 接管剧情；Schema 与契约测试、整局录制回放、评测集（scripted）、守卫修复已完成。真模型评测、灵枢记忆接入、现场彩排待办；离线版结局后没有 AI 模式入口（待办 B08）。
- 待拍板事项见 [待办总表](docs/collab/待办总表.md)。

## 目录

| 目录 | 内容 |
|---|---|
| `content/imports/vnstudio/海风与布丁/` | **可运行的作品本体**：`index.html` 播放器 + 编辑器、`game.js` 剧本与资源表、`assets/` 运行素材 |
| `content/assets/` | 素材原件：美术母图（`art-upgrade/originals/`）、场景背景、音乐、音效、配音参考 |
| `content/scripts/`、`content/cards/` | 剧本草稿、角色卡（鲸鱼小姐） |
| `core/` | Rust 核心 galcore：OP 解释器、状态机、裁决、快照、时间线、AGM、状态哈希 |
| `compiler/` | 剧本编译器：Markdown → OP 程序 + 校验报告 |
| `server/` | 导演、守卫、记忆网关、演绎层、事件录制与回放、HTTP / WS |
| `plugins/` | 插件：模型、记忆（本地 / 灵枢）、守卫、GalAgent 等，格式见 [plugin-format](docs/design/plugin-format.md) |
| `schemas/` | 编译产物、事件、WS 协议、插件、角色卡的 JSON Schema |
| `web/` | 托管作品页（galcore 桥、回放）与建卡页 |
| `desktop/` | Tauri 桌面外壳 |
| `mobile/` | 安卓 WebView 外壳、APK 专用横竖屏脚本、素材整理 |
| `tools/` | 构建、检查与历次素材流水线脚本，索引见 [tools/README.md](tools/README.md) |
| `tests/` | Python 测试、契约测试（`contract/`）、评测（`evals/`） |
| `docs/` | 计划、决策、设计、内容方向、协作记录 |
| `archive/deliveries/` | 各次交付的原件清单、校验与验证截图 |

## 开发

```bash
pip install -e ".[dev]"
python -m pytest                                   # 灵枢集成测试需设 GALLINGS_TEST_DSH=<dsh-memory 检出>
python tools/check_full_regression.py              # 全作 3315 节点回归（需要 playwright）
python -m server.plugins check --config config.example.yaml
python -m server.replay <日志或局ID> --serve        # 整局回放，不调用模型
```

协议、剧本语法、角色卡格式：[protocol](docs/protocol.md) · [script-syntax](docs/script-syntax.md) · [card-format](docs/card-format.md)。

## 授权

仓库公开（2026-10-16 起），但剧本、美术、音乐、配音的内容授权尚未决定，不等于开源授权。公开仓库里不要提交密钥、令牌或用户的私人信息。
