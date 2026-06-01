# Jitsi sem limite de 5 minutos (FORGE)

O embed em `meet.jit.si` corta a ~5 minutos. Produção deve usar **Jitsi self-hosted** em subdomínio próprio.

## 1. DNS (Cloudflare ou registrador)

| Registro | Tipo | Valor |
|----------|------|--------|
| `meet.forge` | A | IP do servidor Hetzner (ex. `178.105.80.131`) |

Resultado: `https://meet.forge.etholys.com`

## 2. Nginx + SSL no servidor

```bash
# No servidor (já existe script no repo)
cd /opt/etholys
bash scripts/setup-jitsi-on-server.sh
certbot --nginx -d meet.forge.etholys.com
```

Proxy reverso: porta **8000** (docker Jitsi) → `meet.forge.etholys.com`.

## 3. Variáveis da app

Em `apps/web/.env` / produção:

```env
JITSI_BASE_URL=https://meet.forge.etholys.com
NEXT_PUBLIC_JITSI_BASE_URL=https://meet.forge.etholys.com
```

Rebuild do contentor `web`.

## 4. Partilha de ecrã

Com Jitsi próprio, o iframe inclui `enableScreensharing=true`. O utilizador usa o botão **Compartilhar tela** na barra do Jitsi (ícone monitor).

## Verificação

```bash
dig meet.forge.etholys.com +short
curl -I https://meet.forge.etholys.com
```

Deve responder 200/301, não NXDOMAIN.
