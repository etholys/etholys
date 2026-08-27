#!/bin/bash
set -euo pipefail
cd /opt/etholys
git fetch origin
git reset --hard origin/main
echo "HEAD $(git rev-parse --short HEAD)"

bash /opt/etholys/scripts/_apply-billing-commerce-prod.sh

export DATABASE_URL="$(docker exec etholys-web-prod printenv DATABASE_URL)"
cd /opt/etholys/apps/web
if command -v npx >/dev/null 2>&1; then
  npx tsx --require dotenv/config scripts/seed-billing.ts
else
  docker cp apps/web/scripts/seed-billing.ts etholys-web-prod:/tmp/seed-billing.ts
  docker cp apps/web/lib/billing etholys-web-prod:/tmp/billing-lib
  docker cp apps/web/lib/sandbox etholys-web-prod:/tmp/sandbox-lib
  docker exec -e DATABASE_URL="$DATABASE_URL" -w /app etholys-web-prod \
    npx tsx /tmp/seed-billing.ts
fi

echo "=== Verify sandbox subscription ==="
docker exec etholys-postgres-prod psql -U etholys -d etholys -c \
  "SELECT c.\"shortName\", s.status, p.code, s.\"trialEndsAt\"::date
   FROM \"CompanySubscription\" s
   JOIN \"Company\" c ON c.id = s.\"companyId\"
   LEFT JOIN \"BillingPlan\" p ON p.id = s.\"planId\"
   WHERE c.\"shortName\" = 'SANDBOX'
   ORDER BY s.\"updatedAt\" DESC LIMIT 3;"
