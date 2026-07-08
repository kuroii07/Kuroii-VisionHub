$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $projectRoot "src-tauri\target\release"
$friendlyExe = Join-Path $releaseDir "Kuroii VisionHub.exe"
$canonicalExe = Join-Path $releaseDir "visionhub-studio.exe"
$releaseExe = if (Test-Path -LiteralPath $friendlyExe) { $friendlyExe } else { $canonicalExe }
$reportDir = Join-Path $projectRoot "docs\run-reports"
$reportPath = Join-Path $reportDir "latest-start.md"

if (-not (Test-Path -LiteralPath $releaseExe)) {
  throw "Release exe not found: $releaseExe. Please run npm.cmd run tauri:build first."
}

New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
& "$PSScriptRoot\stop_app.ps1"

Start-Process -FilePath $releaseExe -WorkingDirectory (Split-Path $releaseExe -Parent)
Start-Sleep -Seconds 3

$app = Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -and $_.Path.Equals($releaseExe, [System.StringComparison]::OrdinalIgnoreCase)
} | Sort-Object StartTime -Descending | Select-Object -First 1

if (-not $app) {
  throw "Kuroii VisionHub process not found after launch."
}

Set-Content -Path $reportPath -Encoding UTF8 -Value @(
  "# Kuroii VisionHub start report",
  "",
  "- Time: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))",
  "- Release exe: $releaseExe",
  "- Active PID: $($app.Id)"
)

Write-Host "Kuroii VisionHub started. PID: $($app.Id)" -ForegroundColor Green
