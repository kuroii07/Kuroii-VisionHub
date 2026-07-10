$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tauriCommand = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"
Set-Location $projectRoot

if (-not (Test-Path -LiteralPath $tauriCommand)) {
  throw "Tauri CLI not found. Run npm.cmd install first: $tauriCommand"
}

$runningProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $_.ProcessName -in @("visionhub-studio", "Kuroii VisionHub")
}
if ($runningProcesses) {
  $processList = ($runningProcesses | ForEach-Object { "$($_.ProcessName) (PID $($_.Id))" }) -join ", "
  throw "Close the running release app before rebuilding: $processList"
}

Write-Host "==> Building release EXE without MSI/NSIS bundles" -ForegroundColor Cyan
& $tauriCommand build --no-bundle
if ($LASTEXITCODE -ne 0) {
  throw "Tauri release EXE build failed with exit code $LASTEXITCODE"
}

& (Join-Path $PSScriptRoot "copy_release_exe.ps1")

