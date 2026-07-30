#!/bin/bash
# Deploy Etholys Studio (ferramenta transversal) — migração ADDITIVE (não apaga dados).
# Uso no servidor:
#   bash /opt/etholys/scripts/apply-studio-deploy.sh
set -eu
ROOT="${ETHOLYS_ROOT:-/opt/etholys}"
cd "$ROOT"

echo "==> $(date -u) Studio deploy (safe / additive)"

echo "==> Git pull"
git fetch origin
git reset --hard origin/main

echo "==> Prisma Studio tables (CREATE IF NOT EXISTS — sem perda de dados)"
if [ -f apps/web/prisma/migrations/manual_etholys_studio.sql ]; then
  docker compose -f infra/docker-compose.prod.yml exec -T postgres \
    psql -U etholys -d etholys < apps/web/prisma/migrations/manual_etholys_studio.sql \
    && echo "SQL Studio ok (ou já aplicado)" || echo "SQL Studio skip/partial — ok se tabelas já existem"
fi

echo "==> Rebuild web (pode demorar)"
cd "$ROOT/infra"
docker compose -f docker-compose.prod.yml up -d --build web

echo "==> Health"
sleep 25
curl -sI https://app.etholys.com/hub/studio | head -8 || true
curl -s -o /dev/null -w "studio_http=%{http_code}\n" https://app.etholys.com/hub/studio || true
echo DONE
