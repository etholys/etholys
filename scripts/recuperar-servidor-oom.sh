#!/bin/bash
# Recuperacao apos "Out of memory: Killed process" na consola Hetzner.
# NAO executar deploy-forge-web.sh (build) neste VPS 4GB sem swap.
set -eu

echo "=== $(date -u) recuperar OOM ==="
free -h 2>/dev/null || true

echo "=== Swap 4G (se ainda nao existir) ==="
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show || true

echo "=== Parar builds e contentores pesados ==="
pkill -9 -f docker-buildx 2>/dev/null || true
pkill -9 -f buildkit 2>/dev/null || true
docker builder prune -af 2>/dev/null || true

# Motor de vídeo CHORUS (Java) — parar para libertar RAM; voltamos a subir o núcleo abaixo.
for c in $(docker ps -q 2>/dev/null); do
  name=$(docker inspect -f '{{.Name}}' "$c" 2>/dev/null || echo '')
  if echo "$name" | grep -qiE 'jitsi|java|prosody|jicofo|jvb'; then
    docker stop "$c" 2>/dev/null || true
  fi
done

echo "=== Reiniciar SSH ==="
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

if [ -x /opt/etholys/scripts/recuperar-prod-sem-rebuild.sh ]; then
  bash /opt/etholys/scripts/recuperar-prod-sem-rebuild.sh || true
elif [ -d /opt/etholys/infra ]; then
  cd /opt/etholys/infra
  echo "=== Subir Postgres + Web + Caddy (sem build) ==="
  docker compose -f docker-compose.prod.yml up -d --no-build postgres web caddy 2>/dev/null || \
    docker compose -f docker-compose.prod-nginx.yml up -d --no-build postgres web 2>/dev/null || true
fi

# Sem o serviço de focus, TODAS as salas CHORUS ficam em "Entrando…" / timeout.
# Nunca deixar o núcleo de vídeo parado após uma recuperação OOM.
JITSI_DIR="${JITSI_DIR:-/opt/jitsi-docker}"
if [ -f "${JITSI_DIR}/docker-compose.yml" ]; then
  echo "=== Subir núcleo CHORUS (web + prosody + jicofo + jvb) ==="
  (
    cd "${JITSI_DIR}"
    docker compose up -d web prosody jicofo jvb
  ) || true
  sleep 3
  docker ps --filter name=jitsi-docker --format 'table {{.Names}}\t{{.Status}}' || true
  if ! docker ps --format '{{.Names}}' | grep -qx 'jitsi-docker-jicofo-1'; then
    echo "WARN: jitsi-docker-jicofo-1 nao esta a correr — salas CHORUS nao entram."
  fi
fi

echo "=== Memoria apos recuperacao ==="
free -h
echo "OK. Evite 'docker compose build' neste servidor 4GB."
