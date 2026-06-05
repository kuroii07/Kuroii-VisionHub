$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$processes = Get-Process -ErrorAction SilentlyContinue | Where-Object {
  ($_.ProcessName -eq "visionhub-studio") -or
  ($_.Path -and $_.Path.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase))
}

foreach ($process in $processes) {
  Write-Host "Stopping $($process.ProcessName) [$($process.Id)]"
  Stop-Process -Id $process.Id -Force
}

if (-not $processes) {
  Write-Host "No VisionHub Studio processes found."
}
