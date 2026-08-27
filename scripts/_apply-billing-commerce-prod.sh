#!/bin/bash
set -euo pipefail
SQL=/opt/etholys/apps/web/prisma/migrations/manual_billing_commerce.sql
if [ ! -f "$SQL" ]; then
  echo "Missing $SQL"
  exit 1
fi
echo "Applying $SQL"
docker exec -i etholys-postgres-prod psql -U etholys -d etholys -v ON_ERROR_STOP=1 < "$SQL"
echo "--- commerce tables ---"
docker exec etholys-postgres-prod psql -U etholys -d etholys -tAc \
  "SELECT tablename FROM pg_tables WHERE tablename IN ('CompanyEntitlement','PlatformInvoice','BillingCommissionEvent') ORDER BY 1;"
echo DONE
