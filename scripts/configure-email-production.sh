#!/bin/bash
set -eu
ENV_FILE="/opt/etholys/apps/web/.env"
test -n "${RESEND_API_KEY:-}"
touch "$ENV_FILE"
grep -q '^RESEND_API_KEY=' "$ENV_FILE" && sed -i "s|^RESEND_API_KEY=.*|RESEND_API_KEY=${RESEND_API_KEY}|" "$ENV_FILE" || echo "RESEND_API_KEY=${RESEND_API_KEY}" >> "$ENV_FILE"
grep -q '^AUTH_EMAIL_FROM=' "$ENV_FILE" && sed -i 's|^AUTH_EMAIL_FROM=.*|AUTH_EMAIL_FROM="Etholys <noreply@etholys.com>"|' "$ENV_FILE" || echo 'AUTH_EMAIL_FROM="Etholys <noreply@etholys.com>"' >> "$ENV_FILE"
grep -q '^FORGE_EMAIL_FROM=' "$ENV_FILE" && sed -i 's|^FORGE_EMAIL_FROM=.*|FORGE_EMAIL_FROM="Etholys <noreply@etholys.com>"|' "$ENV_FILE" || echo 'FORGE_EMAIL_FROM="Etholys <noreply@etholys.com>"' >> "$ENV_FILE"
cd /opt/etholys/infra
if docker ps --format '{{.Names}}' | grep -q etholys-caddy-prod; then
  docker compose -f docker-compose.prod.yml up -d --force-recreate web
else
  docker compose -f docker-compose.prod-nginx.yml up -d --force-recreate web
fi
echo configured
