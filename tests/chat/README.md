# 显式验证 Agent 基础

仅验证独立聊天基础，不接真实模型、玩家数据库或私人配置。不在游戏、启动脚本或 CI 中自动执行。

## 运行离线用例

使用根锁定的 Node 24 依赖，以及已有辅助服务 Python 环境；不需要 pytest。

```powershell
npm run typecheck
npm run chat:test
.\.venv\Scripts\python.exe -m unittest discover -s tests/chat -p test_service.py -v
```

- Node 用例：合成内容先经实际内容读取器校验，使用只读内存通关源；测试会话及真实本机 HTTP，覆盖确认、取消、超时、异常流、隔离和容量。
- Python 用例：标准库 unittest、ASGI HTTP 和现有脚本化模型，数据目录使用系统临时目录；验证端点、配置与模型流边界，不联网调用模型。
- 本目录的事实、人设、台词和服务令牌都是隔离测试数据，不是正式解锁规则或模型配置。测试令牌随机生成，不写入文件。

## 运行浏览器纵向验证

需已安装的 Playwright 与 Chromium。根项目没有添加 Playwright 依赖：可在环境中指定 `HAIFENG_PLAYWRIGHT_PACKAGE` 为已有安装环境中的 `package.json` 路径，用它解析 Playwright；若项目环境本来可解析则不必设置。可用 `HAIFENG_TEST_PYTHON` 指定已有服务 Python，默认本仓库 `.venv/Scripts/python.exe`；可用 `HAIFENG_BROWSER_EXECUTABLE` 指定已有 Chromium。

```powershell
npm run chat:test:browser
```

脚本会：

1. 启动两个本机随机端口：隔离测试页面及仅使用脚本模型的临时 Python 服务。
2. 以临时浏览器存储验证实际面板/HTTP/CORS/流、停止与切换、断网、确认失效和错误隔离。
3. 在另一份全新浏览器存储打开**实际游戏开发页**，阻断外网/聊天服务，确认能开局并真正切换剧情节点。这里只做主线冒烟，不跑完整路线。
4. 关闭临时服务和浏览器，输出忽略的 `dist/verification/agent/` 截图与 `browser-results.json`。测试辅助页/状态/关闭接口仅在本目录装配，不挂载到实际游戏或聊天服务。

本机占用旧端口不会被接管，不读取旧 `config.yaml`、玩家档案或作者私人人设；不会构建 EXE/APK。执行结果与已知边界见 [本次验证记录](../../docs/rebuild/agent-verification.md)。
