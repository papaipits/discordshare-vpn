# DiscordShare VPN - uninstaller. Reverts the Discord core patch and removes the tunnel.
# Run as admin for full cleanup (to delete the scheduled task):
#   powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
$ErrorActionPreference = 'SilentlyContinue'
$dest = Join-Path $env:LOCALAPPDATA 'DiscordShareVPN'

Write-Host "== DiscordShare VPN uninstaller ==" -ForegroundColor Cyan

# 1) Stop + remove the tunnel
& schtasks /end /tn DiscordShareVPN | Out-Null
& taskkill /f /im wiresock-client.exe | Out-Null
& schtasks /delete /tn DiscordShareVPN /f | Out-Null   # needs admin; harmless if it fails

# 2) Revert Discord cores from backup
function Unpatch($name) {
  $appRoot = Join-Path $env:LOCALAPPDATA $name
  Get-ChildItem $appRoot -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | ForEach-Object {
    $idx = Join-Path $_.FullName 'modules\discord_desktop_core-1\discord_desktop_core\index.js'
    $bak = "$idx.dsbak"
    if (Test-Path $bak) { Copy-Item $bak $idx -Force; Remove-Item $bak -Force }
    elseif (Test-Path $idx) { [System.IO.File]::WriteAllText($idx, "module.exports = require('./core.asar');`n") }
  }
}
Unpatch 'Discord'; Unpatch 'DiscordPTB'

# 3) Restart Discord clean + remove files
Get-Process Discord,DiscordPTB -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Remove-Item $dest -Recurse -Force
$d = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Discord') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
if ($d) { Start-Process (Join-Path $d.FullName 'Discord.exe') }

Write-Host "Uninstalled. Discord reverted to normal." -ForegroundColor Green
Write-Host "WireSock was left installed. Remove it with:  winget uninstall NTKERNEL.WireSockVPNClientCLI"
