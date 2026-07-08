$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $projectRoot "src-tauri\target\release"
$canonicalExe = Join-Path $releaseDir "visionhub-studio.exe"
$friendlyExe = Join-Path $releaseDir "Kuroii VisionHub.exe"

if (-not (Test-Path -LiteralPath $canonicalExe)) {
  throw "Canonical release exe not found: $canonicalExe"
}

Copy-Item -LiteralPath $canonicalExe -Destination $friendlyExe -Force

$item = Get-Item -LiteralPath $friendlyExe
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $friendlyExe).Hash

Write-Host "Copied user-facing release exe:" -ForegroundColor Green
Write-Host "  $friendlyExe"
Write-Host "  $($item.Length) bytes"
Write-Host "  SHA256 $hash"
