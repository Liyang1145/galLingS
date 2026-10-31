# 2026-10-12 当前制作已恢复

用户已重新授权继续完整 Live2D 制作，最新原生源与下一步见 HANDOFF-LIVE2D.md。以下“暂停/上传快照”段落为此前阶段记录，不代表当前目标暂停。

---

# 2026-10-12 当前入口：完整工作区交接快照

Live2D 制作已按用户要求暂停，当前 v6 仍是制作中检查点。最新交接读 [UPLOAD-HANDOFF.md](UPLOAD-HANDOFF.md) 和 [HANDOFF-LIVE2D.md](HANDOFF-LIVE2D.md)。此前团队 galLingS 架构选择继续有效；保留的 RenPy 游戏、SDK、发行包和旧企划属于历史备份。此次用户明确授权立即上传全部非隐私工作区，覆盖旧的“不上传/待验收后上传”限制。

---

# 当前状态：切换至团队 galLingS，旧方案作废

2026-10-10 用户明确指示：下载研究团队重做地基，完全抛弃此前已有 Galgame 设计，重新开始。

当前目录：`galLingS/`。远端：`https://github.com/TanPowasd/galLingS`。
首次检出 main：`b1db75bebefad345d8ec4faadd3439464f06b305`。
以团队 README、docs/PLAN.md、docs/decisions.md、docs/plugin-format.md 和实际代码为准。
旧 Ren'Py 架构、编译器、UI、素材、立绘提示词均不自动沿用。旧文件保留为历史，不代表新项目承诺。
当前任务为下载和研究，不给团队代码添加功能、不推送或分派任务。下一实现入口按团队 M0a 接口冻结与迷你章节推进；先确认已有团队工作分支，避免重复建设。

本机验证（2026-10-10）：README 的 `pip install -e ".[dev]"` 失败，setuptools 检出 server/plugins/schemas 多个顶层包。独立 .venv 安装声明的依赖后，从源码运行测试：默认编码 31 passed / 3 failed / 1 skipped；设置进程环境 PYTHONUTF8=1 后 33 passed / 1 failed / 1 skipped，剩余失败为 test_mcp_restart_once；灵枢真实集成因未设置 GALLINGS_TEST_DSH 跳过。插件 list 成功发现全部 5 个内置插件。未调用付费模型或真实记忆服务，未改团队仓库跟踪文件。

以下为已废止的历史状态：

## 历史：0.1.1 原版已恢复

用户要求撤回 Gemini 精修；原文、界面与演出已回退到 0.1.1 场景版。五张背景保留，立绘继续留空。

静态检查、菜单/存读档测试（9 断言）和场景流程测试（6 断言）通过。重建章节与精修前发行包内容核对一致。

后续按用户反馈推进。不要自动重新应用 0.1.2 精修、震屏、停顿或徽章，不扩展第二话，不自动发布。
