#!/bin/bash
set -e
cd /opt/etholys
tar -xzf etholys-deploy.tgz
if [ -f .env.web.local ]; then mv -f .env.web.local apps/web/.env; fi
PG_PASS="$1"
NA_SECRET="$2"
DOMAIN="${3:-app.etholys.com}"
cat > infra/.env <<EOF
APP_DOMAIN=${DOMAIN}
POSTGRES_USER=etholys
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=etholys
EOF
sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://${DOMAIN}|" apps/web/.env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://etholys:${PG_PASS}@postgres:5432/etholys|" apps/web/.env
if grep -q '^NEXTAUTH_SECRET=' apps/web/.env; then
  sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NA_SECRET}|" apps/web/.env
else
  echo "NEXTAUTH_SECRET=${NA_SECRET}" >> apps/web/.env
fi
echo DEPLOY_PREP_OK
