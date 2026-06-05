param(
  [string]$ToolsRoot = "C:\tmp\visionhub-tools"
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$ToolsRoot = [System.IO.Path]::GetFullPath($ToolsRoot)
$NodeRoot = Join-Path $ToolsRoot "node"
$DownloadsRoot = Join-Path $ToolsRoot "downloads"
$RustupHome = Join-Path $ToolsRoot "rustup"
$CargoHome = Join-Path $ToolsRoot "cargo"
$NpmCache = Join-Path $ToolsRoot "npm-cache"

New-Item -ItemType Directory -Force -Path $ToolsRoot, $DownloadsRoot, $RustupHome, $CargoHome, $NpmCache | Out-Null

Write-Step "Resolving latest Node.js LTS Windows x64 zip"
$nodeIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
$nodeRelease = $nodeIndex | Where-Object { $_.lts -and ($_.files -contains "win-x64-zip") } | Select-Object -First 1
if (-not $nodeRelease) {
  throw "Cannot resolve a Node.js LTS release with win-x64-zip."
}

$nodeVersion = $nodeRelease.version
$nodeZipName = "node-$nodeVersion-win-x64.zip"
$nodeZipUrl = "https://nodejs.org/dist/$nodeVersion/$nodeZipName"
$nodeZipPath = Join-Path $DownloadsRoot $nodeZipName

Write-Step "Downloading Node.js $nodeVersion"
Invoke-WebRequest -Uri $nodeZipUrl -OutFile $nodeZipPath

Write-Step "Installing portable Node.js to $NodeRoot"
if (Test-Path $NodeRoot) {
  Remove-Item -LiteralPath $NodeRoot -Recurse -Force
}
$nodeExtractRoot = Join-Path $ToolsRoot "node-extract"
if (Test-Path $nodeExtractRoot) {
  Remove-Item -LiteralPath $nodeExtractRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $nodeExtractRoot | Out-Null
Expand-Archive -LiteralPath $nodeZipPath -DestinationPath $nodeExtractRoot -Force
$extractedNodeDir = Get-ChildItem -Path $nodeExtractRoot -Directory | Select-Object -First 1
Move-Item -LiteralPath $extractedNodeDir.FullName -Destination $NodeRoot
Remove-Item -LiteralPath $nodeExtractRoot -Recurse -Force

Write-Step "Downloading rustup-init"
$rustupPath = Join-Path $DownloadsRoot "rustup-init-x86_64-pc-windows-msvc.exe"
Invoke-WebRequest -Uri "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" -OutFile $rustupPath

Write-Step "Installing portable Rust stable toolchain"
$env:RUSTUP_HOME = $RustupHome
$env:CARGO_HOME = $CargoHome
& $rustupPath -y --no-modify-path --profile minimal --default-toolchain stable --default-host x86_64-pc-windows-msvc

Write-Step "Writing project-local environment helper"
$helper = @"
`$env:VISIONHUB_TOOLS = "$ToolsRoot"
`$env:RUSTUP_HOME = "$RustupHome"
`$env:CARGO_HOME = "$CargoHome"
`$env:npm_config_cache = "$NpmCache"
`$env:PATH = "$NodeRoot;$CargoHome\bin;" + `$env:PATH
Write-Host "VisionHub portable toolchain enabled:" -ForegroundColor Green
node --version
npm --version
rustc --version
cargo --version
"@
$helperPath = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\use_portable_toolchain.ps1"
Set-Content -Path $helperPath -Value $helper -Encoding UTF8

Write-Step "Verifying portable toolchain"
$env:npm_config_cache = $NpmCache
$env:PATH = "$NodeRoot;$CargoHome\bin;" + $env:PATH
node --version
npm --version
rustc --version
cargo --version

Write-Host ""
Write-Host "Portable toolchain installed successfully." -ForegroundColor Green
Write-Host "Run this before project commands:" -ForegroundColor Yellow
Write-Host ". .\scripts\use_portable_toolchain.ps1"
