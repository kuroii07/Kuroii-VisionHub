$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project
. "$project\scripts\use_portable_toolchain.ps1"
Write-Host "Starting VisionHub Studio through Tauri dev..." -ForegroundColor Cyan
npm.cmd run tauri:dev
