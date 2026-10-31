@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
if not exist "%LOCALAPPDATA%\WhaleGirlLive2D\electron\electron.exe" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$src = '%~dp0..\galagentV1.0\node_modules\electron\dist'; $dst = Join-Path $env:LOCALAPPDATA 'WhaleGirlLive2D\electron'; New-Item -ItemType Directory -Path $dst -Force | Out-Null; Get-ChildItem -LiteralPath $src -Force | Copy-Item -Destination $dst -Recurse -Force"
)
start "" /D "%LOCALAPPDATA%\WhaleGirlLive2D\electron" "%LOCALAPPDATA%\WhaleGirlLive2D\electron\electron.exe" "%~dp0output\whale-girl-live2d-base\live2d-viewer\main.cjs"
