# DiscordShare VPN - web installer (no .exe; avoids Windows Smart App Control).
# One-liner:
#   irm https://raw.githubusercontent.com/papaipits/discordshare-vpn/main/web-install.ps1 | iex
# Does exactly what the Setup.exe did: drops the 3 plugin files, ensures WireSock (its own
# installer is signed -> passes SAC), patches Discord's core to load the hook, restarts Discord.
$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/papaipits/discordshare-vpn/main'
$dest = Join-Path $env:LOCALAPPDATA 'DiscordShareVPN'
Write-Host '== DiscordShare VPN (instalacao por script) ==' -ForegroundColor Cyan

# 1) plugin files
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'vpn-configs') | Out-Null
foreach ($f in 'ds-hook-vpn.js','ds-preload-vpn.js','ds-vpn-panel.js') {
  Invoke-WebRequest "$base/${f}?t=$(Get-Random)" -OutFile (Join-Path $dest $f) -UseBasicParsing
}
Write-Host "Arquivos -> $dest"

# 2) WireSock (signed NSIS installer -> not blocked by SAC; UAC prompt once)
$ws = @(
  'C:\Program Files\WireSock Secure Connect\sdk\wiresock-client.exe',
  'C:\Program Files\WireSock Secure Connect\wiresock-client.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ws) {
  Write-Host 'Instalando WireSock (aprove o UAC)...' -ForegroundColor Yellow
  $url = 'https://wiresock.net/_api/download-release.php?product=wiresock-secure-connect-sdk&platform=x64&version=3.6.1.1&channel=winget'
  $tmp = Join-Path $env:TEMP 'wiresock-sdk-3611.exe'
  try { Invoke-WebRequest $url -OutFile $tmp -UseBasicParsing; Start-Process -FilePath $tmp -ArgumentList '/S','/NCRC' -Verb RunAs -Wait }
  catch { Write-Host "Falha ao instalar WireSock: $_  (instale manual em wiresock.net)" -ForegroundColor Red }
} else { Write-Host "WireSock ja presente: $ws" }

# 3) patch Discord cores (Stable + PTB) to load the hook (per-user, no admin needed)
$hookReq = ($dest -replace '\\','/') + '/ds-hook-vpn.js'
function Patch-App($name) {
  $appRoot = Join-Path $env:LOCALAPPDATA $name
  if (-not (Test-Path $appRoot)) { return 'nao instalado' }
  $ver = Get-ChildItem $appRoot -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
  if (-not $ver) { return 'sem pasta app-*' }
  $idx = Join-Path $ver.FullName 'modules\discord_desktop_core-1\discord_desktop_core\index.js'
  if (-not (Test-Path $idx)) { return 'sem index.js' }
  $bak = "$idx.dsbak"
  if (-not (Test-Path $bak)) { Copy-Item $idx $bak -Force }
  $orig = Get-Content $bak -Raw
  $line = "try { require('$hookReq'); } catch (e) { try { console.error('ds-hook-vpn load failed', e); } catch (_) {} }`n"
  [System.IO.File]::WriteAllText($idx, $line + $orig)
  return 'patched'
}
Write-Host ("Discord (Stable): " + (Patch-App 'Discord'))
Write-Host ("Discord PTB:      " + (Patch-App 'DiscordPTB'))

# 4) restart Discord
Get-Process Discord,DiscordPTB -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$d = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Discord') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
if ($d) { Start-Process (Join-Path $d.FullName 'Discord.exe') }

Write-Host ''
Write-Host 'PRONTO.' -ForegroundColor Green
Write-Host 'No Discord: Configuracoes > DiscordVPN. Faca login no Proton, gere um config (US) e ligue o tunel.'
