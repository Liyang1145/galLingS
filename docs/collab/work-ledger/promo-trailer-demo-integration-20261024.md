# 任务记录：多分支合流整合、原创 1080p60 宣传片与可提交 Demo 打包（2026-10-24）

- **日期**：2026-10-24
- **负责人**：TanPowasd
- **分支**：`fix/character-performance`（同步至 `tanpowasd/dev`）
- **基线提交**：`181a128`（`origin/fix/character-performance`）、`9b5fd1a`（`origin/tanpowasd/memory-provenance`）、`6d4a07f`（`origin/tanpowasd/linux`）、`be8a6e5`（`origin/main`）

## 1. 合并与整合内容

1. **配音与音乐演出主线（`origin/fix/character-performance` `181a128`）**：
   - 包含前两话 4 轮听审修录与选版（150 条主语音试听）、第三话起默认关闭配音开关、15 首正式曲名同步、第五至六话《弦间的流光（纯竖琴版）》接入、27 段无缝循环 CG 动画、水下静态淡蓝滤镜及首次默认 BGM 音量 25%。
2. **灵枢认知图记忆溯源与人设护栏（`origin/tanpowasd/memory-provenance` `9b5fd1a`）**：
   - 记忆来源标签（`provenance`）、修订作废（`superseded`）与引擎真值校验；
   - 确定性态度门控过滤、`say` 节点情绪差分（`expr`）、人设一致性与防洗记忆评测集（`eval/persona_eval.py`）。
3. **跨平台 Linux 支持（`origin/tanpowasd/linux` `6d4a07f`）**：
   - 新增根级 `start.sh`、Tauri Linux 打包支持（`deb`/`AppImage`）、Steam Linux depot 构建参数与 XDG 本地存档目录支持。
4. **台词底板可读性增强（`origin/main` `be8a6e5` / `2dfda33`）**：
   - 解决 `海风与布丁/index.html` 合并冲突，同时保留水下滤镜精简与 `#pdlg` 深海蓝托底 + 鲸鱼皮肤层不透明度下限 `clamp(.72, calc(var(--ghost) + .37), 1)`，确保亮海面背景下白字清晰可读。
5. **未合入分支说明**：
   - `origin/art/action26-20261023-01a168f1`（`fe603f6`）：按协作规则“图片改动先出候选给用户验收，确认后再推”及 [nnn-art-receive-20261023.md](nnn-art-receive-20261023.md)，26 张动作候选图暂存独立分支待审，不直接替换正式版立绘。
   - `origin/rebuild`（`43ab140`）：属于 `apps/` 与 `packages/` 下的 TypeScript 架构重写分支，为保证提交 Demo 的稳定性与 3315 节点零回归，不混入当前正式交付分支。

## 2. 影响文件

- `海风与布丁/index.html`（合并 `origin/main` 台词底板加深 CSS 与 `fix/character-performance` 全部演出改进）
- `docs/collab/work-ledger/README.md`
- `docs/collab/work-ledger/promo-trailer-demo-integration-20261024.md`
- 交付产物目录（本地构建输出，位于 `dist/`）：
  - `dist/steam/content/`（Steam / 桌面正式版完整 Demo 目录，含独立纯净客户端与全套资源）
  - `dist/demo/海风与布丁_试玩版_含前两话语音.html`（单文件即开即玩试玩 Demo，内嵌前两话 150 条配音）
  - `dist/promo/海风与布丁_官方宣传片_1080p60.mp4`（100% 原创自研运镜渲染 66 秒 1080p 60fps 宣传片）

## 3. 验证结果

- `python tools/check_full_regression.py 海风与布丁 $env:TEMP`：3315 节点、3308 原台词 ID 顺序完整，`nbad: 0, nerrs: 0`
- `.\.venv\Scripts\python.exe -m pytest -q`：全量后端、记忆溯源、多模型、GalAgent 与护栏测试通过
- `.\.venv\Scripts\python.exe tools/check_md_links.py`：全仓 Markdown 链接 0 断链

## 4. 还缺什么

- 第三话及之后的 TTS 干声仍按现行策略默认关闭（设置内可手动开启），待后续逐话听审通过后再默认开启。
