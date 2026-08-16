@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js first.
  echo         https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Building DeepSeek Harness portable package...
echo.
node scripts\build.js
echo.
if errorlevel 1 (
  echo [FAILED] Build failed, see log above.
) else (
  echo [DONE] Output: dist\*.zip
)
echo.
pause
endlocal
