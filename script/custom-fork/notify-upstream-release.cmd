@echo off
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0notify-upstream-release.ps1" %*
