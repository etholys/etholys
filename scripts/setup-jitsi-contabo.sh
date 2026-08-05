#!/bin/bash
# Etholys Meet — Jitsi self-hosted no Contabo (Caddy + Docker).
# Sem isto a app cai em meet.jit.si (limite ~5 min em iframe).
#
# Pré-requisitos:
#   1. DNS Cloudflare: A meet → IP Contabo (proxy OFF / DNS only cinza) OU proxy ON + SSL Full
#   2. Firewall Contabo + UFW: TCP 80/443 + UDP 10000 (WebRTC)
#   3. App já a correr: /opt/etholys/infra docker-compose.prod.yml
#
# Uso (no servidor, como root):
#   bash /opt/etholys/scripts/setup-jitsi-contabo.sh
#   # ou:
#   JITSI_DOMAIN=meet.etholys.com SERVER_IP=84.247.187.155 bash scripts/setup-jitsi-contabo.sh
set -eu

JITSI_DIR="${JITSI_DIR:-/opt/jitsi-docker}"
DOMAIN="${JITSI_DOMAIN:-meet.etholys.com}"
PUBLIC_URL="https://${DOMAIN}"
SERVER_IP="${SERVER_IP:-$(curl -sf --max-time 5 ifconfig.me 2>/dev/null || true)}"
SERVER_IP="${SERVER_IP:-84.247.187.155}"
ETHOLYS_ROOT="${ETHOLYS_ROOT:-/opt/etholys}"
ETHOLYS_ENV="${ETHOLYS_ENV:-${ETHOLYS_ROOT}/apps/web/.env}"
INFRA_ENV="${INFRA_ENV:-${ETHOLYS_ROOT}/infra/.env}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@etholys.com}"

echo "=== Etholys Meet / Jitsi Contabo ==="
echo "  DOMAIN     = ${DOMAIN}"
echo "  PUBLIC_URL = ${PUBLIC_URL}"
echo "  SERVER_IP  = ${SERVER_IP}"
echo "  JITSI_DIR  = ${JITSI_DIR}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root (ssh root@…)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Corra antes: infra/scripts/contabo-server-setup.sh"
  exit 1
fi

echo "==> UFW: UDP 10000 (JVB / WebRTC media)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 10000/udp comment 'Jitsi JVB' || true
  ufw allow 10000/tcp comment 'Jitsi JVB tcp' || true
  ufw status | head -20 || true
fi

echo "==> Clone / update docker-jitsi-meet"
if [ ! -d "${JITSI_DIR}/.git" ]; then
  git clone https://github.com/jitsi/docker-jitsi-meet.git "$JITSI_DIR"
fi
cd "$JITSI_DIR"
git pull --ff-only || true

if [ ! -f .env ]; then
  cp env.example .env
  ./gen-passwords.sh
fi

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

# TLS fica no Caddy da app Etholys; Jitsi só HTTP local :8000
set_env PUBLIC_URL "$PUBLIC_URL"
set_env DOCKER_HOST_ADDRESS "$SERVER_IP"
set_env JVB_ADVERTISE_IPS "$SERVER_IP"
set_env DISABLE_HTTPS "1"
set_env ENABLE_LETSENCRYPT "0"
set_env HTTP_PORT "8000"
set_env HTTPS_PORT "8443"
set_env ENABLE_RECORDING "${MEET_ENABLE_RECORDING:-0}"
set_env ENABLE_TRANSCRIPTIONS "${MEET_ENABLE_TRANSCRIPTIONS:-0}"
set_env ENABLE_WELCOME_PAGE "0"
set_env ENABLE_BREAKOUT_ROOMS "1"
set_env TZ "America/Sao_Paulo"
if [ "${MEET_ENABLE_TRANSCRIPTIONS:-0}" = "1" ]; then
  set_env JIGASI_TRANSCRIBER_ENABLE_SAVING "1"
  set_env JIGASI_TRANSCRIBER_ADVERTISE_URL "0"
  set_env JIGASI_TRANSCRIBER_SEND_TXT "0"
  set_env JIGASI_TRANSCRIBER_RECORD_AUDIO "1"
  if [ -n "${JIGASI_TRANSCRIBER_WHISPER_URL:-}" ]; then
    set_env JIGASI_TRANSCRIBER_WHISPER_URL "${JIGASI_TRANSCRIBER_WHISPER_URL}"
  fi
fi
# Caminho absoluto — ~ quebra mounts e permissões uid 1000
set_env CONFIG "/root/.jitsi-meet-cfg"

echo "==> Pastas de config (uid 1000 — Prosody)"
mkdir -p /root/.jitsi-meet-cfg/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri,storage/prosody}
chown -R 1000:1000 /root/.jitsi-meet-cfg

