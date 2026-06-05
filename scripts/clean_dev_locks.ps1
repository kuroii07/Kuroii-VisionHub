$ErrorActionPreference = "Stop"
& "$PSScriptRoot\stop_app.ps1"

$projectRoot = Split-Path -Parent $PSScriptRoot
$paths = @(
  (Join-Path $projectRoot ".vite-cache"),
  (Join-Path $projectRoot "node_modules\.vite")
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

Write-Host "Vite dev caches removed."
Write-Host "If Rust target files are locked, close old PowerShell/dev windows first."
