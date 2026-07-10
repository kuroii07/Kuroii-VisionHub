$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Invoke-NativeCommand { python scripts/release_candidate_check.py } "release candidate consistency check"
Invoke-NativeCommand { npm.cmd run test } "provider unit tests"
Invoke-NativeCommand { python scripts/smoke_check.py } "smoke check"
Invoke-NativeCommand { npm.cmd run build } "npm run build"
Invoke-NativeCommand { cargo.exe check --manifest-path src-tauri/Cargo.toml } "cargo check"
Invoke-NativeCommand { cargo.exe test --manifest-path src-tauri/Cargo.toml } "cargo unit tests"
Invoke-NativeCommand { git -c safe.directory="$projectRoot" diff --check } "git diff --check"

Write-Host "VisionHub checks passed." -ForegroundColor Green
