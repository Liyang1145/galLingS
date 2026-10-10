# galLingS

AI 驱动、角色卡驱动的 Galgame 后端引擎。剧本决定"发生什么"，角色卡决定"谁来演"，大模型以 agent 身份实时演出，确定性引擎负责校验、落账、存档与回放。

**当前阶段：设计中，只有 Plan，没有代码。**

- 详细计划：[docs/PLAN.md](docs/PLAN.md)
- 决策记录：[docs/decisions.md](docs/decisions.md)
- 记忆系统实测：[docs/memory-bench.md](docs/memory-bench.md)

Demo：《海风与布丁》第一话「浅滩上的偶遇」。技术栈：Python + C++（pybind11），默认模型 DeepSeek，记忆为灵枢（dsh-memory）底座 + AGM 补位。
