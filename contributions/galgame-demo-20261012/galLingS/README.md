# galLingS

AI 驱动、角色卡驱动的 Galgame 后端引擎。剧本决定"发生什么"，角色卡决定"谁来演"，大模型以 agent 身份实时演出，确定性引擎负责校验、落账、存档与回放。

**当前阶段：设计中。已实现的代码只有插件插座（`server/plugins/`），其余仍是 Plan。**

- 详细计划：[docs/PLAN.md](docs/PLAN.md)
- 决策记录：[docs/decisions.md](docs/decisions.md)
- 记忆系统实测：[docs/memory-bench.md](docs/memory-bench.md)

Demo：《海风与布丁》第一话「浅滩上的偶遇」。技术栈：Python + C++（pybind11），默认模型 DeepSeek，记忆为灵枢（dsh-memory）底座 + AGM 补位。

## 插件插座

引擎是插座，模型、生图、语音、记忆、工具、守卫、导入导出都是插件。格式见 [`docs/plugin-format.md`](docs/plugin-format.md)。

```bash
pip install -e ".[dev]"
python -m server.plugins list
python -m server.plugins check --config config.example.yaml
python -m pytest            # 灵枢集成测试需设 GALLINGS_TEST_DSH=<dsh-memory 检出>
```
