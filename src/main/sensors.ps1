# WallFlow companion sensors — streams mouse buttons and master volume to stdout.
# One line per event:  "M L 1" (left down) / "M L 0" (up) / "M R 1" / "M M 1"
#                      "V 42"  (master volume changed to 42%)
# Started by the main process while the companion is enabled; killed on disable/quit.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WfVol {
  [DllImport("winmm.dll")]
  public static extern int waveOutGetVolume(IntPtr h, out uint v);
}
'@

function Emit([string]$s) {
  [Console]::WriteLine($s)
  [Console]::Out.Flush()
}

$lastBtn = [System.Windows.Forms.Control]::MouseButtons
$lastVol = -1
$i = 0

while ($true) {
  try {
    $btn = [System.Windows.Forms.Control]::MouseButtons
    if ([int]$btn -ne [int]$lastBtn) {
      foreach ($b in @('Left', 'Right', 'Middle')) {
        $mask = [int][System.Windows.Forms.MouseButtons]::$b
        $now = ([int]$btn -band $mask) -ne 0
        $was = ([int]$lastBtn -band $mask) -ne 0
        if ($now -ne $was) {
          $c = switch ($b) { 'Left' { 'L' } 'Right' { 'R' } default { 'M' } }
          if ($now) { Emit "M $c 1" } else { Emit "M $c 0" }
        }
      }
      $lastBtn = $btn
    }

    if (($i % 6) -eq 0) {
      $v = [uint32]0
      [WfVol]::waveOutGetVolume([IntPtr]::Zero, [ref]$v) | Out-Null
      $pct = [int][math]::Round((($v -band 0xFFFF) / 65535.0) * 100)
      if ($pct -ne $lastVol) {
        $lastVol = $pct
        Emit "V $pct"
      }
    }
  } catch {
    # never die on a transient read error — keep streaming
  }
  $i++
  Start-Sleep -Milliseconds 50
}
