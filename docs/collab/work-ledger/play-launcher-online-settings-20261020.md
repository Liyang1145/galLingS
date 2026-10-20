# 游玩.html 自动后台启动 + 在线设置挪进游戏设置（2026-10-20，boliyer / Hark）

## 需求
用户：“把 galLingS 集成到 游玩.html 中，双击后自动在后台创建 galLingS 服务器，再把在线聊天与连接设置挪到（游戏设置里“灵枢 → 连接”下面的）红框位置，只给需要替换的文件。”

## 改动
- `游玩.html`：探测 → 打开 `gallings-launch:` 链接后台启动 → 起来后进作品页；失败时可直接玩离线剧情。说明见 [launcher.md](../../design/launcher.md)。
- `tools/launcher/gallings-bg.vbs`（新）、`start.bat`（`--bg` 后台模式 + 登记链接）、`server/api/app.py`（`/api/ping.js`）。
- 作品 `content/imports/vnstudio/海风与布丁/index.html`：游戏设置里新增 `GL_ONLINE`（在线聊天与连接：模型 / 多模型插件面板 / 旧单模型输入 / 记忆底座 / dsh-memory 路径 / 作品文件夹 / 保存 / 接口文档），只在 galLingS 作品页里玩（HOSTED）且不是桌面离线版时出现，紧跟“连接”一行；去掉 HOSTED 时那行“AI 模型由 galLingS 统一管理”。`game-polish.css`：这块和多模型面板的游戏配色。
- 作品页 `web/vn.html` / `web/vn.js`：外框设置去掉“在线聊天与连接设置”（只剩声音与阅读、手账），去掉保存按钮；`web/vn-polish.css` 删对应样式。`tools/build_desktop_dist.py`：不再需要隐藏 `#onlineSettings`。
- 多模型面板 `panel.js`：密钥提示文字；`panel.css`：图标自带描边样式（不依赖宿主 `.gi`）。

## 验证
- 端到端（真服务 + 假模型 + Chromium）32/32：作品页外框没有在线设置；游戏设置里在线设置紧跟“连接”；多模型面板全流程；记忆底座切换；保存后重启插件列表还在；关掉再开设置面板还在；无脚本错误。
- `pytest tests/plugins` 54 passed 1 skipped；全仓库失败名单与改动前相同。
- Windows 上的注册表登记、vbs 隐藏启动没有实机验证。
