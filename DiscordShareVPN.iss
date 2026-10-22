; DiscordShare VPN - Inno Setup wizard installer
#define MyApp "DiscordShare VPN"
#define MyVer "1.0.0"

[Setup]
AppId={{8F3C2A14-9B7E-4D2A-A1F6-0A1B2C3D4E5F}
AppName={#MyApp}
AppVersion={#MyVer}
AppPublisher=DiscordShare
DefaultDirName={localappdata}\DiscordShareVPN
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=DiscordShareVPN-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=warning.txt
UninstallDisplayName={#MyApp}
UninstallDisplayIcon={app}\ds-hook-vpn.js

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "ds-hook-vpn.js";    DestDir: "{app}"; Flags: ignoreversion
Source: "ds-preload-vpn.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "ds-vpn-panel.js";   DestDir: "{app}"; Flags: ignoreversion
Source: "post-install.ps1";  DestDir: "{app}"; Flags: ignoreversion
Source: "pre-uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md";         DestDir: "{app}"; Flags: ignoreversion isreadme

[Run]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\post-install.ps1"""; \
  StatusMsg: "Instalando WireSock e integrando ao Discord (pode pedir admin)..."; \
  Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\pre-uninstall.ps1"""; \
  Flags: runhidden waituntilterminated; RunOnceId: "DsVpnRevert"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
