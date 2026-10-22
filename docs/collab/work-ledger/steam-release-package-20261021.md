# Steam 完整发行版封装与 B08 结局后 GalAgent 入口补齐

- 负责人 / 执行 agent：TanPowasd（引擎与桌面）
- 状态：已集成 / 已验证
- 更新时间：2026-10-21
- 任务分支：`fix/character-performance`
- 基线提交：`fad065e`
- 交付提交 / PR / Release 附件：本地 `dist/steam/`（可通过 `python tools/build_steam_release.py` 一键复现；仓库公开，未提交任何 API 密钥或个人凭据）

## 本次目标与影响范围

按用户明确要求（“做成可以发布 Steam 的游戏，我要最完整的：含完整离线剧本与引擎、内置 GalAgent 结局后聊天 + 游戏内直接填 API Key、纯净游戏模式、本地文件存档供 Steam Auto-Cloud 云同步、SteamPipe 免安装仓库目录”），完成以下工作：

1. **Steam 桌面外壳与原生主机桥（[desktop/src-tauri/src/main.rs](../../../desktop/src-tauri/src/main.rs)、[desktop/src-tauri/Cargo.toml](../../../desktop/src-tauri/Cargo.toml)）**
   - 启动默认进入纯净游戏模式（`/vn.html?steam=1`），窗口尺寸提升至 `1440×900`（最小 `960×540`）。
   - 新增原生本地文件存档接口 `GET / POST /__host/saves`：将 `slots`（6 个手动槽 + 快存 + 自动存 + `galcore` 快照）、`global`（CG/结局解锁、通关数、全局变量）、`prefs`、`read`、`plugins` 原子写入 `%APPDATA%/com.gallings.haifeng/saves/*.json`（便携模式下为 `userdata/saves/*.json`），供 Steam Auto-Cloud 直接按 `*.json` 同步。
   - 新增独立大模型配置接口 `GET / POST /__host/llm`：存于 `%APPDATA%/com.gallings.haifeng/config/llm.json`，与 `saves/` 目录物理隔离，防止 Steam 云存档同步泄露玩家私人 API Key。
   - 新增窗口控制接口 `POST /__host/window`（原生全屏切换 `toggle_fullscreen`、打开存档目录 `open_save_dir`、退出游戏 `quit`）与桌面工具执行接口 `POST /__host/tool`（`get_time`、`list_dir`、`read_file`、`write_file`、`powershell`，限定在 `workspace/` 目录内）。
2. **前端 Steam 桥接、本地存档同步与直连大模型客户端（[web/offline/steam-host.js](../../../web/offline/steam-host.js)、[web/offline/local-session.js](../../../web/offline/local-session.js)、[web/vn.html](../../../web/vn.html)、[web/galcore.vnplugin.js](../../../web/galcore.vnplugin.js)）**
   - 在 `app.localhost` 启动时同步水合本地文件存档至 `localStorage` 与 `IndexedDB`，并拦截写入实时落盘。
   - 纯净游戏模式下默认隐藏外层开发顶栏，`F11` / `Alt+Enter` 切换全屏，`F10` / `Ctrl+Shift+D` 展开/收起调试顶栏与引擎时间轴，标题画面提供「退出游戏」。
   - 游戏内「设置」（`#psettings`）新增「Steam 桌面版与 AI 接入」分区：支持全屏切换、打开本地存档文件夹、切换「纯选项 / AI 模式（可自己说）」、配置并测试任意 OpenAI 兼容 API（DeepSeek / OpenAI / 本地 Ollama 等）。
   - `web/offline/local-session.js` 补齐离线 `galcore.wasm` 下的 `mode = 'ai'` 与 `type: 'input'`（支持字面选项匹配、大模型意图分类与即兴回复、`turn_begin` / `say` / `shift_affection` / `turn_commit` 完整引擎结算）。
   - 灵枢手账悄悄话在未连 Python 后端但已填 API Key 时自动走 `GallingsLLM` 生成角色回复，未填 Key 时无缝回退离线手账。
