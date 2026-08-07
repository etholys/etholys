#!/bin/bash
# Deploy Etholys Meet (+ branding Jitsi) para Contabo.
# Uso no servidor após receber o tarball:
#   bash /opt/etholys/scripts/apply-meet-deploy.sh
set -eu
ROOT="${ETHOLYS_ROOT:-/opt/etholys}"
cd "$ROOT"

echo "==> Prisma Meet tables"
if [ -f apps/web/prisma/migrations/manual_etholys_meet.sql ]; then
  docker compose -f infra/docker-compose.prod.yml exec -T postgres \
    psql -U etholys -d etholys < apps/web/prisma/migrations/manual_etholys_meet.sql \
    && echo "SQL ok (ou já aplicado)" || echo "SQL skip/partial — ok se tabelas já existem"
fi

echo "==> JITSI_BASE_URL"
ENVF=apps/web/.env
touch "$ENVF"
grep -q '^JITSI_BASE_URL=' "$ENVF" \
  && sed -i 's|^JITSI_BASE_URL=.*|JITSI_BASE_URL=https://meet.etholys.com|' "$ENVF" \
  || echo 'JITSI_BASE_URL=https://meet.etholys.com' >> "$ENVF"
grep -q '^NEXT_PUBLIC_JITSI_BASE_URL=' "$ENVF" \
  && sed -i 's|^NEXT_PUBLIC_JITSI_BASE_URL=.*|NEXT_PUBLIC_JITSI_BASE_URL=https://meet.etholys.com|' "$ENVF" \
  || echo 'NEXT_PUBLIC_JITSI_BASE_URL=https://meet.etholys.com' >> "$ENVF"

echo "==> Branding Etholys Meet (Jitsi web)"
bash "$ROOT/scripts/apply-jitsi-branding.sh" || {
  mkdir -p /root/.jitsi-meet-cfg/web
  cp -f infra/jitsi/custom-config.js /root/.jitsi-meet-cfg/web/custom-config.js
  cp -f infra/jitsi/custom-interface_config.js /root/.jitsi-meet-cfg/web/custom-interface_config.js
  cp -f infra/jitsi/custom-meet.css /root/.jitsi-meet-cfg/web/custom-meet.css
  chown -R 1000:1000 /root/.jitsi-meet-cfg
  cd /opt/jitsi-docker && docker compose restart web || true
}

echo "==> Rebuild app web (pode demorar)"
cd "$ROOT/infra"
docker compose -f docker-compose.prod.yml up -d --build web caddy

echo "==> Health"
sleep 20
curl -sI https://app.etholys.com/hub/meet | head -8 || true
curl -s https://app.etholys.com/api/meet/status || true
echo
echo DONE
