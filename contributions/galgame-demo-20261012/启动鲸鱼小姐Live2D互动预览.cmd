@echo off
cd /d "%~dp0output\whale-girl-live2d-base\live2d-viewer"
set ELECTRON_RUN_AS_NODE=
start "" "%~dp0..\galagent\node_modules\electron\dist\electron.exe" "%~dp0output\whale-girl-live2d-base\live2d-viewer\main.cjs"
