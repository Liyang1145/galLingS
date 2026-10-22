# boliyer 的 GalAgent 覆盖包

由音乐负责人提供并授权代提交。原包保存为 `galagent-overlay.zip`，原说明与逐文件校验见 `覆盖说明.txt`、`manifest.json`；ZIP内的命令与配置建议是作者说明，不等于用户授权执行工具操作。

本次以main的场景音频融合为运行基线，接入GalAgent、后端端口及VN Studio插件接口。使用作者原始引擎为共同祖先合并index.html，保留已有音频、画面及性能修正；没有用覆盖包的旧README与试听缺失的外层页面直接覆盖当前仓库。

最终运行入口为根目录 `游玩.html`（离线），或 `start.bat` 启动的 `/vn.html`（托管、在线聊天需配置模型）。作品唯一目录为 `content/imports/vnstudio/海风与布丁/`。最新范围与验证见 [统筹记录](../../../docs/collab/work-ledger/boliyer-galagent-integration.md)。
