# DiscordShare VPN - installer (core-patch).
# Makes Discord's native video/Go Live work from a region-blocked network by routing ONLY
# Discord through a non-Brazil WireGuard tunnel (WireSock per-app). Your general internet is untouched.
#
# Run:  powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = 'Stop'
$pkg  = $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA 'DiscordShareVPN'

Write-Host "== DiscordShare VPN installer ==" -ForegroundColor Cyan

# 1) Copy plugin files to a stable location
New-Item -ItemType Directory -Force -Path $dest | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'vpn-configs') | Out-Null
foreach ($f in 'ds-hook-vpn.js','ds-preload-vpn.js','ds-vpn-panel.js') {
  Copy-Item (Join-Path $pkg $f) $dest -Force
}
Write-Host "Plugin files -> $dest"

# 2) Ensure WireSock Secure Connect CLI (the per-app tunnel engine)
$ws = @(
  'C:\Program Files\WireSock Secure Connect\sdk\wiresock-client.exe',
  'C:\Program Files\WireSock Secure Connect\wiresock-client.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ws) {
  Write-Host "Installing WireSock (winget - approve the admin prompt)..." -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id NTKERNEL.WireSockVPNClientCLI --accept-source-agreements --accept-package-agreements
  } else {
    Write-Host "winget not found. Install WireSock Secure Connect CLI manually from https://wiresock.net then re-run." -ForegroundColor Red
    exit 1
  }
} else { Write-Host "WireSock already present: $ws" }

# 3) Patch Discord cores (Stable + PTB) to load the hook
$hookReq = ($dest -replace '\\','/') + '/ds-hook-vpn.js'
function Patch-App($name) {
  $appRoot = Join-Path $env:LOCALAPPDATA $name
  if (-not (Test-Path $appRoot)) { return 'not installed' }
  $ver = Get-ChildItem $appRoot -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
  if (-not $ver) { return 'no app-* folder' }
  $idx = Join-Path $ver.FullName 'modules\discord_desktop_core-1\discord_desktop_core\index.js'
  if (-not (Test-Path $idx)) { return 'no index.js' }
  $bak = "$idx.dsbak"
  if (-not (Test-Path $bak)) { Copy-Item $idx $bak -Force }   # preserve clean original
  $orig = Get-Content $bak -Raw
  $line = "try { require('$hookReq'); } catch (e) { try { console.error('ds-hook-vpn load failed', e); } catch (_) {} }`n"
  [System.IO.File]::WriteAllText($idx, $line + $orig)          # UTF-8 no BOM
  return 'patched'
}
Write-Host ("Discord (Stable): " + (Patch-App 'Discord'))
Write-Host ("Discord PTB:      " + (Patch-App 'DiscordPTB'))

# 4) Restart Discord
Get-Process Discord,DiscordPTB -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$d = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Discord') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
if ($d) { Start-Process (Join-Path $d.FullName 'Discord.exe') }

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "In Discord: click the shield button (bottom-right) or press Ctrl+Shift+V, then:"
Write-Host "  1) Open the Proton VPN login, create a free account"
Write-Host "  2) Create a WireGuard config on a server OUTSIDE Brazil (US) - it is captured automatically"
Write-Host "  3) Click Conectar. Approve the admin prompt the FIRST time only."
Write-Host "Your general internet stays on your normal connection; only Discord uses the tunnel."