3. **修复待办 B08：结局卡与标题画面的 GalAgent 结局后聊天入口（[plugins/builtin/galagent/web/galagent-ui.js](../../../plugins/builtin/galagent/web/galagent-ui.js)、[plugins/builtin/galagent/web/vnplugin.src.js](../../../plugins/builtin/galagent/web/vnplugin.src.js)、[content/imports/vnstudio/海风与布丁/index.html](../../../海风与布丁/index.html)）**
   - `galagent-ui.js` 新增 `DirectClient`（内置 JS 版 `StreamSplitter` 解析 `<think>` 与 `<emotion>`，支持流式对话、前端工具 `get_vars`/`set_var`/`play_se` 以及 Tauri 桌面工具 `get_time`/`list_dir`/`read_file`/`write_file`/`powershell` 审批流），并丰富未配 Key 时 `MockClient` 的鲸鱼小姐角色化回复。
   - `vnplugin.src.js` 除结局卡按钮外，新增标题画面入口 `vn.ui.addTitleButton({ label: '和鲸鱼小姐聊聊', ... })`；从标题画面进入时自动布置舞台背景与鲸鱼小姐立绘，退出时返回标题画面（从结局卡进入时退出仍回结局卡）。
   - 打包同步 `content/imports/vnstudio/海风与布丁/galagent.vnplugin.js`，并在作品 `index.html` 的 `loadHost()` 中支持非托管游戏模式（直接打开作品 `index.html`）自动挂载同目录 `galagent.vnplugin.js`，彻底解决 B08。
4. **一键构建 SteamPipe 发行目录（[tools/build_steam_release.py](../../../tools/build_steam_release.py)、[tools/build_desktop_dist.py](../../../tools/build_desktop_dist.py)、[.github/workflows/desktop.yml](../../../.github/workflows/desktop.yml)）**
   - `python tools/build_steam_release.py` 一键编译 `galcore.wasm`、生成 `dist/desktop/`、编译 `gallings-desktop.exe` 并输出 `dist/steam/content/`（含 `HaifengPudding.exe`、`game/`、`steam_appid.txt`）及 `dist/steam/steampipe/{app_build,depot_build}.vdf` 与 `STEAMWORKS_GUIDE.md`。

## 兼容变化与交叉点

- **剧本与美术零改动**：严格保留 3315 节点、原 3308 句 ID 及顺序、用户第一话、选项与变量、全部配乐与音效；标题菜单保持在右侧。
- **编辑器往返无损**：作品 `index.html` 的单文件导出（`/_single.html`）与文件夹导出（`/_folder/`）不注入运行时宿主插件状态，`window.VN_GAME` 与 `ORIGINAL_HTML` 保持往返一致。

## 依赖与尚未对齐的内容

- 正式上架 Steam 时，只需把 `dist/steam/content/steam_appid.txt` 与 `dist/steam/steampipe/*.vdf` 中的测试 AppID `480` 替换为团队正式申请的 Steam AppID / DepotID。

## 实际验证与交付

- `python tools/build_steam_release.py`：Release 构建通过，产出 `dist/steam/content/`（1711 个文件，277.9 MB）。
- 浏览器端到端回归（Steam 离线包 `/vn.html?steam=1` + 独立打开 `content/imports/vnstudio/海风与布丁/index.html`）：纯净模式、标题与结局卡「和鲸鱼小姐聊聊」入口、对话收发与退出返回、设置内 AI 配置分区、AI 模式切换均验证通过，页面报错 0。
- `python tools/check_full_regression.py`、`python tools/check_editor_roundtrip.py`、`python tools/check_hosted_galcore.py`、`pytest`、`python tools/check_md_links.py` 全部通过。

## 下一位 agent 的接续点

- 构建 Steam 发行包直接运行 `python tools/build_steam_release.py`。
- 若修改了 `plugins/builtin/galagent/web/galagent-ui.js` 或 `vnplugin.src.js`，运行 `python plugins/builtin/galagent/web/build_vnplugin.py` 并同步到 `content/imports/vnstudio/海风与布丁/galagent.vnplugin.js`（`build_steam_release.py` 已自动执行此步）。
