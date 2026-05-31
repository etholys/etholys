#!/bin/bash
# Jitsi Meet self-hosted para FORGE (sem limite de 5 min do meet.jit.si).
# Pré-requisito DNS: meet.forge → IP do servidor (Cloudflare OK).
# Uso: bash /opt/etholys/scripts/setup-jitsi-on-server.sh
set -eu

JITSI_DIR="${JITSI_DIR:-/opt/jitsi-docker}"
DOMAIN="${JITSI_DOMAIN:-meet.forge.etholys.com}"
PUBLIC_URL="https://${DOMAIN}"
SERVER_IP="${SERVER_IP:-$(curl -sf ifconfig.me 2>/dev/null || echo 178.105.80.131)}"
ETHOLYS_ENV="${ETHOLYS_ENV:-/opt/etholys/apps/web/.env}"

echo "=== Jitsi Meet — ${PUBLIC_URL} ==="

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root."
  exit 1
fi

if [ ! -d "$JITSI_DIR/.git" ]; then
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

set_env PUBLIC_URL "$PUBLIC_URL"
set_env DOCKER_HOST_ADDRESS "$SERVER_IP"
set_env DISABLE_HTTPS "1"
set_env HTTP_PORT "8000"
set_env HTTPS_PORT "8443"
set_env ENABLE_RECORDING "0"
set_env ENABLE_TRANSCRIPTIONS "0"
set_env ENABLE_WELCOME_PAGE "0"
set_env ENABLE_LETSENCRYPT "0"
set_env TZ "America/Montevideo"
set_env JVB_ADVERTISE_IPS "$SERVER_IP"

echo "=== Docker Jitsi (pode demorar na primeira vez) ==="
docker compose pull
docker compose up -d

echo "=== Nginx ==="
cp /opt/etholys/infra/nginx-meet.forge.etholys.com.conf "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx

if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "${CERTBOT_EMAIL:-admin@etholys.com}" || true
fi

echo "=== Etholys .env (JITSI_BASE_URL) ==="
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

cd /opt/etholys/infra
docker compose -f docker-compose.prod-nginx.yml up -d --build web

echo ""
echo "OK: ${PUBLIC_URL}"
echo "Reinicie o Salón FORGE — o iframe deve usar o vosso Jitsi (sem aviso de 5 min)."
