# 游戏内 AI 模型接口 + 离线结局后聊天入口（修 B08）

- 负责人 / 执行 agent：GalAgent boliyer（用户 2026-10-20 要求）/ Hark
- 状态：已集成（本地分支），已验证（假模型）；真服务商密钥未测
- 更新时间：2026-10-20
- 任务分支：`fix/character-performance`
- 基线提交：8037d3e
- 交付：用户要求打包仓库压缩包发给他；未推送

## 本次目标与影响范围

用户：“看看游戏本身有没有 API 接口，没有就加，要充分融合到现在的 UI 里。”核对结果：游戏离线时连不了任何模型，灵枢只有离线 / galLingS，GalAgent 插件只在作品页托管时才装上（待办 B08）。

改动：
- `content/imports/vnstudio/海风与布丁/index.html`（引擎）：新增 `VNModel` + `MODEL_PRESETS`（OpenAI 兼容流式 chat、function calling、推理流、错误分类、测试）；设置面板「AI 模型」一节；灵枢连接加「AI 模型」+ `SOUL_BRAINS.api`；`VNAgent` 大脑 `model`；编辑器设置弹窗加「AI 模型」与模型填写；插件接口 `vn.model`、事件 `model:changed`。
- `game-polish.css`：输入框 / 下拉的海底主题样式（和按钮一套），小屏放大。
- `game.js`：只加了 `plugins`（GalAgent 0.4.0 项目插件），其余逐字不变。
- `plugins/builtin/galagent/web/`：`galagent-ui.js` 新增 `ApiClient`；顺手修 `MockClient` 没设 `ready` 导致离线模拟一句就报“连接已断开”的旧问题；`vnplugin.src.js` 按 后端 → AI 模型 → 离线模拟 选连接，离线时开场提示去填模型；重新生成 `galagent.vnplugin.js`。
- 新工具 `tools/embed_galagent_plugin.py`；文档 `docs/design/ai-model.md`、`galagent.md`、待办 B08、`游玩.html` 说明。

## 兼容变化与交叉点

- 偏好：新增 localStorage `vnmodel:<作品id>`，不进存档、不进项目。灵枢 `soulBackend` 没手动选过时，填了模型默认 `api`；选过的不变。
- 托管（作品页）行为不变：后端插件覆盖随作品的 GalAgent，模型由 galLingS 管。
- 剧本、3315 节点、句 ID、选项变量、音乐素材全部未动。没有改版本号。

## 实际验证与交付

见 [ai-model.md §7](../../design/ai-model.md)：假 OpenAI 服务 + Chromium 20/20；全作回归 nbad 0 / nerrs 0；`pytest tests/plugins` 47 passed 1 skipped；demo/contract 与基线一致（沙箱无 galcore）。

## 下一位 agent 的接续点

- 用真实 DeepSeek 等密钥实测人设与工具调用（B01，需要账户）。
- 单文件试玩版 / APK 重建后自然带上（GalAgent 在 game.js 里），未重建。
- 改 GalAgent 前端后记得 `build_vnplugin.py` + `embed_galagent_plugin.py`。
