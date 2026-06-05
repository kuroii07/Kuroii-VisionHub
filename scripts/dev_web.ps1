$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$projectRoot = Split-Path -Parent $PSScriptRoot
$devPort = 1420
$portOwner = Get-NetTCPConnection -LocalPort $devPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portOwner) {
  $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($portOwner.OwningProcess)" -ErrorAction SilentlyContinue
  $ownerCommand = if ($ownerProcess) { $ownerProcess.CommandLine } else { "" }
  if ($ownerCommand -notlike "*$projectRoot*") {
    $ownerDetail = if ($ownerProcess) { "$($ownerProcess.Name) PID $($ownerProcess.ProcessId): $ownerCommand" } else { "PID $($portOwner.OwningProcess)" }
    throw "Port $devPort is already used by another process. Stop it before starting VisionHub Studio. Owner: $ownerDetail"
  }
}

$cachePaths = @(
  (Join-Path $projectRoot ".vite-cache"),
  (Join-Path $projectRoot "node_modules\.vite")
)

foreach ($path in $cachePaths) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

npm.cmd run dev -- --host 127.0.0.1
