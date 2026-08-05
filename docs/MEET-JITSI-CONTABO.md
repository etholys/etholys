# Etholys Meet — Jitsi no Contabo

O Meet **já está no código** (Hub, SIEP, FORGE, IA). Sem Jitsi próprio a app usa `meet.jit.si`, que **corta ~5 minutos** em iframe e não serve para capacitações.

Este guia sobe **Jitsi self-hosted** no mesmo Contabo da app (`meet.etholys.com`), com Caddy a fazer TLS.

> Spec produto: [architecture/etholys-meet.md](./architecture/etholys-meet.md)  
> Deploy app: [DEPLOY-CONTABO-CLOUDFLARE.md](./DEPLOY-CONTABO-CLOUDFLARE.md)

---

## Arquitectura (piloto)

```
Browser
  ├─ https://app.etholys.com     → Caddy → Next.js (metadados Meet, IA)
  └─ https://meet.etholys.com    → Caddy → Jitsi :8000 (vídeo)
         + UDP 10000             → JVB (áudio/vídeo WebRTC)
```

| Peça | Nota |
|------|------|
| **RAM** | Jitsi + app + Postgres: ideal **≥ 8 GB**. Em 4 GB use swap e *pare* o Jitsi quando não houver calls. |
| **VPS separado** | Ideal a médio prazo (gravação Jibri). No piloto, mesmo Contabo é aceitável. |
| **Cloudflare** | Em `meet`, preferir **DNS only (cinza)** se áudio/vídeo falhar com proxy laranja. |

IP Contabo (exemplo): `84.247.187.155` — confirme no painel.

---

## Checklist rápido

1. [ ] DNS `meet` → IP Contabo  
2. [ ] Firewall Contabo: **UDP 10000** (+ 22/80/443)  
3. [ ] Código actualizado em `/opt/etholys` (Caddyfile com `MEET_DOMAIN`)  
4. [ ] `bash scripts/setup-jitsi-contabo.sh`  
5. [ ] `JITSI_BASE_URL=https://meet.etholys.com` no `.env` da web + restart  
6. [ ] Testar `/hub/meet` → Entrar → URL começa por `https://meet.etholys.com`

---

## 1. DNS (Cloudflare)

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|--------|
| A | `meet` | IP Contabo | **DNS only** (cinza) recomendado |
| A | `app` (já existe) | IP Contabo | Proxied OK |

Resultado: `https://meet.etholys.com`

SSL/TLS Cloudflare: **Full** (ou Full strict quando Caddy tiver cert).

---

## 2. Firewall Contabo (painel)

Além de TCP 22 / 80 / 443, criar regra **UDP 10000** (fonte qualquer). Sem isto o vídeo não liga (só UI).

No servidor (UFW), o script de setup também abre:

```bash
ufw allow 10000/udp
ufw allow 10000/tcp
```

---

## 3. Código no servidor

Se ainda não tiver o Caddyfile com bloco `MEET_DOMAIN` / `host.docker.internal`:

```bash
ssh root@SEU_IP
cd /opt/etholys
git pull   # ou scp/tar do deploy
```

Em `infra/.env`:

```env
APP_DOMAIN=app.etholys.com
MEET_DOMAIN=meet.etholys.com
```

Recarregar Caddy:

```bash
cd /opt/etholys/infra
docker compose -f docker-compose.prod.yml up -d caddy
```

---

## 4. Instalar Jitsi

```bash
cd /opt/etholys
bash scripts/setup-jitsi-contabo.sh
# opcional:
# SERVER_IP=84.247.187.155 JITSI_DOMAIN=meet.etholys.com bash scripts/setup-jitsi-contabo.sh
```

O script:

- clona `docker-jitsi-meet` em `/opt/jitsi-docker`
- sobe contentores (HTTP local `:8000`)
- abre UFW 10000
- grava `JITSI_BASE_URL` / `NEXT_PUBLIC_JITSI_BASE_URL` em `apps/web/.env`
- grava `MEET_DOMAIN` em `infra/.env`
- reinicia `caddy` + `web`

Primeira execução demora (imagens Docker grandes).

---

## 5. Verificar

```bash
dig +short meet.etholys.com
curl -I https://meet.etholys.com
cd /opt/jitsi-docker && docker compose ps
curl -sI http://127.0.0.1:8000/ | head -5
```

Na app: criar reunião em `/hub/meet` → o link deve ser `https://meet.etholys.com/etholys-…`.

No Hub Meet, se ainda aparecer aviso de **demo meet.jit.si**, o `.env` não foi aplicado — confirme e `docker compose … up -d web`.

---

## 6. Operação / RAM

```bash
# Parar Jitsi (libertar ~1–2 GB)
cd /opt/jitsi-docker && docker compose stop

# Voltar a ligar antes de uma capacitação
cd /opt/jitsi-docker && docker compose up -d
```

Script de emergência OOM: `scripts/recuperar-servidor-oom.sh` (para contentores Jitsi).

---

## 7. Breakouts

Com Jitsi self-hosted, o host vê **salas de breakout** na barra do Jitsi. A app já envia `config.breakoutRooms.hideAddRoomButton=false` no embed.

---

## 8. O que ainda não está neste setup (piloto Contabo)

| Item | Estado | Doc |
|------|--------|-----|
| Gravação (Jibri) + R2 | Código app pronto; precisa VPS/Jibri + env | [MEET-VPS-JIBRI.md](./MEET-VPS-JIBRI.md) |
| Transcrição automática | Whisper (`OPENAI_API_KEY`) | idem |
| OAuth Google/Outlook | F6 no Hub; flags `GOOGLE_CALENDAR_ENABLED` / Azure AD | architecture/etholys-meet.md |

---

## Referência legado

O script antigo `scripts/setup-jitsi-on-server.sh` + Nginx (`meet.forge.etholys.com`) era para Hetzner. No Contabo use **este guia** e `setup-jitsi-contabo.sh`.
