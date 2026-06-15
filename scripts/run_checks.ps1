$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Invoke-NativeCommand { python scripts/smoke_check.py } "smoke check"
Invoke-NativeCommand { npm.cmd run build } "npm run build"
Invoke-NativeCommand { cargo.exe check --manifest-path src-tauri/Cargo.toml } "cargo check"
