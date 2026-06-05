$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$portableRoot = if ($env:VISIONHUB_TOOLS) { $env:VISIONHUB_TOOLS } else { "C:\tmp\visionhub-tools" }
$nodeRoot = Join-Path $portableRoot "node"
$rustupHome = Join-Path $portableRoot "rustup"
$cargoHome = Join-Path $portableRoot "cargo"
$npmCache = Join-Path $projectRoot ".npm-cache"

New-Item -ItemType Directory -Force -Path $npmCache | Out-Null
$env:npm_config_cache = $npmCache

$hasPortableNode = Test-Path (Join-Path $nodeRoot "node.exe")
$hasPortableCargo = Test-Path (Join-Path $cargoHome "bin\cargo.exe")

if ($hasPortableNode -or $hasPortableCargo) {
  $env:VISIONHUB_TOOLS = $portableRoot
  if ($hasPortableCargo) {
    $env:RUSTUP_HOME = $rustupHome
    $env:CARGO_HOME = $cargoHome
  }
  $pathParts = @()
  if ($hasPortableNode) { $pathParts += $nodeRoot }
  if ($hasPortableCargo) { $pathParts += (Join-Path $cargoHome "bin") }
  $env:PATH = ($pathParts -join ";") + ";" + $env:PATH
  Write-Host "VisionHub portable toolchain enabled: $portableRoot" -ForegroundColor Green
} else {
  Write-Host "VisionHub portable toolchain not found; using system toolchain." -ForegroundColor Yellow
}

node --version
npm --version
rustc --version
cargo --version
