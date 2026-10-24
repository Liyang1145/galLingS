# 旧运行链路清理

2026-10-25 用户明确说明没有旧存档，不需要兼容或迁移，并授权直接清理旧东西。本片从 `b70793e` 接续，记录实际删除和仍有消费者的来源，不增加总体方案或验收结论。

后续从 `b72245e` 收尾[正式运行配置](run-profile.md)，已将随包正常记录接为 `game/main`、两端默认原生文件并移除正式页开发区。下文存储默认未改等表述记录清理切片当时的范围；当前启动以正式运行配置为准，仍未运行验收。

## 已清理

| 范围 | 实际处理 | 当前替代 |
|---|---|---|
| Windows 旧宿主 | 删除 `desktop/src-tauri/src/legacy.rs`，取消 `rebuild-host` 切换分支及特性；移除仅由旧模块使用的直接 `percent-encoding` 依赖和锁文件根依赖项 | `main.rs` 唯一调用 `rebuild::run()`；Python 探测/启动、旧 `/__host/`、旧存档/模型配置/工作区命令不再进入桌面宿主 |
| Windows 旧资源与安装配置 | 根配置不再映射 `dist/desktop`、不再默认生成旧 NSIS 安装包，应用身份/能力限制与现有共享前端宿主一致 | `game:build` → `windows:prepare`，只嵌入登记的共享前端；基础占位页没有游戏清单，不能作为可玩包启动 |
| Android 旧模块 | 删除 `mobile/android/app` 的四个已跟踪源文件，并从 `settings.gradle` 移除 `:app` | 只保留 `:rebuild`，消费 `android:prepare` 的共享前端/桥，不保留旧 `AndroidHost` 或 WebView 历史恢复 |
| Android 旧打包桥 | 删除 `mobile/prepare_assets.py`、`mobile/host.js` | `tools/game/android.ts` 与当前原生生命周期、显示、声音/记录桥；不再复制旧目录、改写素材尺寸或注入旧脚本 |
| Windows 旧打包 | 删除 `tools/build_desktop_dist.py`、`tools/build_steam_release.py` | 只用现有游戏包/Windows 准备；未据此提供 Steam 发行、签名或安装器 |
| 旧游戏自动交付 | 删除 `.github/workflows/desktop.yml`、`android.yml`、`playtest-html.yml` | 没有新增或启用替代工作流，不构建、上传、发布或修改远端 Release |
| 根目录旧游玩跳转 | 删除 `游玩.html`，不再将玩家自动送进旧 `index.html` | 根 README 只指向新游戏开发、共享游戏包和两端准备入口 |

Cargo 锁文件仅移除桌面根包不再使用的直接依赖条目，没有重新解析依赖、升级版本或删除其他依赖仍使用的传递包。删除针对上述已跟踪源码；没有递归清空目录、生成物或本机数据。

## 继续保留的实际输入

- `海风与布丁/game.js` 和固定身份基线：仍是唯一剧情输入与转换映射，不做作者源切换。
- 原素材、`A素材库`、授权/来源记录及 `content/game-ui`：新构建和制作工具仍实际消费。没有以清理旧代码为理由删图、音乐、语音或母版。
- `海风与布丁/index.html`、`player.js`、`game-polish.css` 与旧制作工具：`art-editor.js` 的 `sourceForExport()` 仍读取原 HTML 模板和 CSS，制作导出的 HTML 仍带旧播放器。这组文件属于当前暂停迁移的制作/导出依赖，不再由 Windows/Android 本体打包；保留不构成新主线运行回退。
- `tools/build_single_file_game.py`、`build_playtest_html.py`、`playtest_ledger.js`：保留制作项目导出和批注产物生成；前者仍有项目媒体打包的独立调用/测试。它们不再有自动发行工作流，不是新游戏/两端的构建入口，也不决定手账归属。
- `core`、`compiler`、`server`、`plugins` 及其现有测试/CI：仍是旧制作服务、导入和聊天能力的消费者，本体不再依赖它们。此次没有重做编辑器或替换模型供应，不按目录名删除仍用代码；普通 Python/Rust CI 没有被启用、运行或改写。

## 存储与命令边界

不实现旧档导入、旧数组下标映射、旧成果迁移或双写，不再将旧档兼容列为待确认项。新检查点和成果的格式/修订/损坏校验继续保留；它们处理新版本自身的有效性，不能因“没有旧档”而取消。

本片不改变已实现的存储装配：普通启动仍 IndexedDB，原生文件后端仍由现有运行参数/extra 显式选择；没有把清理授权扩展成另一项存储默认、数据迁移或正式 `game` 记录切换。宿主入口已经收敛，构建产物用途仍为 `integration-trial`，不冒充完整发行验收。

未来统一测试继续使用现有 `game:build`、`windows:prepare`、`android:prepare` 和准备命令输出的原生构建命令。旧的 `rebuild-host` 配置及已删除 Python 打包命令不再适用，Windows 输入须按当前命令重新准备；Android `:rebuild` 命令不变。没有执行这些命令，也没有测试、类型检查、编译、服务启动、独立复核或子代理。
