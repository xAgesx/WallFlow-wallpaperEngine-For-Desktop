param([long]$Hwnd, [int]$X, [int]$Y, [int]$W, [int]$H, [switch]$Stable)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WF {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint cr, byte a, uint f);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("kernel32.dll")] public static extern void SetLastError(uint e);
  [DllImport("kernel32.dll")] public static extern uint GetLastError();
  // SetParent's return value is ambiguous (NULL also means "was top-level"),
  // and PowerShell's pipeline can clobber the thread's last-error between two
  // separate calls — so verify the whole sequence inside one C# call.
  public static uint TrySetParent(IntPtr c, IntPtr p) {
    SetLastError(0);
    SetParent(c, p);
    return GetLastError();
  }
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[void][WF]::SetProcessDPIAware()
$progman = [WF]::FindWindow("Progman", [NullString]::Value)
if ($progman -eq [IntPtr]::Zero) { Write-Output "NOPROGMAN"; exit 1 }

function Find-WallpaperTarget {
  # 1) Win11 24H2 raised desktop: wallpaper WorkerW is a CHILD of Progman (under DefView)
  $t = [WF]::FindWindowEx($progman, [IntPtr]::Zero, "WorkerW", [NullString]::Value)
  if ($t -ne [IntPtr]::Zero) { return @($t, "PROGMAN-CHILD-WORKERW") }
  # 2) classic: top-level WorkerW that hosts SHELLDLL_DefView
  $w = [WF]::FindWindowEx([IntPtr]::Zero, [IntPtr]::Zero, "WorkerW", [NullString]::Value)
  while ($w -ne [IntPtr]::Zero) {
    $dv = [WF]::FindWindowEx($w, [IntPtr]::Zero, "SHELLDLL_DefView", [NullString]::Value)
    if ($dv -ne [IntPtr]::Zero) { return @($w, "TOPLEVEL-WORKERW") }
    $w = [WF]::FindWindowEx([IntPtr]::Zero, $w, "WorkerW", [NullString]::Value)
  }
  return @([IntPtr]::Zero, "")
}

$window = [IntPtr]$Hwnd

# Ordered candidate list: the shell's wallpaper layer first (correct layer on
# Win11 24H2 / classic), Progman as the stable fallback. -Stable skips the
# shell layers entirely — some machines create a WorkerW via 0x052C that dies
# within seconds, taking any child window down with it.
$candidates = New-Object System.Collections.ArrayList
if (-not $Stable) {
  $found = Find-WallpaperTarget
  if ($found[1]) {
    [void]$candidates.Add(@($found[0], $found[1]))
  } else {
    # No wallpaper layer yet — ask the shell to build it. Only send 0x052C when
    # needed: re-sending it over an existing layer can make the shell recreate
    # the layer and destroy windows already attached to it.
    $dummy = [IntPtr]::Zero
    # Win11 raised-desktop needs wParam=0xD lParam=0x1; classic layouts use 0xD/0
    [WF]::SendMessageTimeout($progman, 0x052C, [IntPtr]0xD, [IntPtr]0x1, 2, 1000, [ref]$dummy) | Out-Null
    $found = Find-WallpaperTarget
    if (-not $found[1]) {
      [WF]::SendMessageTimeout($progman, 0x052C, [IntPtr]0xD, [IntPtr]0x0, 2, 1000, [ref]$dummy) | Out-Null
      $found = Find-WallpaperTarget
    }
    if ($found[1]) { [void]$candidates.Add(@($found[0], $found[1])) }
  }
}
[void]$candidates.Add(@($progman, "PROGMAN"))

$target = [IntPtr]::Zero
$mode = ""
foreach ($c in $candidates) {
  if (-not [WF]::IsWindow($c[0])) { continue }
  if ([WF]::TrySetParent($window, $c[0]) -eq 0) { $target = $c[0]; $mode = $c[1]; break }
}
if ($target -eq [IntPtr]::Zero) { Write-Output "ATTACHFAIL"; exit 1 }

# If the shell's layer dies right after the reparent it takes our window with
# it — catch that here so the caller can retry with the stable Progman target.
Start-Sleep -Milliseconds 400
if (-not [WF]::IsWindow($window)) { Write-Output "TARGETDIED"; exit 1 }

# DWM compositing behind icons requires a layered (opaque) window on modern Win11
$ex = [WF]::GetWindowLong($window, -20)  # GWL_EXSTYLE
if (($ex -band 0x80000) -eq 0) { [void][WF]::SetWindowLong($window, -20, $ex -bor 0x80000) }  # WS_EX_LAYERED
[void][WF]::SetLayeredWindowAttributes($window, 0, 255, 2)  # LWA_ALPHA fully opaque

$pr = New-Object WF+RECT
[WF]::GetWindowRect($target, [ref]$pr) | Out-Null
$rx = $X - $pr.Left
$ry = $Y - $pr.Top
if ($mode -eq "PROGMAN") {
  $defview = [WF]::FindWindowEx($progman, [IntPtr]::Zero, "SHELLDLL_DefView", [NullString]::Value)
  $after = if ($defview -ne [IntPtr]::Zero) { $defview } else { [IntPtr]1 }  # HWND_BOTTOM
  [WF]::SetWindowPos($window, $after, $rx, $ry, $W, $H, 0x0030) | Out-Null
} else {
  [WF]::SetWindowPos($window, [IntPtr]1, $rx, $ry, $W, $H, 0x0030) | Out-Null  # HWND_BOTTOM
}
Write-Output ("OK " + $mode + " " + $pr.Left + "," + $pr.Top + "," + $pr.Right + "," + $pr.Bottom)
