@echo off
chcp 65001 >nul
rem 仅启动旧制作/独立聊天辅助服务，不启动正式游戏，不安装 Rust 或 galcore。
setlocal
cd /d "%~dp0"
if not exist "requirements.txt" goto :wrongdir
if not exist "server\__main__.py" goto :wrongdir
where py >nul 2>nul && (set "PY=py -3") || (set "PY=python")
set "VPY=%~dp0.venv\Scripts\python.exe"
if not exist "%VPY%" (
  echo [1/3] 创建辅助服务的 Python 虚拟环境 ...
  %PY% -m venv .venv || goto :nopython
)
"%VPY%" -c "import sys; sys.exit(sys.version_info < (3, 11))" || goto :oldpython
echo [2/3] 安装辅助服务依赖 ...
"%VPY%" -m pip install -q --disable-pip-version-check -r requirements.txt || goto :fail
echo [3/3] 启动旧制作/独立聊天服务，配置界面仅供制作与聊天使用。
echo 正式游戏请使用新 TypeScript 本体或已经生成的 Windows 应用；这里不安装或运行旧剧情核心。
"%VPY%" -m server
goto :eof
:wrongdir
echo 请在完整仓库根目录使用本脚本，旁边须有 requirements.txt 和 server。
pause & exit /b 1
:nopython
echo 没找到 Python 3.11 或更新版本，请先安装 Python。
pause & exit /b 1
:oldpython
echo 当前 .venv 的 Python 低于 3.11，请先自行处理本机环境。
pause & exit /b 1
:fail
echo 辅助服务依赖安装失败，请查看上面的错误；不会回退安装旧剧情核心。
pause & exit /b 1
