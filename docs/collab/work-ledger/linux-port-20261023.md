# Linux 适配（桌面客户端 / 启动脚本 / Steam Depot）

- 负责人 / 执行 agent：TanPowasd（Hark）
- 状态：待集成（本地编译通过，CI 待跑）
- 更新时间：2026-10-23
- 任务分支：tanpowasd/linux
- 基线提交：51b0c75（tanpowasd/dev）
- 交付提交 / PR / Release 附件：见本分支提交；未开 PR，未合并

## 本次目标与影响范围

让 galLingS 在 Linux 上可开发运行、可打包桌面客户端和 Steam Linux Depot。
- `start.sh`：对应 `start.bat`，自动选 Python 3.11+（跳过缺 venv/ensurepip 的解释器）、建 `.venv`、装依赖、装/编译 galcore、启动 server。
- Tauri：Linux 用 `PR_SET_PDEATHSIG` 让外壳异常退出时后端随之退出；默认 `WEBKIT_DISABLE_DMABUF_RENDERER=1`（`GALLINGS_WEBKIT_DMABUF=1` 可关）；Linux 用 `app://localhost`，Windows 保持 `http://app.localhost`；deb 依赖 libwebkit2gtk-4.1-0 / libgtk-3-0；AppImage 打包媒体框架。
- `tools/build_steam_release.py`：`--platform windows|linux`（默认跟随当前系统），Linux 外壳 `gallings-desktop`、Depot 主程序 `HaifengPudding`，默认 Depot ID = AppID+2。
- `.github/workflows/desktop.yml`：新增 Ubuntu 22.04 `linux` job，产出 AppImage、deb、portable tar.gz、Steam Depot，artifact `gallings-desktop-linux`。
- `.gitattributes`：`*.sh text eol=lf`。

## 兼容变化与交叉点

Windows 路径、文件名、Depot ID 不变。不改存档、剧情、素材引用。与桌面封装（desktop-package.md）交叉。

## 依赖与尚未对齐的内容

- Steam Linux Depot 需要 Steamworks 后台新增 Linux Depot（AppID+2）与启动项，由有权限者配置。
- Linux 免安装包内的 Python 后端运行时随 CI 验证。
- `.gitattributes` 旧规则 `content/imports/vnstudio/海风与布丁/** -text` 仍未改为 `海风与布丁/** -text`（另行处理）。

## 实际验证与交付

- Debian 13 aarch64 沙箱：`start.sh --no-browser` 建 venv、源码编译 galcore、`/health` 返回 ok。
- `cargo build --release` 在 Linux 通过（本地关 LTO 仅为省内存），产出 ELF 可执行，`ldd` 无缺库。
- 本地为稀疏检出（无大图/音频），未做完整发行包与 GUI 实机运行；以 CI linux job 为准。

## 下一位 agent 的接续点

看 desktop workflow 的 linux job 结果；失败日志在 ci-logs/desktop-linux。通过后在真实 Linux 桌面跑 AppImage 冒烟。
