#!/bin/bash
set -euo pipefail
cd /opt/etholys

echo "=== Apply invite wizard columns (idempotent) ==="
docker exec -i etholys-postgres-prod psql -U etholys -d etholys <<'SQL'
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "inviteKind" TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "accessUntil" TIMESTAMP(3);
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "companySiepPermissions" JSONB;
ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "inviteKind" TEXT;
ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "accessUntil" TIMESTAMP(3);
SQL

echo "=== Seed sandbox (via host node if available, else container) ==="
export SANDBOX_PASSWORD="${SANDBOX_PASSWORD:-EtholysSandbox2026!}"

if [ -f /opt/etholys/apps/web/scripts/seed-internal-sandbox.ts ]; then
  cd /opt/etholys/apps/web
  if command -v npx >/dev/null 2>&1; then
    # Use prod DATABASE_URL from container env
    export DATABASE_URL="$(docker exec etholys-web-prod printenv DATABASE_URL)"
    npx tsx --require dotenv/config scripts/seed-internal-sandbox.ts
  else
    docker cp scripts/seed-internal-sandbox.ts etholys-web-prod:/tmp/seed-internal-sandbox.ts
    docker cp lib/sandbox etholys-web-prod:/tmp/sandbox-lib
    echo "Fallback: run inside container with mounted code — using docker exec node"
    docker exec -e SANDBOX_PASSWORD="$SANDBOX_PASSWORD" -w /app etholys-web-prod \
      npx tsx /tmp/seed-internal-sandbox.ts || true
  fi
else
  echo "MISSING seed-internal-sandbox.ts — copy files first"
  exit 1
fi
