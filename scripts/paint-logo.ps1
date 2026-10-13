# Builds public/logo.png and public/logo-dark.png from public/mascot.png:
# crops the transparent margin, paints the stripes of the bee's abdomen yellow (head, body, wings and pot stay transparent),
# and writes a dark-theme copy whose line art is flipped to white.
# Run:  powershell -File scripts/paint-logo.ps1 -Src public/mascot.png -OutDir public -PreviewDir <any folder>
# Keep this file ASCII-only: Windows PowerShell 5.1 reads scripts without a BOM in the system code page.
param([string]$Src, [string]$OutDir, [string]$PreviewDir)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BeePaint {
  
  static byte[] Load(string path, out int w, out int h) {
    using (var bmp = new Bitmap(path)) {
      w = bmp.Width; h = bmp.Height;
      var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var buf = new byte[w * h * 4];
      for (int y = 0; y < h; y++) Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), buf, y * w * 4, w * 4);
      bmp.UnlockBits(data);
      return buf; // B, G, R, A
    }
  }
  static Bitmap ToBitmap(byte[] buf, int w, int h) {
    var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    for (int y = 0; y < h; y++) Marshal.Copy(buf, y * w * 4, IntPtr.Add(data.Scan0, y * data.Stride), w * 4);
    bmp.UnlockBits(data);
    return bmp;
  }
  
  static bool[] Dilate(bool[] m, int w, int h, int r, int x0, int y0, int x1, int y1) {
    var o = new bool[w * h];
    for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) {
      if (!m[y * w + x]) continue;
      for (int dy = -r; dy <= r; dy++) { int yy = y + dy; if (yy < y0 || yy > y1) continue;
        for (int dx = -r; dx <= r; dx++) { int xx = x + dx; if (xx < x0 || xx > x1) continue;
          if (dx * dx + dy * dy <= r * r) o[yy * w + xx] = true; } }
    }
    return o;
  }
  
  public static string Run(string src, string outLight, string outDark, int[] seeds, int[] box, int[] crop, int outH, int[] pal) {
    int w, h; var px = Load(src, out w, out h);
    int x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3];
    var line = new bool[w * h];
    for (int i = 0; i < w * h; i++) line[i] = px[i * 4 + 3] > 96;
    var mask = new int[w * h];
    var log = "";
    for (int s = 0; s < seeds.Length; s += 4) {
      int sx = seeds[s], sy = seeds[s + 1], r = seeds[s + 2], col = seeds[s + 3] + 1;
      var wall = Dilate(line, w, h, r, x0, y0, x1, y1);
      if (wall[sy * w + sx]) { log += string.Format("seed {0},{1}: on a line (skipped)\n", sx, sy); continue; }
      var fill = new bool[w * h]; var q = new Queue<int>(); q.Enqueue(sy * w + sx); fill[sy * w + sx] = true;
      int n = 0; bool leak = false;
      while (q.Count > 0) {
        int p = q.Dequeue(); n++; int x = p % w, y = p / w;
        if (x <= x0 || x >= x1 || y <= y0 || y >= y1) { leak = true; continue; }
        int[] nb = { p - 1, p + 1, p - w, p + w };
        foreach (int t in nb) if (!fill[t] && !wall[t]) { fill[t] = true; q.Enqueue(t); }
      }
      log += string.Format("seed {0},{1} r{2}: {3} px{4}\n", sx, sy, r, n, leak ? "  ** LEAKED to the outside, not painted **" : "");
      if (leak) continue;
      
      var grown = Dilate(fill, w, h, r + 3, x0, y0, x1, y1);
      for (int i = 0; i < w * h; i++) if (grown[i] && mask[i] == 0) mask[i] = col;
    }
    
    for (int variant = 0; variant < 2; variant++) {
      var o = new byte[w * h * 4];
      for (int i = 0; i < w * h; i++) {
        double b = px[i * 4], g = px[i * 4 + 1], r = px[i * 4 + 2], a = px[i * 4 + 3] / 255.0;
        if (variant == 1) { double mx = Math.Max(r, Math.Max(g, b)), mn = Math.Min(r, Math.Min(g, b)), sft = 255 - (mx + mn); r += sft; g += sft; b += sft; }
        if (mask[i] > 0) { int fr = pal[(mask[i] - 1) * 3], fg = pal[(mask[i] - 1) * 3 + 1], fb = pal[(mask[i] - 1) * 3 + 2]; 
          o[i * 4] = (byte)Math.Round(b * a + fb * (1 - a)); o[i * 4 + 1] = (byte)Math.Round(g * a + fg * (1 - a)); o[i * 4 + 2] = (byte)Math.Round(r * a + fr * (1 - a)); o[i * 4 + 3] = 255;
        } else { o[i * 4] = (byte)Math.Max(0, Math.Min(255, b)); o[i * 4 + 1] = (byte)Math.Max(0, Math.Min(255, g)); o[i * 4 + 2] = (byte)Math.Max(0, Math.Min(255, r)); o[i * 4 + 3] = px[i * 4 + 3]; }
      }
      using (var full = ToBitmap(o, w, h)) {
        int cw = crop[2], ch = crop[3], tw = (int)Math.Round(cw * (double)outH / ch);
        using (var res = new Bitmap(tw, outH, PixelFormat.Format32bppArgb))
        using (var gr = Graphics.FromImage(res)) {
          gr.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
          gr.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
          gr.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
          gr.Clear(Color.Transparent);
          gr.DrawImage(full, new Rectangle(0, 0, tw, outH), crop[0], crop[1], cw, ch, GraphicsUnit.Pixel);
          res.Save(variant == 0 ? outLight : outDark, ImageFormat.Png);
          if (variant == 0) log += string.Format("output {0}x{1}\n", tw, outH);
        }
      }
    }
    return log;
  }
}
"@

$seeds = @(1220,620,6,0,  1185,741,2,0)
$box = @(870, 226, 1420, 780)          
$crop = @(114, 230, 1300, 544)         
$log = [BeePaint]::Run($Src, "$OutDir\logo.png", "$OutDir\logo-dark.png", $seeds, $box, $crop, 288, @(0xF9,0xC9,0x3E, 0xFF,0xFF,0xFF))
$log

$bgs = @(@('logo.png',0xec,0xf0,0xed), @('logo-dark.png',0x12,0x12,0x12), @('logo.png',0xf7,0xd6,0xdf), @('logo.png',0xf8,0xd0,0x9a))
$one = [System.Drawing.Image]::FromFile("$OutDir\logo.png"); $tw = $one.Width; $th = $one.Height; $one.Dispose()
$sheet = New-Object System.Drawing.Bitmap ($tw + 40), (($th + 40) * $bgs.Count)
$g = [System.Drawing.Graphics]::FromImage($sheet)
for ($i = 0; $i -lt $bgs.Count; $i++) { $b = $bgs[$i]; $img = [System.Drawing.Image]::FromFile("$OutDir\$($b[0])")
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($b[1],$b[2],$b[3]))), 0, $i * ($th + 40), $tw + 40, $th + 40)
  $g.DrawImage($img, 20, $i * ($th + 40) + 20, $tw, $th); $img.Dispose() }
$g.Dispose(); $sheet.Save("$PreviewDir\logo-sheet.png", [System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()
"sizes: " + (Get-Item "$OutDir\logo.png").Length + " / " + (Get-Item "$OutDir\logo-dark.png").Length + " bytes"
