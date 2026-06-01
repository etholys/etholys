#!/bin/bash
# Recupera forge.etholys.com (502/504). Correr como root na consola Hetzner.
set -eu

cd /opt/etholys
echo "=== $(date -u) — restore forge web ==="

echo "=== Parar builds / liberar RAM ==="
pkill -f "docker-buildx" 2>/dev/null || true
pkill -f "buildkit" 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

echo "=== Código ==="
git fetch origin
git reset --hard origin/main
echo "HEAD $(git rev-parse --short HEAD)"

echo "=== Migração Prisma (evita hang no startup) ==="
docker exec etholys-postgres-prod psql -U etholys -d etholys -c \
  "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260606120000_forge_play_groups' AND finished_at IS NULL;" 2>/dev/null || true

cd /opt/etholys/infra
if docker compose -f docker-compose.prod-nginx.yml ps web 2>/dev/null | grep -q Up; then
  docker compose -f docker-compose.prod-nginx.yml run --rm --no-deps web \
    npx prisma migrate resolve --applied 20260606120000_forge_play_groups 2>/dev/null || true
fi

echo "=== Reiniciar web (sem rebuild) ==="
docker compose -f docker-compose.prod-nginx.yml up -d --no-build web 2>/dev/null || \
  docker compose -f docker-compose.prod-nginx.yml up -d web

echo "=== Aguardar porta 3001 (máx. 3 min) ==="
for i in $(seq 1 36); do
  if curl -sf -m 3 -o /dev/null http://127.0.0.1:3001/api/forge/health 2>/dev/null; then
    echo "OK health em ${i}0s"
    docker ps --filter name=etholys-web-prod --format '{{.Status}}'
    curl -s -m 5 -o /dev/null -w "root: %{http_code}\n" http://127.0.0.1:3001/ || true
    exit 0
  fi
  if [ "$((i % 6))" -eq 0 ]; then
    echo "--- log (${i}0s) ---"
    docker logs etholys-web-prod --tail 12 2>&1 || true
  fi
  sleep 5
done

echo "=== Falhou — últimos logs ==="
docker logs etholys-web-prod --tail 40 2>&1 || true
echo "Se migrate travar: docker compose -f docker-compose.prod-nginx.yml run --rm --no-deps web npx prisma migrate deploy"
exit 1
