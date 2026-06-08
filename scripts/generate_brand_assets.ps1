$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$iconDir = Join-Path $projectRoot "src-tauri\icons"
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  [void]$path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  [void]$path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  [void]$path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  [void]$path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  [void]$path.CloseFigure()
  return $path
}

function New-VisionHubIconPng {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $pad = $Size * 0.075
  $radius = $Size * 0.235
  $rect = [System.Drawing.RectangleF]::new($pad, $pad, $Size - ($pad * 2), $Size - ($pad * 2))
  $shapePath = New-RoundedRectPath $rect.X $rect.Y $rect.Width $rect.Height $radius

  $baseBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 13, 18, 31),
    [System.Drawing.Color]::FromArgb(255, 29, 44, 66),
    135
  )
  $graphics.FillPath($baseBrush, $shapePath)

  $accentRect = [System.Drawing.RectangleF]::new($Size * 0.16, $Size * 0.13, $Size * 0.72, $Size * 0.72)
  $accentBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $accentRect,
    [System.Drawing.Color]::FromArgb(255, 132, 104, 255),
    [System.Drawing.Color]::FromArgb(255, 37, 217, 207),
    35
  )
  $accentPen = [System.Drawing.Pen]::new($accentBrush, [Math]::Max(2, $Size * 0.045))
  $graphics.DrawEllipse($accentPen, $accentRect)

  $orbitPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(190, 255, 255, 255), [Math]::Max(1.5, $Size * 0.018))
  $graphics.DrawArc($orbitPen, $Size * 0.23, $Size * 0.31, $Size * 0.54, $Size * 0.3, 208, 252)

  $nodeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 47, 232, 219))
  $graphics.FillEllipse($nodeBrush, $Size * 0.7, $Size * 0.23, $Size * 0.09, $Size * 0.09)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 145, 118, 255)), $Size * 0.2, $Size * 0.68, $Size * 0.08, $Size * 0.08)

  $fontSize = $Size * 0.26
  $font = [System.Drawing.Font]::new("Segoe UI Semibold", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $text = "VH"
  $textSize = $graphics.MeasureString($text, $font)
  $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 246, 249, 255))
  $graphics.DrawString($text, $font, $textBrush, ($Size - $textSize.Width) / 2, ($Size - $textSize.Height) / 2 + ($Size * 0.02))

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-InstallerBitmap {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [switch]$Sidebar
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $rect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(17, 24, 39),
    [System.Drawing.Color]::FromArgb(28, 206, 197),
    $(if ($Sidebar) { 90 } else { 15 })
  )
  $graphics.FillRectangle($brush, $rect)

  if ($Sidebar) {
    $markSize = 86
    $markPath = New-RoundedRectPath 39 36 $markSize $markSize 24
    $graphics.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(34, 255, 255, 255)), $markPath)
    $font = [System.Drawing.Font]::new("Segoe UI Semibold", 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString("VH", $font, [System.Drawing.Brushes]::White, 54, 56)
    $smallFont = [System.Drawing.Font]::new("Segoe UI", 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString("VisionHub`nStudio", $smallFont, [System.Drawing.Brushes]::White, 24, 150)
  } else {
    $font = [System.Drawing.Font]::new("Segoe UI Semibold", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString("VisionHub Studio", $font, [System.Drawing.Brushes]::White, 16, 14)
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

$sizes = @(16, 32, 48, 64, 128, 256)
$pngPaths = @()
foreach ($size in $sizes) {
  $path = Join-Path $iconDir "icon-$size.png"
  New-VisionHubIconPng -Size $size -OutputPath $path
  $pngPaths += $path
}

New-VisionHubIconPng -Size 1024 -OutputPath (Join-Path $iconDir "icon.png")
New-IcoFromPngs -PngPaths $pngPaths -Path (Join-Path $iconDir "icon.ico")
New-InstallerBitmap -Width 150 -Height 57 -Path (Join-Path $iconDir "installer-header.bmp")
New-InstallerBitmap -Width 164 -Height 314 -Path (Join-Path $iconDir "installer-sidebar.bmp") -Sidebar

Write-Host "VisionHub brand assets generated in $iconDir"
