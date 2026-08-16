@echo off
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
  "%DSH_DIR%node\node.exe" "%DSH_DIR%scripts\update.js" %*
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Node.js not found. Please use the portable package, or install Node.js first.
    pause
    exit /b 1
  )
  node "%DSH_DIR%scripts\update.js" %*
)

echo.
pause
endlocal
