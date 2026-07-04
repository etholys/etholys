#!/bin/bash
set -e
cd /opt/etholys/infra
docker compose -f docker-compose.prod.yml stop web caddy || true
docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint sh web -c "npx prisma db push --accept-data-loss && npx prisma generate"
docker compose -f docker-compose.prod.yml run --rm --no-deps --entrypoint sh web -c '
  for d in /app/prisma/migrations/*/; do
    name=$(basename "$d")
    npx prisma migrate resolve --applied "$name" || true
  done
'
# Manual SIEP migrations
for sql in manual_task_activity_reports.sql manual_siep_informe_editor.sql manual_me_report_packages.sql manual_project_report_guide.sql manual_budget_unit_type_and_report_domains.sql; do
  docker exec -i etholys-postgres-prod psql -U etholys -d etholys < /opt/etholys/apps/web/prisma/migrations/$sql || true
done
docker compose -f docker-compose.prod.yml up -d web caddy
sleep 15
docker ps --format "table {{.Names}}\t{{.Status}}"
docker logs etholys-web-prod --tail 8 2>&1
