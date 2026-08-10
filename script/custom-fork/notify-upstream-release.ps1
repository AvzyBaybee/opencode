# Checks anomalyco/opencode for a new official release and shows a Windows notification.
# State is stored locally (not in Git) so you only get notified once per release.

$ErrorActionPreference = "Stop"

$stateDir = Join-Path $env:LOCALAPPDATA "CustomOpenCode"
$stateFile = Join-Path $stateDir "last-upstream-release.txt"
$repo = "anomalyco/opencode"

function Show-Notification {
    param(
        [string] $Title,
        [string] $Message,
        [string] $Url
    )

    if (Get-Command New-BurntToastNotification -ErrorAction SilentlyContinue) {
        if ($Url) {
            New-BurntToastNotification -Text $Title, $Message -AppId "Custom OpenCode" | Out-Null
        } else {
            New-BurntToastNotification -Text $Title, $Message -AppId "Custom OpenCode" | Out-Null
        }
        return
    }

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Information
    $icon.Visible = $true
    $icon.ShowBalloonTip(15000, $Title, $Message, [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Seconds 2
    $icon.Visible = $false
    $icon.Dispose()
}

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"           = "CustomOpenCode-ReleaseChecker"
}

$tag = $release.tag_name
$url = $release.html_url
$name = if ($release.name) { $release.name } else { $tag }

$last = ""
if (Test-Path $stateFile) {
    $last = (Get-Content $stateFile -Raw).Trim()
}

if ($last -eq $tag) {
    if ($env:CUSTOM_OPENCODE_NOTIFY_VERBOSE -eq "1") {
        Write-Host "No new release. Current: $tag"
    }
    exit 0
}

Show-Notification -Title "OpenCode release available" -Message "$name - open GitHub or ask AI to help update." -Url $url

Set-Content -Path $stateFile -Value $tag -NoNewline -Encoding utf8

Write-Host "New release detected: $tag"
Write-Host $url
