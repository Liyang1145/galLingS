# 灵枢记忆库、多模型插件、GalAgent 完整工具链与 MCP 扩展整合（含 Steam 双模客户端）

- 负责人 / 执行 agent：TanPowasd（引擎与桌面）
- 状态：已集成 / 已验证
- 更新时间：2026-10-21
- 任务分支：`fix/character-performance`、`tanpowasd/dev`（独立工作树 `e:\Lingshu-steam`）
- 基线提交：`8df7a7f`

## 本次目标与影响范围

按用户要求直接修复并合并以下四大核心能力到统一运行时与 Steam 桌面端：

1. **内置灵枢认知图 MCP 记忆库（`gallings.memory.lingshu`）**
   - 新增内置 `plugins/builtin/memory-lingshu/md_cg/mcp_server.py`，提供标准 JSON-RPC 2.0 stdio MCP 服务端（支持 `mdcg_remember`、`mdcg_search`、`mdcg_get`、`mdcg_link`、`mdcg_status`）。
   - 采用 BM25 + 语料 IDF 权重 + 16 组语义同义概念簇（解决换说法提问 / paraphrase）+ 认知图边激活扩散（Spreading Activation）+ `actor` 时间线硬隔离。
   - `dsh_memory_path` 默认留空即可直接使用内置灵枢认知图引擎，同时完全兼容用户手动指定外部 `dsh-memory` 仓库路径。
   - 同步升级 `gallings.memory.local` 的 IDF 与概念扩展，评测集 `tests/evals/memory.yaml` Recall @10 从 `71.4%` 提升至 **`100.0%`**，跨时间线污染率 `0.0%`。

2. **多模型 LLM 插件体系（`gallings.llm.*`）**
   - 新增三款内置模型插件，与原有 `gallings.llm.openai-compat` 组成完整四协议矩阵：
     - `gallings.llm.openai-compat`：OpenAI / DeepSeek / 硅基流动等兼容接口
     - `gallings.llm.anthropic`：Anthropic Claude `/v1/messages`（SSE 流式、`<think>` 块、`tool_use` 转换）
     - `gallings.llm.gemini`：Google Gemini `v1beta` `streamGenerateContent`（SSE 流式、`functionCall` 转换）
     - `gallings.llm.ollama`：本地 Ollama 免密钥直连
   - 升级 `server/settings_store.py`、`server/api/app.py`、`web/vn.html`、`web/vn.js` 与 `web/offline/steam-host.js`，支持在网页外框设置与游戏内设置面板一键切换模型协议与记忆底座，自动热重载后端插件。

3. **GalAgent 完整工具链与 MCP 扩展（`gallings.tool.galagent` + `gallings.tool.lingshu-mcp`）**
   - 新增内置 MCP 工具插件 `plugins/builtin/tool-lingshu-mcp/plugin.yaml`（`id: gallings.tool.lingshu-mcp`，`runtime.type: mcp`，`capabilities: [galagent]`），将 `mdcg_remember`、`mdcg_search`、`mdcg_get`、`mdcg_link`、`mdcg_status` 5 个灵枢认知图工具自动挂载进 `GalAgent`。
   - 扩展 `plugins/builtin/galagent/plugin.py` 与 `plugin.yaml`，支持在 `mcp_servers` 配置项中动态拉起任意外部 stdio MCP Server 并注入 `GalAgentSession`。
   - 修复 Windows 下 MCP stdio 子进程 UTF-8 编码环境变量（`PYTHONUTF8=1` / `PYTHONIOENCODING=utf-8`）及 `sys.executable` 自动解析。

4. **Steam / 桌面版客户端双模架构（`desktop/src-tauri/src/main.rs` + `tools/build_steam_release.py`）**
   - 桌面端启动时默认优先在后台静默拉起/连接本地 `python -m server --no-browser`（**完整引擎模式**），启用全部 Python 插件、灵枢认知图 MCP、多模型插件与 GalAgent 工具链，退出窗口时自动回收子进程。
   - 若运行环境无 Python，自动回退至 `app.localhost` + `galcore.wasm` **离线兜底模式**。
   - `tools/build_steam_release.py` 将 `server/`、`plugins/`、`compiler/`、`content/cards/`、`schemas/`、`web/`、`wheels/` 一并打包入 `dist/steam/content/`。

## 兼容变化与交叉点

- 原有 `/api/settings` 接口协议 100% 向后兼容；未传 `provider` 时自动按 `base_url` / `model` 推断或默认 `openai-compat`。
- 作品本体 `content/imports/vnstudio/海风与布丁/` 3315 节点、3308 台词 ID、音乐与立绘保持不变。

## 实际验证与交付

- `.\.venv\Scripts\python.exe -m pytest`：全仓 **184 passed, 1 skipped, 0 failed**。
- `.\.venv\Scripts\python.exe -m tests.evals.run --mode scripted`：灵枢记忆库评测 **Recall @10 = 100.0%**，时间线隔离 = **100.0%**，全部达标。
- `.\.venv\Scripts\python.exe tools/build_steam_release.py`：成功生成 `dist/steam/content/HaifengPudding.exe` 及完整双模发行包。
- `python tools/check_full_regression.py`：`nbad: 0`、`nerrs: 0`。

## 下一位 agent 的接续点

- 灵枢认知图 MCP、多模型插件、GalAgent MCP 扩展及 Steam 双模桌面包均已合入 `fix/character-performance` 与 `tanpowasd/dev`（`e:\Lingshu-steam`）。
