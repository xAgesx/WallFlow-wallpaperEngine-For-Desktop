param([string]$Enable, [string]$Exe, [string]$AppDir, [string]$Dev)
$reg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$name = 'WallFlow'
if ($Enable -eq '1') {
  if ($Dev -eq '1') {
    $value = "`"$Exe`" `"$AppDir`""
  } else {
    $value = "`"$Exe`""
  }
  New-Item -Path $reg -Force | Out-Null
  Set-ItemProperty -Path $reg -Name $name -Value $value
} else {
  Remove-ItemProperty -Path $reg -Name $name -ErrorAction SilentlyContinue
}
