# 全仓结构优化与 `4abcd03` 目录重构回归修复（2026-10-22）

- 负责人 / 执行 agent：TanPowasd（引擎与桌面封装）
- 状态：已验证
- 更新时间：2026-10-22
- 任务分支：`fix/character-performance`、`tanpowasd/dev`
- 基线提交：`4abcd03`（`origin/main`）
- 交付提交 / PR / Release 附件：已提交至 `fix/character-performance` 与 `tanpowasd/dev`

## 本次目标与影响范围

在拉取远端 `dc1e366..4abcd03`（共 12 个提交，含深海配乐接入与全仓目录重构）后，针对目录搬迁与 `player.js` 拆分遗留的回归问题及模块耦合进行系统修复与优化：

1. **修复 `4abcd03` 目录重构遗留的 4 项阻断性回归 Bug**：
   - **修复单作品目录双重拼接（Desktop CI `5a2ef42` 报错 & `Runtime.has_chapter = False`）**：在 [server/runtime.py](../../../server/runtime.py) 新增 `resolve_vn_game_dir(games_dir, vn_game)`，并在 `Runtime.__init__` 与 [tools/build_desktop_dist.py](../../../tools/build_desktop_dist.py) 中统一调用，兼容单作品直铺（`海风与布丁/index.html`）与多作品子目录（`game/vn/海风与布丁/index.html`）。
   - **修复单文件打包路径校验失败（`pytest` `test_single_file_builder.py`）**：更新 [tools/build_single_file_game.py](../../../tools/build_single_file_game.py)，允许读取 `GAME`、`content/` 与 `A素材库/` 下的资源。
   - **修复 `player.js` 拆分后单文件 HTML 与编辑器导出失效**：在 [tools/build_single_file_game.py](../../../tools/build_single_file_game.py) 与 [tools/build_playtest_html.py](../../../tools/build_playtest_html.py) 中自动内联 `<script src="player.js"></script>`；在 [海风与布丁/player.js](../../../海风与布丁/player.js) 的 `gameFolderFiles` 与 `buildGameHtml` 中兼容外置 `<script src="game.js"></script>` / `<script src="player.js"></script>` 标记与旧内联标记。
   - **修复 GitHub Actions 路径与全仓 73 处 Markdown 断链**：更新 `.github/workflows/{desktop,android,playtest-html}.yml` 中的作品路径为 `海风与布丁`，并修复 `A素材库/`、`docs/` 因目录层级迁移产生的全部 73 处断链。
2. **工具目录与 Steam 发行包瘦身**：
   - 将剩余 3 个特定批次音乐接入脚本（`integrate_atri_music.py`、`integrate_e4_music.py`、`integrate_m1_music.py`）移入 `tools/oneoff/`，更新 [tools/README.md](../../../tools/README.md) 按「构建与打包 / 回归与检查 / 素材与数据管线」三类归档 13 个长期工具。
   - 更新 [tools/build_steam_release.py](../../../tools/build_steam_release.py) 同步 `海风与布丁/galagent.vnplugin.js`，并移除 `dist/steam/content/` 下重复的第二份可执行文件拷贝。
3. **后端与内置插件底座解耦**：
   - 新增 [server/memory/text_index.py](../../../server/memory/text_index.py)，抽离 `memory-lingshu`（`md_cg/mcp_server.py`）与 `memory-local` 共用的中文分词、停用词表、16 组语义概念簇与 BM25/IDF 打分逻辑。
   - 新增 [server/plugins/sse.py](../../../server/plugins/sse.py)，抽离 `llm-openai-compat`、`llm-anthropic`、`llm-gemini`、`llm-ollama` 共用的异步 SSE 流解析器与 HTTP 错误构建器。
   - 将 546 行的 [server/api/app.py](../../../server/api/app.py) 拆分为 [guard.py](../../../server/api/guard.py)（`LocalOnlyGuard` 与 `NoCacheStaticFiles`）、[settings.py](../../../server/api/settings.py)（`/api/settings*`）、[host.py](../../../server/api/host.py)（`/__host/*`）与 [app.py](../../../server/api/app.py)。
4. **Tauri 桌面端 Rust 模块化拆分**：
   - 将 [desktop/src-tauri/src/main.rs](../../../desktop/src-tauri/src/main.rs) 拆分为 [backend.rs](../../../desktop/src-tauri/src/backend.rs)、[host_api.rs](../../../desktop/src-tauri/src/host_api.rs)、[tools.rs](../../../desktop/src-tauri/src/tools.rs) 与 [main.rs](../../../desktop/src-tauri/src/main.rs) 四个模块。

## 兼容变化与交叉点

- 保持 3315 节点、原 3308 句 ID 及顺序、第一话、选项与变量、现有音乐与停奏 100% 不变。
- `from server.api.app import create_app, lingshu_path_problem, LocalOnlyGuard` 与 `plugins/builtin/llm-openai-compat/sse.py` 导出接口保持完全向后兼容。

## 依赖与尚未对齐的内容

- 无阻塞依赖。

## 实际验证与交付

1. `.\.venv\Scripts\python.exe -m pytest`：**184 passed, 3 skipped, 0 failed**。
2. `.\.venv\Scripts\python.exe -m tests.evals.run --mode scripted`：**17/17 指标全 PASS**（记忆召回率 @10 = `100.0%`，时间线隔离 = `100.0%`）。
3. `.\.venv\Scripts\python.exe tools/build_steam_release.py`：`galcore.wasm`、`dist/desktop`、Tauri Rust 四模块编译及 `dist/steam/` 组装全部通过。
4. `.\.venv\Scripts\python.exe tools/check_full_regression.py 海风与布丁 $env:TEMP`：3315 节点全量走完，`nbad: 0`、`nerrs: 0`，存档/读档与回退键正常。
5. `.\.venv\Scripts\python.exe tools/check_md_links.py`：全仓链接检查 **0 断链**。

## 下一位 agent 的接续点

- `fix/character-performance` 与 `tanpowasd/dev` 已包含全部回归修复与结构优化，后续合入 `main` 前按 `AGENTS.md` 约定请先向音乐负责人 `@Liyang1145` 确认。
