$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$projectRoot = Split-Path -Parent $PSScriptRoot
$devPort = 1420

function Test-PortOwnerIsCurrentProject {
  param(
    [int]$ProcessId
  )

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $process) {
    return $false
  }

  return ($process.CommandLine -like "*$projectRoot*")
}

$portOwner = Get-NetTCPConnection -LocalPort $devPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portOwner) {
  if (Test-PortOwnerIsCurrentProject -ProcessId $portOwner.OwningProcess) {
    Write-Host "VisionHub Vite dev server is already running at http://127.0.0.1:$devPort"
    exit 0
  }

  $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($portOwner.OwningProcess)" -ErrorAction SilentlyContinue
  $ownerDetail = if ($ownerProcess) { "$($ownerProcess.Name) PID $($ownerProcess.ProcessId): $($ownerProcess.CommandLine)" } else { "PID $($portOwner.OwningProcess)" }
  throw "Port $devPort is already used by another process. Stop it before starting VisionHub Studio. Owner: $ownerDetail"
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

Write-Host "Starting Vite dev server at http://127.0.0.1:$devPort ..."
npm.cmd run dev -- --host 127.0.0.1
