$env:VISIONHUB_TOOLS = "C:\tmp\visionhub-tools"
$env:RUSTUP_HOME = "C:\tmp\visionhub-tools\rustup"
$env:CARGO_HOME = "C:\tmp\visionhub-tools\cargo"
$env:npm_config_cache = "C:\tmp\visionhub-tools\npm-cache"
$env:PATH = "C:\tmp\visionhub-tools\node;C:\tmp\visionhub-tools\cargo\bin;" + $env:PATH
Write-Host "VisionHub portable toolchain enabled:" -ForegroundColor Green
node --version
npm --version
rustc --version
cargo --version
