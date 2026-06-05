$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"
& "$PSScriptRoot\stop_app.ps1"

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

npm.cmd run tauri:dev
