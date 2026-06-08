$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$iconDir = Join-Path $projectRoot "src-tauri\icons"
$sourceIconPath = Join-Path $iconDir "visionhub-logo.png"
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null

if (-not (Test-Path -LiteralPath $sourceIconPath)) {
  throw "Brand source image not found: $sourceIconPath"
}

function Draw-ContainedImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height
  )

  $scale = [Math]::Min($Width / $Image.Width, $Height / $Image.Height)
  $drawWidth = $Image.Width * $scale
  $drawHeight = $Image.Height * $scale
  $drawX = $X + (($Width - $drawWidth) / 2)
  $drawY = $Y + (($Height - $drawHeight) / 2)
  $Graphics.DrawImage($Image, [System.Drawing.RectangleF]::new($drawX, $drawY, $drawWidth, $drawHeight))
}

function New-VisionHubIconPng {
  param(
    [System.Drawing.Image]$SourceImage,
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  Draw-ContainedImage -Graphics $graphics -Image $SourceImage -X 0 -Y 0 -Width $Size -Height $Size

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-InstallerBitmap {
  param(
    [System.Drawing.Image]$SourceImage,
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [switch]$Sidebar
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $rect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 17, 24, 39),
    [System.Drawing.Color]::FromArgb(255, 28, 206, 197),
    $(if ($Sidebar) { 90 } else { 15 })
  )
  $graphics.FillRectangle($brush, $rect)

  if ($Sidebar) {
    Draw-ContainedImage -Graphics $graphics -Image $SourceImage -X 24 -Y 22 -Width 116 -Height 116
    $smallFont = [System.Drawing.Font]::new("Segoe UI", 13, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString("VisionHub Studio", $smallFont, [System.Drawing.Brushes]::White, 18, 152)
    $smallFont.Dispose()
  } else {
    Draw-ContainedImage -Graphics $graphics -Image $SourceImage -X 10 -Y 10 -Width 38 -Height 38
    $font = [System.Drawing.Font]::new("Segoe UI Semibold", 15, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString("VisionHub", $font, [System.Drawing.Brushes]::White, 52, 18)
    $font.Dispose()
  }

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-IcoFromPngs {
  param(
    [string[]]$PngPaths,
    [string]$Path
  )

  $entries = foreach ($pngPath in $PngPaths) {
    $bytes = [System.IO.File]::ReadAllBytes($pngPath)
    $image = [System.Drawing.Image]::FromFile($pngPath)
    [pscustomobject]@{
      Width = [int]$image.Width
      Height = [int]$image.Height
      Bytes = $bytes
    }
    $image.Dispose()
  }

  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
  $writer = [System.IO.BinaryWriter]::new($stream)
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$entries.Count)

  $offset = 6 + ($entries.Count * 16)
  foreach ($entry in $entries) {
    $writer.Write([byte]$(if ($entry.Width -ge 256) { 0 } else { $entry.Width }))
    $writer.Write([byte]$(if ($entry.Height -ge 256) { 0 } else { $entry.Height }))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $entry.Bytes.Length
  }

  foreach ($entry in $entries) {
    $writer.Write($entry.Bytes)
  }

  $writer.Dispose()
  $stream.Dispose()
}

$sourceImage = [System.Drawing.Image]::FromFile($sourceIconPath)
$sizes = @(16, 32, 48, 64, 128, 256)
$pngPaths = @()

foreach ($size in $sizes) {
  $path = Join-Path $iconDir "icon-$size.png"
  New-VisionHubIconPng -SourceImage $sourceImage -Size $size -OutputPath $path
  $pngPaths += $path
}

New-VisionHubIconPng -SourceImage $sourceImage -Size 1024 -OutputPath (Join-Path $iconDir "icon.png")
New-IcoFromPngs -PngPaths $pngPaths -Path (Join-Path $iconDir "icon.ico")
New-InstallerBitmap -SourceImage $sourceImage -Width 150 -Height 57 -Path (Join-Path $iconDir "installer-header.bmp")
New-InstallerBitmap -SourceImage $sourceImage -Width 164 -Height 314 -Path (Join-Path $iconDir "installer-sidebar.bmp") -Sidebar

$sourceImage.Dispose()

Write-Host "VisionHub brand assets generated from $sourceIconPath"
