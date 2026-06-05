$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$cachePaths = @(
  (Join-Path (Split-Path -Parent $PSScriptRoot) ".vite-cache"),
  (Join-Path (Split-Path -Parent $PSScriptRoot) "node_modules\.vite")
)

foreach ($path in $cachePaths) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

npm.cmd run dev -- --host 127.0.0.1
