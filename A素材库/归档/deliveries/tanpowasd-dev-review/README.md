# tanpowasd/dev 合并审核

源分支 `01bc3eea4a1256509716768906b4bae0f25e049c` 的7个提交与主分支 `22d231f` 比较，PR #6 保留完整历史，另补路径兼容、音乐来源修复和时间轴增量渲染。

`content-compatibility.json` 核对3308句/18章及音乐音效、全部运行媒体与作者原件。`browser-validation.json` 记录真实Edge托管、存读档、回放、离线素材开发和单文件测试。`timeline-before/after.json` 为同400条合成事件的本机渲染开销，不能当作通用设备性能保证。

本地独立单文件位于 Codex 工作输出 `outputs/tanpowasd-dev-review/海风与布丁_单文件游玩.html`，可用 `tools/build_single_file_game.py` 从本仓库重建。不重复提交嵌入全部媒体的大HTML。测试配置、模型凭据、玩家存档和本地环境不入库。
