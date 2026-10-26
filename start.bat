@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion
title 海风与布丁
cd /d "%~dp0" || goto :wrongdir
if not exist "package.json" goto :wrongdir
if not exist "content\story\project.json" goto :wrongdir
if not exist "tools\dev\vite.config.ts" goto :wrongdir
where node >nul 2>nul
if errorlevel 1 goto :nonode
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major === 24 && minor >= 15 ? 0 : 1)"
if errorlevel 1 goto :badnode
where npm.cmd >nul 2>nul
if errorlevel 1 goto :nonpm
if not exist "node_modules\.bin\vite.cmd" goto :nodeps
if not exist "node_modules\vite\bin\vite.js" goto :nodeps

echo 正在启动《海风与布丁》...
echo 游戏就绪后会自动打开浏览器；本窗口请保持开启。
echo 结束游玩时，在本窗口按 Ctrl+C，或关闭本窗口。
echo.
call npm.cmd run game:dev -- --open
if errorlevel 1 goto :startfailed
exit /b 0

:wrongdir
echo 请在完整仓库根目录使用本脚本，保留 package.json、content 和 tools。
goto :fail
:nonode
echo 没找到 Node.js，请先安装 Node.js 24.15.0 或更新的 24.x 版本。
goto :fail
:badnode
echo 当前 Node.js 版本不符合要求，请使用 24.15.0 或更新的 24.x 版本。
goto :fail
:nonpm
echo 没找到 npm.cmd，请修复 Node.js 的 npm 安装和 PATH 配置。
goto :fail
:nodeps
echo 缺少游戏开发依赖，请先在仓库目录执行以下命令，再双击本脚本：
echo   npm ci --ignore-scripts
goto :fail
:startfailed
echo 游戏启动失败，请查看上方错误。
echo 如果提示 5173 端口已被占用，请关闭之前的游戏启动窗口后重试。
:fail
pause
exit /b 1
