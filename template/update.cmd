@echo off
rem 给老包打补丁时，请同时覆盖本文件以及 scripts\update.js、scripts\common.js，
rem 再把新的 DeepSeekHarness-v*.zip 拖到本脚本上。只换其中一个文件无法升级。
setlocal
chcp 65001 >nul 2>&1
set "DSH_DIR=%~dp0"

if not exist "%DSH_DIR%scripts\update.js" (
  echo [ERROR] scripts\update.js not found. This is the source template, not a built package.
  echo         Run build.cmd first, or use dist\DeepSeekHarness\update.cmd / the extracted zip.
  pause
  exit /b 1
)

if exist "%DSH_DIR%node\node.exe" (
  if "%~1"=="" (
    "%DSH_DIR%node\node.exe" "%DSH_DIR%scripts\update.js"
  ) else (
    "%DSH_DIR%node\node.exe" "%DSH_DIR%scripts\update.js" "%~1"
  )
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Node.js not found. Please use the portable package, or install Node.js first.
    pause
    exit /b 1
  )
  if "%~1"=="" (
    node "%DSH_DIR%scripts\update.js"
  ) else (
    node "%DSH_DIR%scripts\update.js" "%~1"
  )
)

echo.
pause
endlocal
