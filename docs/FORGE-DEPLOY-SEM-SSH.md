# Deploy FORGE quando SSH do PC falha

Sintoma: `Connection timed out during banner exchange` na porta 22.

Ou na consola Hetzner: **`Out of memory: Killed process`** (next-server, java, systemd).

O VPS tem **4 GB RAM**. Builds Docker + Jitsi (Java) + Next.js esgotam a memoria e o sistema mata processos — SSH e o site deixam de responder.

## Emergencia: consola a spammar OOM

1. No painel Hetzner (sem usar a consola): separador **Power** → **Reboot** (ou OFF 15 s → ON).
2. Apos reiniciar, abra de novo a consola `>_` e cole:

```bash
curl -fsSL https://raw.githubusercontent.com/etholys/etholys/main/scripts/recuperar-servidor-oom.sh -o /tmp/recuperar-oom.sh && bash /tmp/recuperar-oom.sh
```

Se o GitHub raw falhar, use o repo local:

```bash
cd /opt/etholys && git fetch origin && git reset --hard origin/main
bash /opt/etholys/scripts/recuperar-servidor-oom.sh
```

**Nunca** corra `deploy-forge-web.sh` (build) neste CX23 4 GB sem swap — use so `restore-forge-web.sh` ou faca build noutra maquina.

A porta 22 pode estar **aberta**, mas o `sshd` no servidor nao responde a tempo (RAM/CPU cheios, build Docker a correr, etc.).

## Passo 1 — Consola web Hetzner

1. Abra [console.hetzner.cloud](https://console.hetzner.cloud)
2. Servidor **178.105.80.131** → **Console** (terminal no browser)
3. Login: `root`

## Passo 2 — Atualizar codigo e recuperar

```bash
cd /opt/etholys && git fetch origin && git reset --hard origin/main
bash /opt/etholys/scripts/recuperar-servidor-ssh.sh
```

Deploy **completo** (so depois de SSH ou consola estavel, demora 10–20 min):

```bash
bash /opt/etholys/scripts/deploy-forge-web.sh
```

## Passo 3 — Firewall Hetzner (se SSH nunca voltar)

Painel Hetzner → servidor → **Firewalls**:

- Porta **22** deve permitir o **IP atual do seu PC** (ou temporariamente `0.0.0.0/0` para testar).
- Portas **80** e **443** para todos.

Descubra o seu IP: [https://ifconfig.me](https://ifconfig.me)

## Passo 4 — Chave SSH no Windows

No PowerShell (uma vez):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

Copie a linha e na consola Hetzner:

```bash
mkdir -p ~/.ssh
echo "COLE_A_CHAVE_AQUI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Teste: `ssh root@178.105.80.131 echo ok`

## Site no ar?

Abra [https://forge.etholys.com](https://forge.etholys.com) — pode responder mesmo quando SSH falha (nginx + container antigo).
