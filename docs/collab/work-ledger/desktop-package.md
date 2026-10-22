# 桌面封装（WASM 引擎 + Tauri）

- 负责人 / 执行 agent：TanPowasd（Hark）
- 状态：待集成
- 更新时间：2026-10-16
- 任务分支：tanpowasd/dev
- 基线提交：0f6de47（main）
- 交付提交 / PR / 附件：见本分支提交；安装包在 Actions → desktop → Artifacts

## 本次目标与影响范围

双击即玩、不装 Python 的 Windows 程序。新增：`core/src/lib.rs` 的 wasm 导出、`web/offline/`、`tools/build_desktop_dist.py`、`desktop/`、`.github/workflows/desktop.yml`、`tests/demo/test_wasm_parity.py`。改动：`web/galcore.vnplugin.js`（离线时改用页面内引擎）。

## 兼容变化与交叉点

服务端、作品原件、存档格式不变；在线（start.bat）行为不变。引擎桥只在 `GALLINGS_OFFLINE`（离线包的 vn.html 注入）为真时走本地引擎。

## 依赖与尚未对齐的内容

离线包无 AI 模式 / 结局后聊天 / 灵枢；手账用作品自带的本地回复。exe 未签名，首次运行 Windows SmartScreen 可能提示。

## 实际验证与交付

pytest 86 passed；WASM 与 Python 逐步 hash、快照一致；离线包用纯静态服务器 + Chromium 走通开局、选项、时间轴回放（回放一致）、存读档（L0.1）。

## 下一位 agent 的接续点

需要 AI 模式的桌面版时，可把 Python 服务打成 sidecar 由 Tauri 启动，引擎桥按现有 `/ws` 连接即可。

- 2026-10-18：合入 main（#8/#9 透明鲸鱼 UI），引擎桥钩子无改动；离线包重建（802 文件 195.0 MB，剧本哈希 b5665a7637f124c2 不变），Chromium 实测开局/选项/时间轴回放/存读档通过；pytest 86 passed 2 skipped。
