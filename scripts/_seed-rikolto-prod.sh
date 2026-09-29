#!/bin/bash
set -euo pipefail
cd /opt/etholys
git fetch origin
git reset --hard origin/main
echo "HEAD $(git rev-parse --short HEAD)"

export DATABASE_URL="$(docker exec etholys-web-prod printenv DATABASE_URL)"
WEB=/opt/etholys/apps/web
ADMIN_EMAIL="${RIKOLTO_ADMIN_EMAIL:-}"

docker exec etholys-web-prod mkdir -p /app/scripts /app/lib/email /app/lib/billing /app/lib/sandbox
docker cp "$WEB/scripts/seed-rikolto-pilot.ts" etholys-web-prod:/app/scripts/seed-rikolto-pilot.ts
docker exec etholys-web-prod rm -rf /app/lib/billing /app/lib/email
docker cp "$WEB/lib/billing" etholys-web-prod:/app/lib/
docker cp "$WEB/lib/email" etholys-web-prod:/app/lib/
docker cp "$WEB/lib/integrated-workspace-shared.ts" etholys-web-prod:/app/lib/integrated-workspace-shared.ts

ARGS=(scripts/seed-rikolto-pilot.ts)
if [ -n "$ADMIN_EMAIL" ]; then
  ARGS+=(--admin-email "$ADMIN_EMAIL")
fi

docker exec -e DATABASE_URL="$DATABASE_URL" -e NEXTAUTH_URL=https://app.etholys.com -w /app etholys-web-prod \
  npx tsx "${ARGS[@]}"

echo "=== Verify ==="
docker exec etholys-postgres-prod psql -U etholys -d etholys -c \
  "SELECT c.\"shortName\", s.status, p.code, s.\"trialEndsAt\"::date
   FROM \"CompanySubscription\" s
   JOIN \"Company\" c ON c.id = s.\"companyId\"
   LEFT JOIN \"BillingPlan\" p ON p.id = s.\"planId\"
   WHERE c.\"shortName\" = 'RIKOLTO';"

echo DONE
