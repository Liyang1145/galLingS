# 双击 游玩.html 自动后台启动 galLingS

> 状态：已实现（2026-10-20，分支 `fix/character-performance`）。只支持 Windows。

## 用法

1. 第一次：双击仓库根目录 `start.bat` 一次。它装好 `.venv`、依赖和 galcore，并**登记 `gallings-launch:` 链接**（只写当前用户注册表 `HKCU\Software\Classes\gallings-launch`，不要管理员权限）。
2. 以后：双击 `游玩.html`。没在运行就在后台启动 galLingS（不弹黑窗口），起来后自动进入 `http://127.0.0.1:8765/vn.html?game=海风与布丁`；已经在运行就直接进入。
3. 模型、记忆、作品文件夹在游戏「设置」里“灵枢 → 连接”下面的“在线聊天与连接”。

## 怎么做的

网页（file://）不能直接开进程，所以分三段：

| 文件 | 作用 |
|---|---|
| `游玩.html` | 用 `<script src="http://127.0.0.1:8765/api/ping.js">` 探测 galLingS（file:// 页面跨源也能载入脚本）。没有就在隐藏 iframe 里打开 `gallings-launch:start`，然后每秒探测一次（最多 10 分钟，第一次装依赖慢），起来就跳进作品页。12 秒还没起来就显示“启动 galLingS”按钮、“直接玩剧情”（离线 `content/imports/vnstudio/海风与布丁/index.html`）和排查办法。非 Windows 只提示手动运行 `python -m server`。 |
| `tools/launcher/gallings-bg.vbs` | 链接的处理程序（`wscript.exe`）。端口上已经有 galLingS 就什么都不做；否则隐藏窗口运行 `start.bat --bg`，输出写到 `logs\gallings-bg.log`。文件是 UTF-16 LE（带 BOM），wscript 才能正确显示中文。 |
| `start.bat --bg` | 后台模式：不问密钥（`set /p` 在隐藏窗口里会卡住）、`python -m server --no-browser`、出错不 `pause`。普通双击照旧。每次运行都会重新登记链接（仓库换了位置也会跟着改）。 |
| `server/api/app.py` `/api/ping.js` | 返回 `window.GL_PING && window.GL_PING({app:'galLingS'})`，不缓存。 |

浏览器第一次会问“要打开 galLingS 启动器吗”，选“打开”。后台的 galLingS 不会自己退出；要关掉就在任务管理器里结束 `python.exe`（或者重启电脑）。

## 验证（2026-10-20）

- Chromium：galLingS 在运行时 `游玩.html` 直接跳到作品页；不在运行时显示“正在后台启动”，12 秒后出现按钮和排查说明；非 Windows 隐藏启动按钮。
- 没有 Windows 环境，`gallings-bg.vbs` 和 `start.bat --bg` 的注册表登记、隐藏启动**没有实机验证**，需要在 Windows 上试一次。
