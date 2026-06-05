$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseExe = Join-Path $projectRoot "src-tauri\target\release\visionhub-studio.exe"
$reportDir = Join-Path $projectRoot "docs\run-reports"
$reportPath = Join-Path $reportDir "latest-start.md"

if (-not (Test-Path $releaseExe)) {
  throw "Release exe not found: $releaseExe. Please run npm.cmd run tauri:build first."
}

New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
& "$PSScriptRoot\stop_app.ps1"

Start-Process -FilePath $releaseExe -WorkingDirectory (Split-Path $releaseExe -Parent)
Start-Sleep -Seconds 3

$app = Get-Process -Name "visionhub-studio" -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending | Select-Object -First 1

if (-not $app) {
  throw "VisionHub Studio process not found after launch."
}

Set-Content -Path $reportPath -Encoding UTF8 -Value @(
  "# VisionHub Studio start report",
  "",
  "- Time: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
  "- Release exe: $releaseExe",
  "- Active PID: $($app.Id)"
)

Write-Host "VisionHub Studio started. PID: $($app.Id)" -ForegroundColor Green
