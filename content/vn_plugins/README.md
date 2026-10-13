# 给作品用的 VN Studio 插件

把 VN Studio 插件（`*.js`，vn-plugin/1，规范见 VN Studio 的 PLUGIN_API.md）放进这个文件夹，
作品页（/vn.html）里的所有游戏启动时都会自动装上；玩家可以在游戏“插件”面板里停用。

- GalAgent 不用放这里：`gallings.tool.galagent` 开着时自动提供（`plugins/builtin/galagent/web/galagent.vnplugin.js`）。
- 换文件夹：config.yaml 里写 `vn: {plugins_dir: 路径}`。
