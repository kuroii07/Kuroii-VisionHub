$ErrorActionPreference = "Stop"

. "$PSScriptRoot\use_portable_toolchain.ps1"
. "$PSScriptRoot\release_artifact_helpers.ps1"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$reportDir = Join-Path $projectRoot "docs\run-reports"
$reportPath = Join-Path $reportDir "latest-run.md"
$appVersion = (Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json).version
$artifactDir = Join-Path $projectRoot "outputs\release\Kuroii-VisionHub-$appVersion"
$releaseExe = Join-Path $artifactDir "Kuroii-VisionHub.exe"
$nsisInstaller = Join-Path $artifactDir "Kuroii VisionHub_$appVersion`_x64-setup.exe"
$msiInstaller = Join-Path $artifactDir "Kuroii VisionHub_$appVersion`_x64_en-US.msi"
$startedAt = Get-Date
$steps = New-Object System.Collections.Generic.List[string]

New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
Set-Location $projectRoot

function Add-Step {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail = ""
  )

  if ($Detail) {
    $steps.Add("- **$Name**: $Status - $Detail")
  } else {
    $steps.Add("- **$Name**: $Status")
  }
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    Add-Step $Name "FAILED" "exit code $LASTEXITCODE"
    throw "$Name failed with exit code $LASTEXITCODE"
  }
  Add-Step $Name "OK"
}

function Get-ArtifactLine {
  param(
    [string]$Label,
    [string]$Path
  )

  if (Test-Path $Path) {
    $item = Get-Item $Path
    $hash = Get-Sha256 -Path $Path
    return "- ${Label}: $Path ($([Math]::Round($item.Length / 1MB, 2)) MB, SHA256 $hash)"
  }

  return "- ${Label}: not found ($Path)"
}

try {
  & "$PSScriptRoot\stop_app.ps1"
  Add-Step "Stop previous app" "OK"

  Invoke-Step "Smoke check" { python scripts/smoke_check.py }
  Invoke-Step "Frontend build" { npm.cmd run build }
  Invoke-Step "Rust check" { cargo.exe check --manifest-path src-tauri/Cargo.toml }
  Invoke-Step "Tauri release build" { npm.cmd run tauri:build }

  if (-not (Test-Path $releaseExe)) {
    Add-Step "Release exe" "FAILED" "not found: $releaseExe"
    throw "Release exe not found: $releaseExe"
  }

  Start-Process -FilePath $releaseExe -WorkingDirectory (Split-Path $releaseExe -Parent)
  Start-Sleep -Seconds 4
  $app = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.Equals($releaseExe, [System.StringComparison]::OrdinalIgnoreCase) } | Sort-Object StartTime -Descending | Select-Object -First 1

  if ($app) {
    Add-Step "Start release app" "OK" "PID $($app.Id)"
  } else {
    Add-Step "Start release app" "FAILED" "process not found after launch"
    throw "Kuroii VisionHub process not found after launch."
  }

  $finishedAt = Get-Date
  $content = @(
    "# Kuroii VisionHub remote run report",
    "",
    "- Started: $($startedAt.ToString('yyyy-MM-dd HH:mm:ss'))",
    "- Finished: $($finishedAt.ToString('yyyy-MM-dd HH:mm:ss'))",
    "- Release exe: $releaseExe",
    "- Active PID: $($app.Id)",
    "",
    "## Steps",
    "",
    ($steps -join [Environment]::NewLine),
    "",
    "## Artifacts",
    "",
    (Get-ArtifactLine "Release exe" $releaseExe),
    (Get-ArtifactLine "NSIS installer" $nsisInstaller),
    (Get-ArtifactLine "MSI installer" $msiInstaller),
    "",
    "## Stable start command",
    "",
    "powershell -ExecutionPolicy Bypass -File ""$projectRoot\scripts\start_release.ps1"""
  ) -join [Environment]::NewLine

  Set-Content -Path $reportPath -Value $content -Encoding UTF8
  Write-Host "Report written: $reportPath" -ForegroundColor Green
} catch {
  $finishedAt = Get-Date
  $content = @(
    "# Kuroii VisionHub remote run report",
    "",
    "- Started: $($startedAt.ToString('yyyy-MM-dd HH:mm:ss'))",
    "- Failed: $($finishedAt.ToString('yyyy-MM-dd HH:mm:ss'))",
    "- Error: $($_.Exception.Message)",
    "",
    "## Steps",
    "",
    ($steps -join [Environment]::NewLine)
  ) -join [Environment]::NewLine

  Set-Content -Path $reportPath -Value $content -Encoding UTF8
  Write-Host "Report written with failure: $reportPath" -ForegroundColor Yellow
  throw
}
