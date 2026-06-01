# Deploy FORGE quando SSH do PC falha

Sintoma: `Connection timed out during banner exchange` na porta 22.

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
