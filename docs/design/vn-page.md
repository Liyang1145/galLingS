# 作品页（vn.html）：在 galLingS 里玩 VN Studio 做的完整作品

打开 `http://127.0.0.1:8765/vn.html`（`start.bat` / `python -m server` 在作品文件夹里有游戏时会直接打开这里，否则照常打开 `/docs`）。galLingS 负责启动、模型、记忆和所有设置；
剧情由 VN Studio 导出的游戏自己跑，嵌在 16:9 画面里。

## 两种模式（同一局游戏、同一份手账）
- **窗口**：顶栏 + 中间画面 + 右侧栏。右侧栏就是游戏里的“鲸鱼小姐的手账”——游戏把手账直接画进这一栏（`VNHost.dock`），
  内容和游戏里完全一样，样式换成 galLingS 自己的淡蓝风格（style.css 里 `#soulDock #soul…` 一段覆盖游戏给的纸质样式）；左边缘拖动改宽度（双击恢复），✕ 收起后手账回到游戏里的书签。
- **全屏**：整块画面全屏，手账回到游戏里的书签，用游戏自己的纸质“鲸鱼小姐的手账”样式；Esc 回到窗口。

## 设置（⚙，集中在 galLingS）
| 组 | 内容 | 存在哪 |
|---|---|---|
| 模型 | 服务地址、模型名、API 密钥、测试 | `~/.gallings/settings.json`；密钥在 `secrets.json`（本机，权限 600，网页只拿得到末 4 位）。系统环境变量 GALLINGS_LLM_API_KEY 优先 |
| 记忆 | 本地 / 灵枢 dsh-memory（填 FuRongJun-1999/dsh-memory 检出目录，里面要有 md_cg/mcp_server.py；不对时 /api/settings 不改记忆设置并回 warn） | 同上；保存后插件重启；灵枢起不来自动落到本地 |
| 手账 | 陪伴模式、话量、全部遗忘 | 游戏的玩家偏好（随作品存在浏览器里） |
| 游戏 | 音乐 / 音效 / 语音音量、文字速度、自动播放、只快进已读、作品文件夹 | 同上；作品文件夹存 settings.json |

## 放作品
把 VN Studio 导出的游戏文件夹（里面有 index.html）放进 `content/imports/vnstudio/作品名/`（默认不进 git；用户明确授权代交的 `海风与布丁/` 目录已单独开放并归档，其他本地作品仍忽略），刷新作品页即可。

## 接口
- `GET /api/vn/games`、`GET /vn/{作品}/{文件}`（不能跳出作品文件夹）
- `GET/POST /api/settings`、`POST /api/settings/test`
- 游戏侧接口 `window.VNHost`（同源直接调用）：`dock(el)`、`css()`、`state()`、`prefs()`、`setPref(k,v)`、`save()`、`load()`、`title()`、`forget()`、`connect()`。
  游戏网址带 `?host=gallings` 时才挂出来；这时游戏的灵枢自动连同源的 `/ws/soul`，游戏内设置里的“连接”一行改为“由 galLingS 管理”。
- 安全：服务只监听 127.0.0.1，`/api/settings` 没有登录，所以有一道门卫（`server/api/app.py` 的 `LocalOnlyGuard`）：
  Host 必须是本机名（挡 DNS 重绑定），带 Origin 的请求必须来自本机网页（挡别的网站在后台改设置、偷用密钥）；`/ws/soul` 另外放行 `Origin: null`（双击打开的游戏）。
  config.yaml 把 server.host 改成非本机地址时不查 Host。作品和 galLingS 同源，**放进 content/imports/vnstudio 的作品等于本机程序**，只放自己信得过的。
- 测试：`tests/demo/test_vn_page.py`；真浏览器测试在 VN Studio 的 `tests/pw26.py`。

## 图标
界面图标一律是 lucide 线条 SVG（ISC 许可）：HTML 里直接内联，JS 里用 `web/icons.js` 的 `gi('名字')`。不再用 emoji，新图标从 lucide 取路径加进 GL_ICON。

## 插件（VN Studio v0.20+）

- 游戏启动时（托管模式）取 `GET /api/vn/plugins`，装上 galLingS 提供的 VN Studio 插件：GalAgent（`gallings.tool.galagent` 开着时，`/galagent/galagent.vnplugin.js`）+ `content/vn_plugins/*.js`（`vn.plugins_dir` 可改）。只收同源地址。
- 顶栏“插件”按钮调用 `VNHost.openPlugins()`，在游戏里打开插件面板（看状态、改设置、停用；玩家自己导入的插件也在这里卸载）。旧版游戏没有这个接口时按钮隐藏。
- 规范：VN Studio `PLUGIN_API.md`；GalAgent 见 `docs/design/galagent.md` §5。
