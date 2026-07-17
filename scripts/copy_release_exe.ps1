$ErrorActionPreference = "Stop"

. "$PSScriptRoot\release_artifact_helpers.ps1"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $projectRoot "src-tauri\target\release"
$canonicalExe = Join-Path $releaseDir "visionhub-studio.exe"
$friendlyExe = Join-Path $releaseDir "Kuroii VisionHub.exe"

if (-not (Test-Path -LiteralPath $canonicalExe)) {
  throw "Canonical release exe not found: $canonicalExe"
}

Copy-Item -LiteralPath $canonicalExe -Destination $friendlyExe -Force

$item = Get-Item -LiteralPath $friendlyExe
$hash = Get-Sha256 -Path $friendlyExe
$sizeMb = [Math]::Round($item.Length / 1MB, 2)

Write-Host "Copied user-facing release exe:" -ForegroundColor Green
Write-Host "  $friendlyExe"
Write-Host "  Built $($item.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "  $($item.Length) bytes ($sizeMb MB)"
Write-Host "  SHA256 $hash"
