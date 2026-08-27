#!/bin/bash
set -eu
cd /opt/etholys
echo "=== $(date -u) NEXUS incubation + AT sector deploy ==="
echo "HEAD before: $(git rev-parse --short HEAD)"
git fetch origin
git reset --hard origin/main
echo "HEAD after: $(git rev-parse --short HEAD)"

for SQL in \
  apps/web/prisma/migrations/manual_nexus_at_sponsor.sql \
  apps/web/prisma/migrations/manual_nexus_at_sector.sql; do
  if [ -f "$SQL" ]; then
    echo "=== SQL $SQL ==="
    docker exec -i etholys-postgres-prod psql -U etholys -d etholys < "$SQL"
  fi
done

echo "=== NexusAt columns ==="
docker exec -i etholys-postgres-prod psql -U etholys -d etholys -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='NexusAtEngagement' AND column_name IN ('sponsorCompanyId','primarySectorId') ORDER BY 1;"

echo "=== web-only rebuild ==="
nohup bash /opt/etholys/scripts/deploy-forge-web.sh > /tmp/nexus-incubation-deploy.log 2>&1 &
echo "PID $!"
echo "LOG /tmp/nexus-incubation-deploy.log"
