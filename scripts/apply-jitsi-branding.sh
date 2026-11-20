#!/bin/bash
# Aplica branding Etholys Meet no Jitsi web (sem rebuild completo).
# Uso: bash /opt/etholys/scripts/apply-jitsi-branding.sh
set -eu

CFG_WEB="${JITSI_CFG_WEB:-/root/.jitsi-meet-cfg/web}"
ETHOLYS_ROOT="${ETHOLYS_ROOT:-/opt/etholys}"
JITSI_DIR="${JITSI_DIR:-/opt/jitsi-docker}"
BRAND_DIR="${ETHOLYS_JITSI_BRANDING:-$ETHOLYS_ROOT/infra/jitsi}"

mkdir -p "$CFG_WEB"
cp -f "$BRAND_DIR/custom-config.js" "$CFG_WEB/custom-config.js"
cp -f "$BRAND_DIR/custom-interface_config.js" "$CFG_WEB/custom-interface_config.js"
chown -R 1000:1000 /root/.jitsi-meet-cfg || true

# Overlay compose para title.html + manifest (FS do contentor é read-only)
cp -f "$BRAND_DIR/docker-compose.etholys.yml" "$JITSI_DIR/docker-compose.etholys.yml"

cd "$JITSI_DIR"
# --force-recreate: /run/web/config/config.js é gerado no arranque a partir de
# custom-config.js; sem recreate o ficheiro em /config actualiza mas o config.js
# servido fica stale (ex.: unlockRemoteMedia antigo).
ETHOLYS_JITSI_BRANDING="$BRAND_DIR" docker compose \
  -f docker-compose.yml \
  -f docker-compose.etholys.yml \
  up -d --force-recreate web

sleep 8

echo "==> Verify"
curl -s https://meet.etholys.com/ | grep -iE '<title>|og:title|itemprop="name"' | head -10 || true
curl -s https://meet.etholys.com/manifest.json | head -20 || true
curl -s https://meet.etholys.com/interface_config.js | grep -E "APP_NAME|MOBILE_APP_PROMO|PROVIDER_NAME" | tail -15 || true
curl -s https://meet.etholys.com/config.js | grep -E "disabledSounds|unlockRemoteMedia|OUTGOING_CALL_RINGING" | head -20 || true
echo DONE
