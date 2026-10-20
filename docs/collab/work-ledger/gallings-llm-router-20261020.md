# galLingS 多模型插件 gallings.llm.router（设置 → 模型）

- 负责人 / 执行 agent：GalAgent boliyer（用户 2026-10-20 要求）/ Hark
- 状态：已集成（本地分支），已验证（假模型）；真服务商密钥未测
- 更新时间：2026-10-20
- 任务分支：`fix/character-performance`
- 基线提交：a88b213
- 交付：打包给用户；未推送

## 本次目标与影响范围

用户：“写个插件，把 API 接口集成进 galLingS”，格式参考三张截图（LLM API：主模型下拉、模型分配规则、模型列表 + ⋯ 菜单、添加模型弹窗：预设 / 显示名 / Base URL / API Key / Model Name / 高级参数），UI 和现有风格一致。

改动：
- 新插件 `plugins/builtin/llm-router/`（kind llm）：多模型、主模型、按用途分配、失败降级、测试、拉模型列表；自带设置面板 `web/panel.js` / `panel.css`。
- 插件设置面板规范（新）：`GET /api/plugin-panels`、`GET /plugin-web/<id>/<文件>`、`POST /api/plugin/<id>/<action>`（`server/api/app.py`），`Runtime.plugin(id)`；文档 plugin-format §10。
- `Runtime.llm_chain(purpose)`；调用处传用途：`session.py`（story）、`soul.py`（soul）、`post_ending.py`（chat，含独立运行版 `_MiniRuntime`）、建卡（cards）。
- `settings_store.py`：把旧单模型设置作为路由的 `seed`（首次导入）。
- `web/vn.html` / `vn.js`：设置“模型”一节可被插件面板接管（接管时隐藏旧输入框、底部“保存”不再写旧单模型设置）；“插件设置”一节给其它插件。
- `config.example.yaml`、`config.galagent.example.yaml`：llm 选 `[gallings.llm.router, gallings.llm.openai-compat]`。
- 文档：`docs/design/llm-router.md`（新）、plugin-format、ai-model、docs/README、README。

## 兼容变化与交叉点

- 不配多模型时行为不变（路由为空 → 走 openai-compat）。已有密钥的用户首次启动自动导入成第一条模型。
- 路由有模型后旧单模型插件不再兜底。
- 作品内「设置 → AI 模型」（离线直连）不受影响，托管时仍由后端管模型。
- 剧本、节点、素材、作品文件全部未动。没有改版本号。

## 实际验证与交付

见 [llm-router.md §6](../../design/llm-router.md)：单测 5 项 + `pytest tests/plugins` 53 passed 1 skipped；端到端 28/28；其余测试失败名单与改动前一致（沙箱无 galcore）。
