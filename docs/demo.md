# 第一话后端：运行与试玩状态

> 2026-10-11：按用户要求移除旧版网页试玩 `web/index.html` 和 `web/player.js`。当前画面、音乐试听使用用户提供的《海风与布丁 技术DEMO》本地包（十六话＋两篇番外）；它尚未提交到仓库或连接本仓库后端。下文安装步骤启动的是后端服务，根路径转到 `/docs`，建卡页仍可保存角色卡。

## 一、在 Windows 演示机上运行

1. 装 Python 3.11 或更新（安装时勾选 *Add to PATH*）。
2. 拿到内容包（剧本、角色卡，见 `content/README.md`），解压到 `content\`。
3. 拿到 galcore 轮子：GitHub → Actions → 最近一次 `ci` → Artifacts → `galcore-windows-latest`，把里面的 `.whl` 放进 `wheels\`。
   （装了 Rust 的机器可以跳过这步，`start.bat` 会自己编译。）
4. 双击 `start.bat`。第一次会建 `.venv`、装依赖、装 galcore，然后问 DeepSeek API key（回车跳过 = 只能纯选项），浏览器打开 `http://127.0.0.1:8765/`，随后转到 API 文档 `/docs`。

key 只放在这次运行的环境变量里，不写文件、不进日志。也可以提前在系统环境变量里设 `GALLINGS_LLM_API_KEY`。

数据都在 `%USERPROFILE%\.gallings\`：事件日志（`sessions\<id>\events.jsonl`）、玩家建的卡、演绎缓存、本地记忆。

### macOS / Linux

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt maturin
(cd core && maturin build --release --out ../wheels) && pip install --no-index --find-links wheels galcore
export GALLINGS_LLM_API_KEY=...   # 可选
python -m server
```

## 二、旧版演示脚本（历史记录，对应 PLAN §20）

以下流程依赖已删除的旧播放器，当前不能按此进行网页试玩。后端会话、角色卡、记录与回放能力继续保留；新技术 DEMO 与后端的连接待实现。

| 时段 | 操作 | 看点 |
|---|---|---|
| 0–3 分 | 默认「纯选项」，点着走到第一个选项点，选一个 | 无 AI 也是完整游戏；右下角尾鳍计数，勾「作弊」才显示好感 |
| 3–8 分 | 切「AI 模式」，在选项点直接打字：一句剧本外的话、一句作死的话 | 她用原作语气接；尾鳍出卖；时间轴里 `propose_affection` 被**裁剪**、`request_ending` 被**驳回**、越期称呼被**守卫拦下后重写** |
| 8–12 分 | 打开「建卡页」，贴人设 → AI 填卡 → 改两个字段 → 校验 → 启用并重演 | 同一份剧本换人演；节拍、选项、好感不变；适配度提示只提示不阻断 |
| 12–15 分 | 看右侧调试时间轴，点任意一行 | 从头回放到那一刻，显示"state_hash 逐条一致"；记忆召回里标出 AGM 补位与联想路径 |

彩排时可在同一局里：存档 → 打一句有特征的话 → 读档 → 再问她，她不会提起（时间轴里能看到新时间线 `L0.1`）。

## 三、做了什么、留了什么

| 能力 | 状态 | 位置 |
|---|---|---|
| 剧本编译（Markdown → OP 程序 + 校验报告 + 好感可达区间） | ✅ | `compiler/` |
| 确定性核心：OP 解释器、状态机、裁决规则、AI 回合事务、快照、时间线、AGM 扩散、状态哈希 | ✅ Rust | `core/src/` |
| 事件日志 + 逐条哈希回放 | ✅ | `server/recorder.py`、`server/replay.py`、`python -m server.replay <日志>` |
| 导演：意图分类、AI 回合、按句闸门、降级阶梯 L1–L4、≤3 轮引回 | ✅ | `server/session.py` |
| 文本守卫：出戏、红线、禁用写法、逆鳞、称呼越期、提示注入、锁定台词哈希 | ✅ | `server/guard/text.py` |
| 记忆：本地记忆 / 灵枢插件 + 时间线过滤 + AGM 补位（7 + 3） | ✅ | `server/memory/`、`plugins/builtin/memory-*` |
| 日记（AI 模式通关后她写一篇，只读日记本） | ✅ | `session.write_diary` |
| 演绎层：换卡演同一章 | ✅ | `server/director/perform.py` |
| 建卡页：AI 填卡 → 修改 → 校验（含适配度守卫）→ 保存 | ✅ | `web/cards.html`、`server/cards/` |
| 旧 Web 播放器 + 调试时间轴 | 已移除 | 用户指定使用本地技术 DEMO；后端回放接口仍保留 |
| 生图 / TTS | 🔌 预留：插件 kind `image` / `tts`、`SAY.voice`、工具 `generate_image` / `speak`（引擎驳回为 reserved） | `server/plugins/kinds.py` |
| Live2D | 🔌 预留：`SPRITE.kind = static\|live2d`、卡 `assets.live2d` | |
| 剧本外新分支 / 新结局 | 🔌 预留：`propose_branch` / `request_ending` 记录并驳回；`END` 只由导演 / 剧本发出 | |
| 结局后自由聊天 | 🔌 预留：配置 `game.post_ending`、`POST /api/post_ending/chat`（501） | |
| 跨局记忆 | 🔌 预留：配置 `game.cross_run_memory`；时间线机制已可复用 | |
| 外部 Agent 端口 | 🔌 预留：`GET /api/agent/tools` 导出工具注册表；`POST /api/agent/call`（501） | `schemas/tools.json` |
| 动态混音 | 🔌 预留：工具 `propose_music_mood` | |
| 录制回放演示模式 | 🔌 半成品：日志可逐条回放；整局"重播给观众看"未做 | |

## 四、测试

```bash
cd core && cargo test          # Rust 单测
python -m pytest -q            # 全部 Python 测试（正式剧本在场时多跑 1000 条随机路径）
```

自动化覆盖 PLAN §18 的这些验收：编译产物字节一致；随机路径全部通关、好感落在区间；AI 回合好感裁剪、尾鳍上限、结局 / 逆鳞驳回；事务回滚；3 轮后引回；意图命中走原选项；读档后不召回被放弃时间线；回放 `state_hash` 逐条一致；注入判越界；模型不调工具时降级到默认台词。

## 五、已知限制

- 没用真模型跑过评测集（PLAN §19.2）：需要 key，按约定先征得同意再跑。
- 换卡演绎是"开局后台分段生成 + 本机缓存"，第一次开新卡的头几句可能要等几秒。
- 灵枢插件在本机需先配好灵枢自身的身份 / 令牌；没配时用本地记忆插件（`gallings.memory.local`）。
- 本地技术 DEMO 与后端尚未接入，不能把其画面试听视作 AI 会话联调完成。
