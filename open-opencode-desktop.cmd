@echo off
setlocal EnableExtensions

rem Fast dev mode for custom OpenCode (hot reload while you edit).
rem Production UI: no channel badge, no debug bar. Runs alongside official OpenCode.
rem Keep this window open. Close it to stop the app.

set "REPO_ROOT=%~dp0"
cd /d "%REPO_ROOT%"

set "OPENCODE_CHANNEL=beta"
set "OPENCODE_UI_CHANNEL=prod"
set "VITE_DISABLE_DEBUG_BAR=1"
set "CHOKIDAR_USEPOLLING=1"

where bun >nul 2>&1
if errorlevel 1 (
  echo.
  echo Bun was not found in PATH.
  echo Install it from https://bun.sh and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo First-time setup: installing dependencies...
  echo.
  bun install --ignore-scripts
  if errorlevel 1 (
    echo.
    echo Dependency install failed.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting custom OpenCode in dev mode...
echo   UI changes reload in seconds. Server changes restart the app briefly.
echo   Set OPENCODE_DEV_REBUILD=1 to force a fresh server build on launch.
echo.
bun ./script/custom-fork/dev-desktop.ts
if errorlevel 1 (
  echo.
  echo Dev session ended with an error.
  echo.
  pause
  exit /b 1
)

exit /b 0
