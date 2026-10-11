# 作品页（vn.html）：在 galLingS 里玩 VN Studio 做的完整作品

打开 `http://127.0.0.1:8765/vn.html`（或播放器顶栏 ▶ 作品）。galLingS 负责启动、模型、记忆和所有设置；
剧情由 VN Studio 导出的游戏自己跑，嵌在 16:9 画面里。

## 两种模式（同一局游戏、同一份手账）
- **窗口**：顶栏 + 中间画面 + 右侧栏。右侧栏就是游戏里的“鲸鱼小姐的手账”——游戏把手账直接画进这一栏（`VNHost.dock`），
  所以内容、样式和游戏里完全一样；左边缘拖动改宽度（双击恢复），✕ 收起后手账回到游戏里的书签。
- **全屏**：整块画面全屏，手账回到游戏里的书签；Esc 回到窗口。

## 设置（⚙，集中在 galLingS）
| 组 | 内容 | 存在哪 |
|---|---|---|
| 模型 | 服务地址、模型名、API 密钥、测试 | `~/.gallings/settings.json`；密钥在 `secrets.json`（本机，权限 600，网页只拿得到末 4 位）。系统环境变量 GALLINGS_LLM_API_KEY 优先 |
| 记忆 | 本地 / 灵枢 dsh-memory（填路径） | 同上；保存后插件重启 |
| 手账 | 陪伴模式、话量、全部遗忘 | 游戏的玩家偏好（随作品存在浏览器里） |
| 游戏 | 音乐 / 音效 / 语音音量、文字速度、自动播放、只快进已读、作品文件夹 | 同上；作品文件夹存 settings.json |

## 放作品
把 VN Studio 导出的游戏文件夹（里面有 index.html）放进 `content/vn/作品名/`（这个文件夹不进 git），刷新作品页即可。

## 接口
- `GET /api/vn/games`、`GET /vn/{作品}/{文件}`（不能跳出作品文件夹）
- `GET/POST /api/settings`、`POST /api/settings/test`
- 游戏侧接口 `window.VNHost`（同源直接调用）：`dock(el)`、`css()`、`state()`、`prefs()`、`setPref(k,v)`、`save()`、`load()`、`title()`、`forget()`、`connect()`。
  游戏网址带 `?host=gallings` 时才挂出来；这时游戏的灵枢自动连同源的 `/ws/soul`，游戏内设置里的“连接”一行改为“由 galLingS 管理”。
- 测试：`tests/demo/test_vn_page.py`；真浏览器测试在 VN Studio 的 `tests/pw26.py`。
