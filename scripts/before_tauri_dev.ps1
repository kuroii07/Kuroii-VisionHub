$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$projectRoot = Split-Path -Parent $PSScriptRoot
$cachePaths = @(
  (Join-Path $projectRoot ".vite-cache"),
  (Join-Path $projectRoot "node_modules\.vite")
)

foreach ($path in $cachePaths) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

Write-Host "Starting Vite dev server at http://127.0.0.1:1420 ..."
npm.cmd run dev -- --host 127.0.0.1
