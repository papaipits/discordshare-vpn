# DiscordShare VPN

Faz o **vídeo / câmera / Go Live nativos do Discord funcionarem** onde eles estão bloqueados por região (ex.: Brasil), **de graça**.

Como: roteia **apenas o Discord** por um túnel **WireGuard** para um servidor **fora do país** (via **WireSock**, per-app). O resto da sua internet continua na sua conexão normal — nada de VPN no sistema inteiro.

> ⚠️ Isto provavelmente fere os Termos de Serviço do Discord. Use por sua conta e risco. Leia o código antes de rodar (é tudo JavaScript/PowerShell legível).

## O que ele faz
- Adiciona um painel **dentro do Discord** (botão 🛡 no canto, ou **Ctrl+Shift+V**).
- Abre o login do **Proton VPN** (grátis) numa janela e **captura o config WireGuard** automaticamente.
- Sobe/desce um túnel **WireSock per-app** (só `Discord`/`DiscordPTB`). Pede **admin só na primeira conexão** (cria uma tarefa agendada); depois é silencioso.

## Requisitos
- Windows 10/11, Discord desktop instalado.
- **WireSock Secure Connect CLI** (o instalador instala via `winget` se faltar).
- Uma conta grátis de um provedor que exporte **config WireGuard** (recomendado: **Proton VPN Free** — servidores US/NL/JP sem cartão).

## Instalar
```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
Depois, no Discord:
1. Clique no **🛡** (ou **Ctrl+Shift+V**).
2. **Proton VPN → Abrir login** → crie a conta Free → **crie um config WireGuard** num servidor **fora do BR** (US). É capturado sozinho.
3. Clique **Conectar** (aprove o UAC **uma vez**). O selo no topo mostra **🟢 saída US**.
4. Dê **Go Live** / ligue a câmera normalmente.

Para desligar: **Desligar** no painel (o Discord volta pra sua região normal).

## Desinstalar
```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```
Reverte o Discord ao normal e remove o túnel. (O WireSock fica instalado; remova com `winget uninstall NTKERNEL.WireSockVPNClientCLI` se quiser.)

## Por que WireSock (e não um proxy)?
A mídia de voz/vídeo do Discord é **UDP nativo** (`discord_voice.node`), que **não passa por proxy SOCKS/HTTP** — só o gateway iria pros EUA e o vídeo falharia com **erro 2012**. Um túnel WireGuard de verdade (WireSock) carrega o UDP nativo, então a mídia também sai do país certo. É **per-app** justamente pra não derrubar a internet do resto da máquina.

## Arquivos
- `ds-hook-vpn.js` — hook do processo principal (injeta o painel, captura config, controla o túnel).
- `ds-preload-vpn.js` — preload (ponte renderer↔main).
- `ds-vpn-panel.js` — o painel dentro do Discord.
- `install.ps1` / `uninstall.ps1` — instalador / desinstalador (core-patch do `index.js` do Discord).
