# Release a new version: bumps VERSION in the dev source + version.json, syncs the 3 files, pushes.
# Usage:  powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Version 1.0.2 -Notes "what changed"
param([Parameter(Mandatory)][string]$Version, [string]$Notes = '')
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\pietr\discordshare\research\inject'
$here = $PSScriptRoot
# bump VERSION in the dev source (source of truth)
$hp = Join-Path $src 'ds-hook-vpn.js'
(Get-Content $hp -Raw) -replace "const VERSION = '[^']*';", "const VERSION = '$Version';" | Set-Content $hp -NoNewline
# sync files + version.json into the repo
foreach ($f in 'ds-hook-vpn.js','ds-preload-vpn.js','ds-vpn-panel.js') { Copy-Item (Join-Path $src $f) (Join-Path $here $f) -Force }
@{ version = $Version; files = @('ds-hook-vpn.js','ds-preload-vpn.js','ds-vpn-panel.js'); notes = $Notes } | ConvertTo-Json | Set-Content (Join-Path $here 'version.json')
git -C $here add -A
git -C $here commit -m "v$Version $Notes"
git -C $here push
Write-Host "Published v$Version. Users will see the Update banner."
