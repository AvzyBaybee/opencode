@echo off
setlocal EnableExtensions

rem Launch your custom OpenCode fork alongside the official app.
rem Uses the beta app identity (separate from official) with production UI (no channel badge).
rem Rebuilds automatically when source changes are detected.
rem Usage:
rem   open-opencode-desktop.cmd            Launch (auto-rebuild if stale)
rem   open-opencode-desktop.cmd --rebuild  Force a fresh production build

set "REPO_ROOT=%~dp0"
cd /d "%REPO_ROOT%"

set "OPENCODE_CHANNEL=beta"
set "OPENCODE_UI_CHANNEL=prod"
set "APP_EXE=packages\desktop\dist\win-unpacked\OpenCode Beta.exe"
set "HELPER=%REPO_ROOT%script\custom-fork\open-opencode-desktop.ps1"
set "FORCE_REBUILD=0"

if /I "%~1"=="--rebuild" set "FORCE_REBUILD=1"
if /I "%~1"=="/rebuild" set "FORCE_REBUILD=1"

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

if "%FORCE_REBUILD%"=="1" goto build

powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER%" -RepoRoot "%CD%"
if errorlevel 2 goto build
if errorlevel 1 (
  echo.
  echo Failed to launch custom OpenCode.
  echo Logs: %APPDATA%\ai.opencode.desktop.beta\logs
  echo.
  pause
  exit /b 1
)
goto done

:build
echo.
echo Building your custom OpenCode desktop.
echo This can take a few minutes.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $p = Get-Process -Name 'OpenCode Beta' -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*\packages\desktop\dist\win-unpacked\*' }; if ($p) { Write-Host 'Closing running custom OpenCode so the build can update files...'; $p | Stop-Process -Force; Start-Sleep -Seconds 2 } }"
set "OPENCODE_CHANNEL=beta"
set "OPENCODE_UI_CHANNEL=prod"
call bun run --cwd packages/desktop build
if errorlevel 1 (
  echo.
  echo Build failed.
  echo.
  pause
  exit /b 1
)
call bun run --cwd packages/desktop package:win -- --dir
if errorlevel 1 (
  echo.
  echo Packaging failed. Close any custom OpenCode Beta windows and try again.
  echo.
  pause
  exit /b 1
)

if not exist "%APP_EXE%" (
  echo.
  echo Could not find the desktop app:
  echo   %APP_EXE%
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER%" -RepoRoot "%CD%" -Restart
if errorlevel 1 (
  echo.
  echo Failed to launch custom OpenCode.
  echo Logs: %APPDATA%\ai.opencode.desktop.beta\logs
  echo.
  pause
  exit /b 1
)

:done
exit /b 0
