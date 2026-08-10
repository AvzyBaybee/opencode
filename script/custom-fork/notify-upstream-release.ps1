# Checks anomalyco/opencode for a new official release.
# Shows a persistent corner bubble until you dismiss it or open the release page.
# State is saved only after you act, so the bubble reappears until handled.

param(
    [string] $BubbleTag,
    [string] $BubbleName,
    [string] $BubbleUrl,
    [switch] $Preview
)

$ErrorActionPreference = "Stop"

$stateDir = Join-Path $env:LOCALAPPDATA "CustomOpenCode"
$stateFile = Join-Path $stateDir "last-upstream-release.txt"
$repo = "anomalyco/opencode"
$scriptPath = $MyInvocation.MyCommand.Path

function Show-PersistentBubble {
    param(
        [string] $Tag,
        [string] $Name,
        [string] $Url
    )

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "OpenCode update"
    $form.Size = New-Object System.Drawing.Size(340, 132)
    $form.FormBorderStyle = "FixedToolWindow"
    $form.StartPosition = "Manual"
    $form.TopMost = $true
    $form.ShowInTaskbar = $true
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(32, 32, 36)

    $workArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $margin = 16
    $form.Location = New-Object System.Drawing.Point(
        ($workArea.Right - $form.Width - $margin),
        ($workArea.Bottom - $form.Height - $margin)
    )

    $title = New-Object System.Windows.Forms.Label
    $title.Text = "New OpenCode release"
    $title.ForeColor = [System.Drawing.Color]::White
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $title.AutoSize = $true
    $title.Location = New-Object System.Drawing.Point(14, 12)
    $form.Controls.Add($title)

    $body = New-Object System.Windows.Forms.Label
    $body.Text = "$Name is available.`nOpen the release page or dismiss when ready."
    $body.ForeColor = [System.Drawing.Color]::FromArgb(210, 210, 210)
    $body.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $body.AutoSize = $false
    $body.Size = New-Object System.Drawing.Size(312, 44)
    $body.Location = New-Object System.Drawing.Point(14, 36)
    $form.Controls.Add($body)

    $dismiss = New-Object System.Windows.Forms.Button
    $dismiss.Text = "Dismiss"
    $dismiss.Size = New-Object System.Drawing.Size(96, 28)
    $dismiss.Location = New-Object System.Drawing.Point(14, 88)
    $dismiss.Add_Click({
        if (-not $Preview) {
            Set-Content -Path $stateFile -Value $Tag -NoNewline -Encoding utf8
        }
        $form.Close()
    })
    $form.Controls.Add($dismiss)

    $open = New-Object System.Windows.Forms.Button
    $open.Text = "Open release"
    $open.Size = New-Object System.Drawing.Size(110, 28)
    $open.Location = New-Object System.Drawing.Point(118, 88)
    $open.Add_Click({
        if ($Url) {
            Start-Process $Url
        }
        if (-not $Preview) {
            Set-Content -Path $stateFile -Value $Tag -NoNewline -Encoding utf8
        }
        $form.Close()
    })
    $form.Controls.Add($open)

    $later = New-Object System.Windows.Forms.Button
    $later.Text = "Later"
    $later.Size = New-Object System.Drawing.Size(96, 28)
    $later.Location = New-Object System.Drawing.Point(218, 88)
    $later.Add_Click({
        $form.Close()
    })
    $form.Controls.Add($later)

    [void] $form.ShowDialog()
}

function Start-BubbleProcess {
    param(
        [string] $Tag,
        [string] $Name,
        [string] $Url
    )

    $args = @(
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$scriptPath`"",
        "-BubbleTag", $Tag,
        "-BubbleName", $Name,
        "-BubbleUrl", $Url
    )

    Start-Process -FilePath "powershell.exe" -ArgumentList $args -WindowStyle Normal
}

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

if ($BubbleTag) {
    Show-PersistentBubble -Tag $BubbleTag -Name $BubbleName -Url $BubbleUrl
    exit 0
}

if ($Preview) {
    Show-PersistentBubble -Tag "v1.18.99" -Name "v1.18.99 (preview)" -Url "https://github.com/anomalyco/opencode/releases"
    exit 0
}

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

Start-BubbleProcess -Tag $tag -Name $name -Url $url

Write-Host "New release detected: $tag"
Write-Host "Corner bubble opened. It stays until you dismiss or open the release."
Write-Host $url
