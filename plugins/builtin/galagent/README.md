# gallings.tool.galagent

结局后聊天（post_ending）的 Agent 插件：角色一边保持人设陪聊，一边调用工具完成简单任务。

```
plugin.yaml        清单（kind: tool，capabilities: [galagent, post_ending]）
plugin.py          GalAgent：tool 接口 + open_post_ending() + 工具注册表（自带 + 声明 galagent 能力的插件）
loop.py            GalAgentSession：模型 ⇄ 工具循环、确认、前端工具、galagent/1 事件
stream_split.py    文本流 → 思考 / 台词 / 表情
tools_basic.py     powershell、read_file、write_file、list_dir、fetch_url、get_time
prompts.py         系统提示词、角色卡 → 人设
web/galagent-ui.js 前端库（两级折叠的工作流程 + 聊天窗口 + 离线模拟），VN Studio v0.16 内嵌同一份
web/chat.html      /galagent 独立聊天页
```

文档：[docs/galagent.md](../../../docs/galagent.md)（协议、配置、安全、扩展步骤）。
