# gallings.llm.router — LLM API（多模型 + 分配规则）

作品页「设置 → 模型」里管理多个 OpenAI 兼容模型：主模型、按用途分配（剧情即兴 / 手账悄悄话 / 结局后聊天 / 建卡）、失败降级。

- `plugin.py`：插件本体（`LLMRouter`）+ 单个模型的流式客户端（`ProfileLLM`）+ 设置接口 `api(action, body)`。
- `sse.py`：SSE → 五种内部事件（与 openai-compat 同一份）。
- `web/panel.js`、`web/panel.css`：设置面板（插件设置面板规范见 `docs/design/plugin-format.md` §10）。

说明文档：[docs/design/llm-router.md](../../../docs/design/llm-router.md)。测试：`tests/plugins/test_llm_router.py`。
