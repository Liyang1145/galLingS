# gallings.llm.router — 多模型（设置 → 模型）

作品页「设置 → 模型」里管理多个 OpenAI 兼容模型：点一行切换正在用的模型，每个模型可设思考等级（关 / 中 / 高）。

- `plugin.py`：插件本体（`LLMRouter`）+ 单个模型的流式客户端（`ProfileLLM`）+ 思考等级到各家参数的换算（`think_params`）+ 设置接口 `api(action, body)`。
- `sse.py`：SSE → 五种内部事件（与 openai-compat 同一份）。
- `web/panel.js`、`web/panel.css`：设置面板（插件设置面板规范见 `docs/design/plugin-format.md` §10）。

说明文档：[docs/design/llm-router.md](../../../docs/design/llm-router.md)。测试：`tests/plugins/test_llm_router.py`。
