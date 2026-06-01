#!/bin/bash
# Repara P3009 (migração forge_play_groups falhou) e sobe etholys-web-prod.
set -eu
cd /opt/etholys

PSQL="docker exec -i etholys-postgres-prod psql -U etholys -d etholys -v ON_ERROR_STOP=1"

echo "=== Remover registo failed ==="
echo "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260606120000_forge_play_groups';" | $PSQL

echo "=== Aplicar SQL (tabelas/colunas) ==="
$PSQL < apps/web/prisma/migrations/20260606120000_forge_play_groups/migration.sql

echo "=== Marcar migração como aplicada ==="
cd /opt/etholys/infra
docker compose -f docker-compose.prod-nginx.yml run --rm --no-deps web \
  npx prisma migrate resolve --applied 20260606120000_forge_play_groups

echo "=== Reiniciar web ==="
docker compose -f docker-compose.prod-nginx.yml up -d web
sleep 8
docker ps --filter name=etholys-web-prod --format '{{.Status}}'
curl -sf -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3001/ || true
