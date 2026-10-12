@echo off
rem galLingS 一键启动（Windows）。第一次运行会建 .venv、装依赖、装确定性核心 galcore。
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem 必须放在 galLingS 仓库根目录（和 requirements.txt、server\ 在一起）运行
if not exist "requirements.txt" goto :wrongdir
if not exist "server\__main__.py" goto :wrongdir

where py >nul 2>nul && (set "PY=py -3") || (set "PY=python")
set "VPY=%~dp0.venv\Scripts\python.exe"

if not exist "%VPY%" (
  echo [1/4] 创建虚拟环境 .venv ...
  %PY% -m venv .venv || goto :nopython
)
rem galcore 轮子是 cp311-abi3：Python 低于 3.11 装不上，提前说清楚（旧 .venv 也会被查出来）
"%VPY%" -c "import sys; sys.exit(sys.version_info < (3, 11))" || goto :oldpython

echo [2/4] 安装 Python 依赖 ...
"%VPY%" -m pip install -q --disable-pip-version-check -r requirements.txt || goto :fail

"%VPY%" -c "import galcore" 2>nul
if errorlevel 1 (
  echo [3/4] 安装确定性核心 galcore（Rust）...
  if exist "wheels\galcore-*.whl" (
    "%VPY%" -m pip install -q --no-index --find-links wheels galcore || goto :fail
  ) else (
    where cargo >nul 2>nul || goto :nowheel
    "%VPY%" -m pip install -q maturin || goto :fail
    pushd core
    "%VPY%" -m maturin build --release --out ..\wheels || (popd & goto :fail)
    popd
    "%VPY%" -m pip install -q --no-index --find-links wheels galcore || goto :fail
  )
) else (
  echo [3/4] galcore 已安装
)

if not exist "content\scripts\ch01\ch01.md" (
  echo 提示：没有剧本内容包 content\scripts\ch01，AI 剧本 Demo 不能玩；顶栏「作品」里的《海风与布丁》照常可玩。
)

rem 已经在作品页 ⚙ 设置里保存过密钥，就不用每次再问
findstr /c:"GALLINGS_LLM_API_KEY" "%USERPROFILE%\.gallings\secrets.json" >nul 2>nul && goto :start
if "%GALLINGS_LLM_API_KEY%"=="" (
  echo.
  echo 没有设置 GALLINGS_LLM_API_KEY：不填则后端 AI 功能不可用。key 只在这次运行里有效，不会写进任何文件。
  echo 也可以以后在 作品页 右上角 ⚙ 设置 里填，填一次就记住（只存在本机）。
  set /p "GALLINGS_LLM_API_KEY=输入 DeepSeek API key（直接回车跳过）："
)

:start

echo [4/4] 启动后端：content\vn 里有作品时浏览器打开作品页 http://127.0.0.1:8765/vn.html ，否则打开 API 文档 /docs
"%VPY%" -m server
goto :eof

:wrongdir
echo 这个 start.bat 不在 galLingS 文件夹里（旁边找不到 requirements.txt 和 server 文件夹）。
echo 请打开 galLingS 完整版文件夹，双击里面的 start.bat；如果用的是“覆盖文件”，要先把它们复制进你的 galLingS 仓库根目录。
pause & exit /b 1
:nopython
echo 没找到 Python 3.11+。请先安装：https://www.python.org/downloads/windows/ （勾选 Add to PATH）
pause & exit /b 1
:nowheel
echo 没有 galcore 轮子，也没有 Rust 编译器。二选一：
echo   1. 从 GitHub Actions 下载 galcore-windows-latest 里的 .whl，放进本目录的 wheels\ 文件夹，再运行本脚本；
echo   2. 安装 Rust（https://rustup.rs），再运行本脚本自动编译。
pause & exit /b 1
:oldpython
echo .venv 里的 Python 低于 3.11。请安装 Python 3.11 或更新版本（https://www.python.org/downloads/windows/ ，勾选 Add to PATH），
echo 然后删掉本文件夹里的 .venv 文件夹，再双击 start.bat。
pause & exit /b 1
:fail
echo 安装失败，看上面的报错。
pause & exit /b 1
