# galLingS ·《海风与布丁》

团队 Galgame《海风与布丁》的仓库：完整作品（十六话 + 两篇番外，3315 个节点）、唯一 TypeScript 剧情核心、共享播放器，以及 Windows、Android 本地宿主。必要资源安装完成后，主线必须完全离线可玩；联网角色聊天是独立的通关后玩法。

**开工先读**：[AGENTS.md](AGENTS.md) → [当前进度](docs/rebuild/status.md) → [实施入口](docs/rebuild/README.md)。历史交接与旧工作流仅供追溯，不是当前分支、审批或验证依据。重构只在 `rebuild` 开发和中文提交，不自动推送或发布。

## 当前本体入口

2026-10-26 已实现[独立 Agent 聊天基础](docs/rebuild/agent.md)：开发工具逐条选择已保存通关，显式连接服务/选择角色，逐轮确认上传再收文字流，可停止并隔离失败。随后按用户授权完成[离线基础验证](docs/rebuild/agent-verification.md)：类型检查、28 项 TS/HTTP、19 项 Python 与 11 项浏览器检查通过；只用脚本模型，临时服务已关闭。服务默认仍关闭、无模型/角色；正式解锁/供应未定，没有真实模型调用或两端重建。

2026-10-26 已将唯一作者源迁至 `content/story/`：按十六话、两篇番外及开局节点组拆分，变量、设置、分类资源与来源单独维护。构建、开发、终端和已有对白写回已改接同一分章读取器，原 `game.js` 数据与旧 TS 转换入口退出；详见[分章作者源](docs/rebuild/author-source.md)。本片未运行新读取器、测试、构建或试玩，之前的 Windows 产物未重新生成。

随后已按用户要求[清理无需保留的旧链路](docs/rebuild/cleanup.md)：旧 OP 编译器、Rust/WASM 剧情核心、托管会话/回放、专属桥/测试和旧核心 CI 已退出。`start.bat` / Python 服务只用于保留的旧制作与独立聊天，不再安装或运行旧剧情核心；完整美术制作、导出和聊天仍有真实消费者，继续保留。本轮未运行测试、构建或服务。

| 方式 | 入口 |
|---|---|
| 浏览器开发入口 | `npm run game:dev`，当前服务停止；开发资源位置不是离线发行包 |
| 随包游戏 | `npm run game:build`；输出含剧情、前端、素材及来源清单，运行端不加载旧播放器或作者脚本 |
| Windows | `npm run windows:prepare -- <游戏包摘要>`，再按输出命令编译唯一桌面宿主 |
| Android | `npm run android:prepare -- <游戏包摘要>`，再按输出命令构建 `:rebuild` |
| 制作入口 | 已有独立对白编辑/共享预览及旧制作工具保留；编辑器重构按用户要求暂停 |

2026-10-25 已按用户明确要求首次构建 Windows x64 应用，EXE/ZIP 位于 `dist/windows/海风与布丁-Windows-x64-d54a18a` 及同名 ZIP，来源/摘要见 [Windows 产出记录](docs/rebuild/windows.md#首次-windows-应用产出)。**已编译不代表运行验收**，尚未启动试玩，Android 未构建；测试仍由用户安排。完整环境、产物和待验证范围见 [实施入口](docs/rebuild/README.md)。

[正式运行配置](docs/rebuild/run-profile.md)已接入：随包正常游玩采用独立 `game/main`，不带开发工具/样例入口；Windows 与 Android 普通启动默认原生文件，开发入口继续隔离。包用途现为 `game`，旧试用产物须重新构建并准备。存档体验扩展、回退规则和异常退出恢复后置，现有机制保留；配置尚未运行验收。

2026-10-25 用户明确没有旧存档，不做旧档兼容或迁移，并授权清理旧链路。旧 Windows 启动器、Android `:app`、配套 Python 打包/注入脚本和三条旧游戏自动交付工作流已删除；没有启用新 CI 或发布产物。具体删除与保留依据见 [清理记录](docs/rebuild/cleanup.md)。

## 目录

| 目录 | 内容 |
|---|---|
| `content/story/` | 唯一分章作者输入，稳定节点/选项/资源身份及顺序保持 |
| `海风与布丁/assets/`、`A素材库/` | 当前素材、制作输入与来源，继续保留 |
| `content/game-ui/` | 原鲸鱼图形、游戏图标和迁移来源的独立定义 |
| `packages/story-model/`、`packages/story-runtime/`、`packages/player/` | 内容模型、唯一纯剧情核心及共享会话/表现 |
| `apps/game/` | 沿旧版外观迁移的本体界面与两端装配 |
| `desktop/`、`mobile/android/rebuild/` | 两端唯一原生游戏宿主 |
| `tools/content/`、`tools/game/` | 内容转换、共享游戏包、两端输入准备 |
| `apps/editor/`、`tools/editor/` | 暂停扩展的独立对白编辑及共享预览 |
| `packages/chat/` | 通关后只读上下文、独立流式会话/显式 HTTP 连接；正式联网发送尚未接入 |
| `server/api/aftergame.py`、`config.aftergame.example.yaml` | 默认关闭的独立无工具聊天开发服务，不由游戏或旧辅助服务启动 |
| 旧制作模板、`server/`、`plugins/`、`web/vn*` | 保留旧制作和独立聊天；旧 `core/` / `compiler/` 及托管回放已退出，不进入新主线 |
| `docs/rebuild/` | 当前实施事实、接口、命令与接续点 |

旧 HTML/播放器/样式仍由暂停迁移的制作导出消费，不再用作两端发行入口。历史素材和代码可从 Git 追溯，不通过保留旧原生启动器提供运行中回退，也不将新存档交给旧解释器。

## 授权

仓库公开（2026-10-16 起），但剧本、美术、音乐、配音的内容授权尚未决定，不等于开源授权。公开仓库里不要提交密钥、令牌或用户的私人信息。
