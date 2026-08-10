param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,
  [switch]$Restart
)

$ErrorActionPreference = "Stop"

$appExe = Join-Path $RepoRoot "packages\desktop\dist\win-unpacked\OpenCode Beta.exe"
$buildStamp = Join-Path $RepoRoot "packages\desktop\out\main\index.js"
$appDir = Split-Path -Parent $appExe
$logDir = Join-Path $env:APPDATA "ai.opencode.desktop.beta\logs"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class OpenCodeWindow {
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
}
"@

function Test-BuildStale {
  if (-not (Test-Path -LiteralPath $appExe)) { return $true }
  if (-not (Test-Path -LiteralPath $buildStamp)) { return $true }

  $built = (Get-Item -LiteralPath $buildStamp).LastWriteTimeUtc
  $packaged = (Get-Item -LiteralPath $appExe).LastWriteTimeUtc
  if ($packaged -lt $built) { return $true }

  $roots = @(
    "packages\desktop\src",
    "packages\desktop\scripts",
    "packages\desktop\electron.vite.config.ts",
    "packages\desktop\electron-builder.config.ts",
    "packages\app\src",
    "packages\app\vite.js",
    "packages\opencode\src",
    "packages\ui\src",
    "packages\core\src",
    "packages\session-ui\src",
    "packages\protocol\src",
    "packages\schema\src"
  )

  foreach ($root in $roots) {
    $path = Join-Path $RepoRoot $root
    if (-not (Test-Path -LiteralPath $path)) { continue }

    $files =
      if ((Get-Item -LiteralPath $path).PSIsContainer) {
        Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue
      } else {
        @(Get-Item -LiteralPath $path)
      }

    foreach ($file in $files) {
      if ($file.LastWriteTimeUtc -gt $built) { return $true }
    }
  }

  return $false
}

function Get-CustomProcesses {
  Get-Process -Name "OpenCode Beta" -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and ($_.Path -like "*\packages\desktop\dist\win-unpacked\*") }
}

function Get-VisibleCustomProcess {
  Get-CustomProcesses |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |
    Sort-Object -Property StartTime -Descending |
    Select-Object -First 1
}

function Show-ExistingWindow {
  param($Process)

  $hwnd = $Process.MainWindowHandle
  if ($hwnd -eq 0) { return $false }

  if ([OpenCodeWindow]::IsIconic($hwnd)) {
    [void][OpenCodeWindow]::ShowWindow($hwnd, 9)
  }

  [void][OpenCodeWindow]::ShowWindow($hwnd, 5)
  [void][OpenCodeWindow]::SwitchToThisWindow($hwnd, $true)
  [void][OpenCodeWindow]::SetForegroundWindow($hwnd)
  return $true
}

function Stop-CustomProcesses {
  $custom = @(Get-CustomProcesses)
  if ($custom.Count -eq 0) { return }

  Write-Host ""
  Write-Host "Closing existing custom OpenCode processes..."
  Write-Host ""
  $custom | Stop-Process -Force
  Start-Sleep -Seconds 2
}

function Focus-RunningCustomOpenCode {
  $visible = Get-VisibleCustomProcess
  if (-not $visible) { return $false }

  Show-ExistingWindow $visible | Out-Null
  Write-Host ""
  Write-Host "Custom OpenCode is already running. Brought the window to the front."
  Write-Host ""
  return $true
}

if (Test-BuildStale) {
  exit 2
}

if (-not (Test-Path -LiteralPath $appExe)) {
  Write-Error "Desktop app not found: $appExe"
}

if ($Restart) {
  Stop-CustomProcesses
}
elseif (Focus-RunningCustomOpenCode) {
  exit 0
}
else {
  $custom = @(Get-CustomProcesses)
  if ($custom.Count -gt 0) {
    Write-Host ""
    Write-Host "Found stuck custom OpenCode background processes. Restarting..."
    Write-Host ""
    Stop-CustomProcesses
  }
}

Write-Host ""
Write-Host "Starting your custom OpenCode..."
Write-Host "First launch can take up to 45 seconds before the window appears."
Write-Host "This runs alongside the official OpenCode app."
Write-Host ""

$proc = Start-Process -FilePath $appExe -WorkingDirectory $appDir -PassThru

for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 1

  $visible = Get-VisibleCustomProcess
  if ($visible) {
    Show-ExistingWindow $visible | Out-Null
    exit 0
  }

  $live = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
  if (-not $live) {
    if (Focus-RunningCustomOpenCode) { exit 0 }
    throw "OpenCode exited before a window appeared. Check logs in $logDir"
  }
}

if (Focus-RunningCustomOpenCode) { exit 0 }

Write-Host ""
Write-Host "OpenCode is still starting in the background. Check the taskbar in a moment."
Write-Host "Logs: $logDir"
Write-Host ""
exit 0
