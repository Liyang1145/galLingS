# galLingS

AI 驱动、角色卡驱动的 Galgame 后端引擎。剧本决定"发生什么"，角色卡决定"谁来演"，大模型以 agent 身份实时演出，确定性引擎负责校验、落账、存档与回放。

**当前阶段：第一话后端会话能力已实现，旧版网页试玩已移除。** `start.bat` 启动后端服务并打开 API 文档，运行说明见 [docs/demo.md](docs/demo.md)。画面与交互 DEMO 以 LarryE135 准备提供的最新进度为准；当前仓库保留后端、项目文档与素材库。音乐仍处于探索阶段。

- 后端运行与试玩状态：[docs/demo.md](docs/demo.md)
- 详细计划：[docs/PLAN.md](docs/PLAN.md)
- 决策记录：[docs/decisions.md](docs/decisions.md)
- 音乐方向与负责人：[docs/music-direction.md](docs/music-direction.md)
- 记忆系统实测：[docs/memory-bench.md](docs/memory-bench.md)

Demo：《海风与布丁》第一话「浅滩上的偶遇」。技术栈：Python + Rust（PyO3），默认模型 DeepSeek，记忆为灵枢（dsh-memory）底座 + AGM 补位。

## 目录

| 目录 | 内容 |
|---|---|
| `core/` | Rust 确定性核心 galcore：OP 解释器、状态机、裁决、快照、时间线、AGM、状态哈希 |
| `compiler/` | 剧本编译器：Markdown → OP 程序 + 校验报告 |
| `server/` | 导演、守卫、记忆网关、演绎层、事件记录与回放、HTTP/WS |
| `plugins/builtin/` | 内置插件（模型、记忆、守卫、工具） |
| `web/` | 建卡页与共享样式；旧播放器已移除 |
| `schemas/` | 插件清单、角色卡、工具注册表 |
| `tests/` | Rust 之外的全部测试；`fixtures/` 是原创迷你章节 |

## 插件插座

引擎是插座，模型、生图、语音、记忆、工具、守卫、导入导出都是插件。格式见 [`docs/plugin-format.md`](docs/plugin-format.md)。

```bash
pip install -e ".[dev]"
python -m server.plugins list
python -m server.plugins check --config config.example.yaml
python -m pytest            # 灵枢集成测试需设 GALLINGS_TEST_DSH=<dsh-memory 检出>
```

## 素材库

《海风与布丁》的背景素材、预览和命名约定见 [素材库](content/assets/README.md)，当前收录 11 张背景，覆盖浅滩时段差分、书房、甜品店、营地、集市、院子与深海珊瑚礁。

音效素材：已收录 15 个环境音和 18 个剧情音效，索引见 [音效素材库](content/assets/audio/sfx/README.md)。

配乐探索素材：[翡翠之梦](content/assets/audio/bgm/README.md)。当前选曲、音乐理解与制作分工见 [音乐方向](docs/music-direction.md)。
