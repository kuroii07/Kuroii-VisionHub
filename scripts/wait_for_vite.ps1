$ErrorActionPreference = "Stop"

param(
  [string]$Url = "http://127.0.0.1:1420/",
  [int]$TimeoutSeconds = 30
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200 -and $response.Content -match '<div id="root">') {
      Write-Host "Vite is ready: $Url"
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

throw "Vite did not become ready at $Url within $TimeoutSeconds seconds."
