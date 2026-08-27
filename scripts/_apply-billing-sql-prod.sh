#!/bin/bash
set -euo pipefail
SQL=/opt/etholys/apps/web/prisma/migrations/manual_billing_foundation.sql
if [ ! -f "$SQL" ]; then
  echo "Missing $SQL — git pull first"
  exit 1
fi
echo "Applying $SQL"
docker exec -i etholys-postgres-prod psql -U etholys -d etholys -v ON_ERROR_STOP=1 < "$SQL"
echo "--- billing tables ---"
docker exec -i etholys-postgres-prod psql -U etholys -d etholys -c \
  "SELECT tablename FROM pg_tables WHERE tablename IN ('BillingPlan','CompanyBillingAccount','CompanySubscription') ORDER BY 1;"
echo DONE
