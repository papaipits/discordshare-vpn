# Runs after Inno copies files to {app}. Ensures WireSock, patches Discord, restarts it.
# (No file copy here — the installer already placed the files; $PSScriptRoot = install dir.)
$ErrorActionPreference = 'Stop'
$dest = $PSScriptRoot
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'vpn-configs') | Out-Null

# Ensure WireSock Secure Connect CLI (per-app tunnel engine)
$ws = @(
  'C:\Program Files\WireSock Secure Connect\sdk\wiresock-client.exe',
  'C:\Program Files\WireSock Secure Connect\wiresock-client.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ws) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id NTKERNEL.WireSockVPNClientCLI --accept-source-agreements --accept-package-agreements
  } else {
    Write-Warning 'winget nao encontrado. Instale WireSock Secure Connect CLI de https://wiresock.net e rode de novo.'
  }
}

# Patch Discord cores (Stable + PTB)
$hookReq = ($dest -replace '\\','/') + '/ds-hook-vpn.js'
function Patch-App($name) {
  $root = Join-Path $env:LOCALAPPDATA $name
  if (-not (Test-Path $root)) { return }
  $ver = Get-ChildItem $root -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
  if (-not $ver) { return }
  $idx = Join-Path $ver.FullName 'modules\discord_desktop_core-1\discord_desktop_core\index.js'
  if (-not (Test-Path $idx)) { return }
  $bak = "$idx.dsbak"
  if (-not (Test-Path $bak)) { Copy-Item $idx $bak -Force }
  $orig = Get-Content $bak -Raw
  $line = "try { require('$hookReq'); } catch (e) { try { console.error('ds-hook-vpn load failed', e); } catch (_) {} }`n"
  [System.IO.File]::WriteAllText($idx, $line + $orig)
}
Patch-App 'Discord'
Patch-App 'DiscordPTB'

# Restart Discord (as the normal user)
Get-Process Discord,DiscordPTB -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$d = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Discord') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object { try { [version]($_.Name -replace '^app-','') } catch { [version]'0.0' } } | Select-Object -Last 1
if ($d) { Start-Process (Join-Path $d.FullName 'Discord.exe') }
