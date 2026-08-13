@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Git Graph

echo Stopping any git-graph already on ports 5199 and 5200...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = 5199,5200; foreach ($port in $ports) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }; $here = (Get-Location).Path; Get-CimInstance Win32_Process -Filter \"Name = 'bun.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($here) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo Starting git-graph at http://127.0.0.1:5199
bun dev
endlocal
