#!/bin/bash
# Migração billing + rebuild etholys-web (só apps/web)
set -eu
cd /opt/etholys
echo "=== $(date -u) — deploy access/billing ==="
git fetch origin
git reset --hard origin/main
echo "HEAD $(git rev-parse --short HEAD)"

bash /opt/etholys/scripts/_apply-billing-sql-prod.sh

echo "=== Build web ==="
cd /opt/etholys/infra
export DOCKER_BUILDKIT=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web

echo "=== Health ==="
for i in $(seq 1 48); do
  if docker exec etholys-web-prod wget -qO- http://127.0.0.1:3000/api/forge/health 2>/dev/null | grep -q '"ok":true'; then
    echo "OK health"
    docker exec etholys-web-prod test -f /app/lib/billing/company-entitlements.ts && echo "billing lib OK" || echo "WARN billing lib missing"
    exit 0
  fi
  if [ "$((i % 6))" -eq 0 ]; then
    echo "--- aguardando (${i}0s) ---"
    docker logs etholys-web-prod --tail 6 2>&1 || true
  fi
  sleep 5
done
echo "Health falhou"
exit 1