echo "==> Subir stack Jitsi (primeira vez demora — imagens grandes)"
COMPOSE_FILES=(-f docker-compose.yml)
if [ "${MEET_ENABLE_TRANSCRIPTIONS:-0}" = "1" ]; then
  COMPOSE_FILES+=(-f transcriber.yml)
fi
if [ "${MEET_ENABLE_RECORDING:-0}" = "1" ]; then
  COMPOSE_FILES+=(-f jibri.yml)
fi
docker compose "${COMPOSE_FILES[@]}" pull
docker compose "${COMPOSE_FILES[@]}" up -d

echo "==> Aguardar HTTP :8000"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:8000/" || curl -sf -o /dev/null -H "Host: ${DOMAIN}" "http://127.0.0.1:8000/"; then
    echo "  Jitsi HTTP OK"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "AVISO: :8000 ainda não responde. Veja: cd ${JITSI_DIR} && docker compose logs --tail=80"
  fi
done

echo "==> infra/.env (MEET_DOMAIN para Caddy)"
mkdir -p "$(dirname "$INFRA_ENV")"
touch "$INFRA_ENV"
if grep -q '^MEET_DOMAIN=' "$INFRA_ENV"; then
  sed -i "s|^MEET_DOMAIN=.*|MEET_DOMAIN=${DOMAIN}|" "$INFRA_ENV"
else
  echo "MEET_DOMAIN=${DOMAIN}" >> "$INFRA_ENV"
fi

echo "==> apps/web/.env (JITSI_BASE_URL)"
touch "$ETHOLYS_ENV"
if grep -q '^JITSI_BASE_URL=' "$ETHOLYS_ENV"; then
  sed -i "s|^JITSI_BASE_URL=.*|JITSI_BASE_URL=${PUBLIC_URL}|" "$ETHOLYS_ENV"
else
  echo "JITSI_BASE_URL=${PUBLIC_URL}" >> "$ETHOLYS_ENV"
fi
if grep -q '^NEXT_PUBLIC_JITSI_BASE_URL=' "$ETHOLYS_ENV"; then
  sed -i "s|^NEXT_PUBLIC_JITSI_BASE_URL=.*|NEXT_PUBLIC_JITSI_BASE_URL=${PUBLIC_URL}|" "$ETHOLYS_ENV"
else
  echo "NEXT_PUBLIC_JITSI_BASE_URL=${PUBLIC_URL}" >> "$ETHOLYS_ENV"
fi
if grep -q '^MEET_LIVE_TRANSCRIPTION_ENABLED=' "$ETHOLYS_ENV"; then
  sed -i "s|^MEET_LIVE_TRANSCRIPTION_ENABLED=.*|MEET_LIVE_TRANSCRIPTION_ENABLED=${MEET_ENABLE_TRANSCRIPTIONS:-0}|" "$ETHOLYS_ENV"
else
  echo "MEET_LIVE_TRANSCRIPTION_ENABLED=${MEET_ENABLE_TRANSCRIPTIONS:-0}" >> "$ETHOLYS_ENV"
fi
if grep -q '^MEET_CLOUD_RECORDING_ENABLED=' "$ETHOLYS_ENV"; then
  sed -i "s|^MEET_CLOUD_RECORDING_ENABLED=.*|MEET_CLOUD_RECORDING_ENABLED=${MEET_ENABLE_RECORDING:-0}|" "$ETHOLYS_ENV"
else
  echo "MEET_CLOUD_RECORDING_ENABLED=${MEET_ENABLE_RECORDING:-0}" >> "$ETHOLYS_ENV"
fi

if [ -f "${ETHOLYS_ROOT}/infra/docker-compose.prod.yml" ]; then
  echo "==> Recarregar Caddy + web (proxy meet → :8000)"
  cd "${ETHOLYS_ROOT}/infra"
  docker compose -f docker-compose.prod.yml up -d caddy web
else
  echo "AVISO: ${ETHOLYS_ROOT}/infra/docker-compose.prod.yml não encontrado — atualize o Caddyfile à mão."
fi

echo ""
echo "=== Pronto (código) ==="
echo "1. Cloudflare DNS:"
echo "   Tipo A | Nome: meet | Conteúdo: ${SERVER_IP}"
echo "   Proxy: DNS only (cinza) é mais simples para WebRTC; se laranja, SSL Full."
echo "2. Firewall Contabo (painel): abrir UDP 10000 (além de 22/80/443)."
echo "3. Testar:"
echo "   dig +short ${DOMAIN}"
echo "   curl -I https://${DOMAIN}"
echo "4. Abrir /hub/meet e criar sala — URL deve começar por ${PUBLIC_URL}"
echo ""
echo "Parar Jitsi (libertar RAM): cd ${JITSI_DIR} && docker compose stop"
echo "Email Let's Encrypt (Caddy): certificado automático quando DNS apontar."
echo "CERTBOT_EMAIL=${CERTBOT_EMAIL} (referência; Caddy não usa certbot)"
