$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"
& "$PSScriptRoot\stop_app.ps1"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

python scripts/smoke_check.py
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "npm build failed with exit code $LASTEXITCODE"
}

npm.cmd run tauri:dev -- --config src-tauri/tauri.static.conf.json
