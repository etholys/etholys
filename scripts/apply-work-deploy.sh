#!/bin/bash
# Deploy Etholys Work (Etholys Tools — NÃO é o produto FORGE).
# Migração ADDITIVE TaskGroup + rebuild da app web Contabo (app.etholys.com).
# Uso no servidor:
#   bash /opt/etholys/scripts/apply-work-deploy.sh
set -eu
ROOT="${ETHOLYS_ROOT:-/opt/etholys}"
cd "$ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
if [ -f "$ROOT/infra/docker-compose.prod-nginx.yml" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q etholys-nginx; then
  COMPOSE_FILE="docker-compose.prod-nginx.yml"
fi

echo "==> $(date -u) Etholys Work deploy (safe / additive)"

echo "==> Git pull"
git fetch origin
git reset --hard origin/main
echo "HEAD $(git rev-parse --short HEAD)"

echo "==> Prisma TaskGroup + approvals (CREATE IF NOT EXISTS — sem perda de dados)"
if [ -f apps/web/prisma/migrations/manual_etholys_work_groups.sql ]; then
  docker compose -f "infra/$COMPOSE_FILE" exec -T postgres \
    psql -U etholys -d etholys < apps/web/prisma/migrations/manual_etholys_work_groups.sql \
    && echo "SQL Work groups ok (ou já aplicado)" || echo "SQL Work groups skip/partial"
fi
if [ -f apps/web/prisma/migrations/manual_etholys_work_approvals.sql ]; then
  docker compose -f "infra/$COMPOSE_FILE" exec -T postgres \
    psql -U etholys -d etholys < apps/web/prisma/migrations/manual_etholys_work_approvals.sql \
    && echo "SQL Work approvals ok (ou já aplicado)" || echo "SQL Work approvals skip/partial"
fi
if [ -f apps/web/prisma/migrations/manual_etholys_work_folders.sql ]; then
  docker compose -f "infra/$COMPOSE_FILE" exec -T postgres \
    psql -U etholys -d etholys < apps/web/prisma/migrations/manual_etholys_work_folders.sql \
    && echo "SQL Work folders ok (ou já aplicado)" || echo "SQL Work folders skip/partial"
fi

echo "==> Rebuild web (pode demorar 10–20 min)"
cd "$ROOT/infra"
export DOCKER_BUILDKIT=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
docker compose -f "$COMPOSE_FILE" build web
docker compose -f "$COMPOSE_FILE" up -d web

echo "==> Health"
for i in $(seq 1 36); do
  if docker exec etholys-web-prod wget -qO- http://127.0.0.1:3000/api/forge/health 2>/dev/null | grep -q '"ok":true'; then
    echo "OK health"
    break
  fi
  sleep 5
done

curl -s -o /dev/null -w "hub_work_http=%{http_code}\n" https://app.etholys.com/hub/work || true
curl -s -o /dev/null -w "app_health_http=%{http_code}\n" https://app.etholys.com/api/forge/health || true
echo DONE
