# Builds the app icons from public/mascot.png: the bee only (without the "Hachi" lettering),
# drawn as it is (black lines) on a white square.
#   icon-180.png        iPhone home screen (iOS only rounds the corners, so the bee can be large)
#   icon-192/512.png    Android / manifest. They are "maskable": Android may crop them to a circle,
#                       so the bee stays inside the middle of the square.
# Run:  powershell -File scripts/make-icons.ps1 -Src public/mascot.png -OutDir public -PreviewDir <any folder>
# Keep this file ASCII-only: Windows PowerShell 5.1 reads scripts without a BOM in the system code page.
param([string]$Src, [string]$OutDir, [string]$PreviewDir)
Add-Type -AssemblyName System.Drawing

$art = [System.Drawing.Bitmap]::FromFile($Src)
# The bee (with the little lines beside its head) in the source drawing: a square around x 880..1410, y 236..770.
$cx = 1145; $cy = 503; $side = 548
$crop = New-Object System.Drawing.Rectangle ($cx - $side / 2), ($cy - $side / 2), $side, $side

function Make([int]$size, [double]$scale, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $d = [int][math]::Round($size * $scale); $o = [int][math]::Round(($size - $d) / 2)
  $g.DrawImage($art, (New-Object System.Drawing.Rectangle $o, $o, $d, $d), $crop.X, $crop.Y, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Save("$OutDir\$name", [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "$name ${size}x${size}, " + (Get-Item "$OutDir\$name").Length + " bytes"
}
Make 180 0.80 "icon-180.png"
Make 192 0.66 "icon-192.png"
Make 512 0.66 "icon-512.png"
$art.Dispose()

# Preview: the iPhone icon with rounded corners, and the Android icon cropped to a circle, on a grey background.
if ($PreviewDir) {
  $sheet = New-Object System.Drawing.Bitmap 620, 320
  $g = [System.Drawing.Graphics]::FromImage($sheet); $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(120, 130, 125))
  $ios = [System.Drawing.Image]::FromFile("$OutDir\icon-180.png")
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath; $r = 56; $x = 30; $y = 30; $s = 260
  $path.AddArc($x, $y, $r * 2, $r * 2, 180, 90); $path.AddArc($x + $s - $r * 2, $y, $r * 2, $r * 2, 270, 90); $path.AddArc($x + $s - $r * 2, $y + $s - $r * 2, $r * 2, $r * 2, 0, 90); $path.AddArc($x, $y + $s - $r * 2, $r * 2, $r * 2, 90, 90); $path.CloseFigure()
  $g.SetClip($path); $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g.DrawImage($ios, $x, $y, $s, $s); $g.ResetClip(); $ios.Dispose()
  $and = [System.Drawing.Image]::FromFile("$OutDir\icon-512.png")
  # Android's circle mask shows the middle 80% of a maskable icon
  $circle = New-Object System.Drawing.Drawing2D.GraphicsPath; $circle.AddEllipse(330, 30, 260, 260)
  $g.SetClip($circle); $g.DrawImage($and, (New-Object System.Drawing.Rectangle 330, 30, 260, 260), 51, 51, 410, 410, [System.Drawing.GraphicsUnit]::Pixel); $g.ResetClip(); $and.Dispose()
  $g.Dispose(); $sheet.Save("$PreviewDir\icon-sheet.png", [System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()
}
