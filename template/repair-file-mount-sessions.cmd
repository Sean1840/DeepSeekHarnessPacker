@echo off
setlocal
chcp 65001 >nul 2>&1
set "DSH_DIR=%~dp0"

if not exist "%DSH_DIR%scripts\repair-file-mount-sessions.js" (
  echo [ERROR] scripts\repair-file-mount-sessions.js not found.
  pause
  exit /b 1
)

echo Close start.cmd before continuing.
echo.
if exist "%DSH_DIR%node\node.exe" (
  "%DSH_DIR%node\node.exe" "%DSH_DIR%scripts\repair-file-mount-sessions.js"
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Node.js not found. Use the portable package.
    pause
    exit /b 1
  )
  node "%DSH_DIR%scripts\repair-file-mount-sessions.js"
)

echo.
pause
endlocal
