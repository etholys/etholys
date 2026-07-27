# Jitsi sem limite de 5 minutos (FORGE / Meet)

> **Produção actual = Contabo.** Use o guia completo: **[MEET-JITSI-CONTABO.md](./MEET-JITSI-CONTABO.md)**  
> Script: `scripts/setup-jitsi-contabo.sh` → `https://meet.etholys.com`

O embed em `meet.jit.si` corta a ~5 minutos. Produção deve usar **Jitsi self-hosted**.

## Contabo (recomendado)

| Registro | Tipo | Valor |
|----------|------|--------|
| `meet` | A | IP Contabo (ex. `84.247.187.155`) |

```bash
bash scripts/setup-jitsi-contabo.sh
```

```env
JITSI_BASE_URL=https://meet.etholys.com
NEXT_PUBLIC_JITSI_BASE_URL=https://meet.etholys.com
```

## Legado Hetzner / Nginx (`meet.forge`)

Script antigo: `scripts/setup-jitsi-on-server.sh` + `infra/nginx-meet.forge.etholys.com.conf`.

| Registro | Tipo | Valor |
|----------|------|--------|
| `meet.forge` | A | IP Hetzner (legado) |

Não usar no Contabo (lá o TLS é Caddy, não Nginx).
