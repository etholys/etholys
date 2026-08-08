#!/bin/bash
set -e
cd /opt/etholys
tar -xzf etholys-deploy.tgz
if [ -f .env.web.local ]; then mv -f .env.web.local apps/web/.env; fi
PG_PASS="$1"
NA_SECRET="$2"
DOMAIN="${3:-app.etholys.com}"
MEET_DOMAIN="${4:-meet.etholys.com}"
SITE_DOMAIN="${5:-etholys.com}"
cat > infra/.env <<EOF
SITE_DOMAIN=${SITE_DOMAIN}
APP_DOMAIN=${DOMAIN}
MEET_DOMAIN=${MEET_DOMAIN}
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
# Jitsi self-hosted (só preenche se ainda não existir — setup-jitsi-contabo.sh completa)
if ! grep -q '^JITSI_BASE_URL=' apps/web/.env; then
  echo "JITSI_BASE_URL=https://${MEET_DOMAIN}" >> apps/web/.env
fi
if ! grep -q '^NEXT_PUBLIC_JITSI_BASE_URL=' apps/web/.env; then
  echo "NEXT_PUBLIC_JITSI_BASE_URL=https://${MEET_DOMAIN}" >> apps/web/.env
fi
echo DEPLOY_PREP_OK
