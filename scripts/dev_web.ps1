$ErrorActionPreference = "Stop"
. "$PSScriptRoot\use_portable_toolchain.ps1"

$projectRoot = Split-Path -Parent $PSScriptRoot
$devPort = 1420
$devUrl = "http://127.0.0.1:$devPort/"

function Test-ViteDevServerReady {
  param(
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -eq 200 -and $response.Content -match '<div id="root">')
  } catch {
    return $false
  }
}

$portOwner = Get-NetTCPConnection -LocalPort $devPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portOwner) {
  $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($portOwner.OwningProcess)" -ErrorAction SilentlyContinue
  $ownerCommand = if ($ownerProcess) { $ownerProcess.CommandLine } else { "" }
  if ($ownerCommand -notlike "*$projectRoot*") {
    $ownerDetail = if ($ownerProcess) { "$($ownerProcess.Name) PID $($ownerProcess.ProcessId): $ownerCommand" } else { "PID $($portOwner.OwningProcess)" }
    throw "Port $devPort is already used by another process. Stop it before starting VisionHub Studio. Owner: $ownerDetail"
  }

  if (Test-ViteDevServerReady -Url $devUrl) {
    Write-Host "VisionHub Vite dev server is already running at $devUrl"
    exit 0
  }

  Write-Host "Port $devPort is owned by this project, but Vite is not responding. Stopping stale process [$($portOwner.OwningProcess)]."
  Stop-Process -Id $portOwner.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
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
