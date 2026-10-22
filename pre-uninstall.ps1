# Runs during uninstall (before Inno removes files): revert the Discord patch + remove the tunnel.
$ErrorActionPreference = 'SilentlyContinue'
& schtasks /end /tn DiscordShareVPN | Out-Null
& taskkill /f /im wiresock-client.exe | Out-Null
& schtasks /delete /tn DiscordShareVPN /f | Out-Null   # needs admin; harmless if it fails

function Unpatch($name) {
  $root = Join-Path $env:LOCALAPPDATA $name
  Get-ChildItem $root -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | ForEach-Object {
    $idx = Join-Path $_.FullName 'modules\discord_desktop_core-1\discord_desktop_core\index.js'
    $bak = "$idx.dsbak"
    if (Test-Path $bak) { Copy-Item $bak $idx -Force; Remove-Item $bak -Force }
    elseif (Test-Path $idx) { [System.IO.File]::WriteAllText($idx, "module.exports = require('./core.asar');`n") }
  }
}
Unpatch 'Discord'
Unpatch 'DiscordPTB'

Get-Process Discord,DiscordPTB -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$d = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Discord') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
if ($d) { Start-Process (Join-Path $d.FullName 'Discord.exe') }
