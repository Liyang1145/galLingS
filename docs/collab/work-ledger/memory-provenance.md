# 记忆来源标签、态度过滤与人设评测（整合方案 P0）

- 负责人 / 执行 agent：TanPowasd / Hark（用户 10-23 同意开始：“可以试试”）
- 状态：待集成（只在任务分支上，未合 tanpowasd/dev / main，未开 PR）
- 更新时间：2026-10-23
- 任务分支：`tanpowasd/memory-provenance`
- 基线提交：`51b0c75`（tanpowasd/dev 头）
- 交付提交：`022c74c` 插件层 W2 → `f6e228a` W1/W2/W3 → `4e7a346` R1/E1 → `6f029bb` 评测 G1/V1 → 本文档提交

## 本次目标与影响范围

按《借鉴到galLingS_整合方案》第 3、4 节落 P0 项：

| 项 | 做到什么程度 | 文件 |
|---|---|---|
| W1 来源标签 | 完成。`meta.source ∈ script / engine / player_claim / heroine_line / model_note`（命名按方案），另有 `evidence_key`、`turn_event`；`kind=fact` 只有剧本 / 引擎来源能写，其余降成 `note`；`write_memory` 改成 `note / model_note`；`propose_*` 被引擎 applied / clamped 后、`turn_commit` 之后由会话代写 `source=engine` 的事实（只写裁决数值，不写模型理由；回合作废则不写）；召回按 `evidence_key` 去重，提示词按来源分三组 | `server/memory/provenance.py`、`server/memory/gateway.py`、`server/session.py`、`server/director/prompts.py`、`server/soul.py` |
| W2 修订 = 作废 + 追加 | 完成网关 + 两个插件。`MemoryGateway.revise()`：必须带本轮召回的 `read_token`（先读后写），新条来源权级 ≥ 旧条（玩家说法不能作废任何条目，模型笔记不能作废引擎事实）；旧条只打 `superseded`，原文不删；会话 `revise_memory()` 成功记 `memory_write(supersedes)`，被拒记 `text_verdict(stage=memory)`。`MemoryPlugin.mark()`；memory-local 用 jsonl 状态行；memory-lingshu 内置 md_cg 新增 `mdcg_mark`（search 默认只回 active，`include_inactive` 看修订链），外部 dsh-memory 没有该工具时退到插件本地状态文件 | `server/plugins/kinds.py`、`plugins/builtin/memory-local`、`plugins/builtin/memory-lingshu` |
| W3 只认引擎状态 | 完成。状态块声明“第 N 回合的当前真值”（好感 / 心情 / 称呼阶段 / 伤口 / 变量），记忆里带数量 / 归属 / 称呼的条目写入时打 `as_of_turn`，召回显示“（第 N 回合时）”；她的承诺只记 `heroine_line` | `server/director/prompts.py`、`server/memory/gateway.py` |
| R1 确定性态度过滤 | 完成。`server/memory/stance.py`：读 `wound / address_stage / mood / grudges`（grudges 引擎里还没有，缺省空表，等 S1），给条目加注记或 `show=false`；召回列表不变，注记进 `memory_recall` 事件；卡可选 `stance_rules`，schema + validate 校验 | `server/memory/stance.py`、`schemas/card.schema.json`、`server/cards/validate.py` |
| E1 say.emotion → 差分 | 完成。`say` 增 `emotion`，枚举由卡 `assets.emotions`（或立绘清单）动态生成；会话映射成 `set_sprite`；非法标签 `emotion.invalid` 并回退默认差分；严肃模板驳回喜剧差分；与 mood 方向冲突的打 `emotion_mood_conflict`；尾鳍不受影响。galcore 桥把 AI 回合的 SPRITE 交给作品立绘，作品没有这张差分时回落默认立绘 | `schemas/tools.json`、`server/session.py`、`web/galcore.vnplugin.js` |
| G1 + V1 评测 | 完成（scripted）。`persona.yaml` 10 句、`washing.yaml` 4 组、助手腔规则组、台词绑定四类审计（含草药题型单元测试）、“W1 off”对照组 | `tests/evals/` |

## 兼容变化与交叉点

- 事件日志：`memory_recall` 条目多 `provenance / kind / evidence_key / as_of_turn / stance / show`，payload 多 `read_token / deduped / stance`；`memory_write` 可带 `supersedes / revise / memory_source`；`model_tool_call` 可带 `memory_source / emotion / emotion_mood_conflict / via`；`text_verdict.stage` 增 `memory`。`schemas/event.schema.json` 已同步；引擎（Rust）不改，这些事件种类本来就只记录，回放 state_hash 不变。
- 提示词版本 `ch01-0.2.0 → ch01-0.3.0`（代码约定“改模板必须升 PROMPT_VERSION”，这是模板标识，不是产品版本号）。
- 纯选项 / 离线 wasm 路径：没改 Rust、没改 `web/offline/`；纯选项只多了记忆写入的 meta（写入 `source=engine`），行为不变。WASM 对拍测试在本机因缺 `galcore.wasm` 跳过（与基线相同）。
- 旧记忆：没有来源标签的 `kind=fact` 不再推断成事实（旧版 `write_memory` 写过 fact），归“来源不明，不当作事实”。
- 与 GalAgent / 灵枢 MCP 记忆库（10-21 整合）交叉：外部 dsh-memory 不认识 `mdcg_mark` 时只靠插件本地状态文件过滤，dsh-memory 自己的召回不会知道条目已作废。

## 依赖与尚未对齐的内容

- 模型侧修订工具（让模型调 `revise_memory`）与 `impression` 一人一条画像：方案里标 P1，这次只有网关 / 会话接口，未暴露给模型。
- `grudges`：等 S1 恩怨账本进 Rust 状态机后 stance 自动读到。
- 草药题型：第一话引擎状态里没有物件数量，只做在 `binding.py` 单元测试里。
- 真模型（config）评测未跑：需要先征得同意（会花钱）。

## 实际验证与交付

- `pytest`：基线 183 passed / 4 skipped → 本分支 202 passed / 4 skipped（新增 19：`tests/demo/test_memory_provenance.py` 14、`tests/plugins/test_lingshu.py` +1、`tests/evals/test_evals_persona_washing.py` 4）。
- scripted 全集报表：`tests/evals/reports/scripted-before-memory-provenance.*`（51b0c75）↔ `scripted-memory-provenance.*`；原四套判据数字一致，新增人设 / 洗记忆判据全过；召回 p95 6.40 → 6.39 ms（含态度过滤）。
- 只推任务分支，未合并、未开 PR。

## 下一位 agent 的接续点

- 想让模型自己修订笔记：在 `schemas/tools.json` 加 `revise_memory`（只许改 `model_note`），提示词里给条目编号，`read_token` 用本轮 `memory_recall` 的。
- 调试时间轴（`web/timeline.js`）还没专门渲染 stance 注记 / 修订链 / 情绪冲突，目前只在原始事件里可见。
- 换真模型跑 `--set persona,washing --model config` 前先问用户。
