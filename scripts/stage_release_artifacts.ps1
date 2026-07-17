$ErrorActionPreference = "Stop"

. "$PSScriptRoot\release_artifact_helpers.ps1"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $projectRoot "src-tauri\target\release"
$version = (Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json).version
$artifactDir = Join-Path $projectRoot "outputs\release\Kuroii-VisionHub-$version"

$artifacts = @(
  [PSCustomObject]@{
    Source = Join-Path $releaseDir "Kuroii VisionHub.exe"
    Name = "Kuroii-VisionHub.exe"
  },
  [PSCustomObject]@{
    Source = Join-Path $releaseDir "bundle\nsis\Kuroii VisionHub_$version`_x64-setup.exe"
    Name = "Kuroii VisionHub_$version`_x64-setup.exe"
  },
  [PSCustomObject]@{
    Source = Join-Path $releaseDir "bundle\msi\Kuroii VisionHub_$version`_x64_en-US.msi"
    Name = "Kuroii VisionHub_$version`_x64_en-US.msi"
  }
)

New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null

foreach ($artifact in $artifacts) {
  if (-not (Test-Path -LiteralPath $artifact.Source)) {
    throw "Release artifact not found: $($artifact.Source)"
  }

  Copy-Item -LiteralPath $artifact.Source -Destination (Join-Path $artifactDir $artifact.Name) -Force
}

$checksumLines = @(
  "# Kuroii VisionHub $version release artifacts",
  ""
)

foreach ($artifact in $artifacts) {
  $stagedPath = Join-Path $artifactDir $artifact.Name
  $checksumLines += "$(Get-Sha256 -Path $stagedPath) *$($artifact.Name)"
}

Set-Content -LiteralPath (Join-Path $artifactDir "SHA256SUMS.txt") -Value $checksumLines -Encoding utf8

Write-Host "Staged release artifacts:" -ForegroundColor Green
Write-Host "  $artifactDir"
foreach ($artifact in $artifacts) {
  Write-Host "  $($artifact.Name)"
}
Write-Host "  SHA256SUMS.txt"
