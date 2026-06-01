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

# Jitsi (Java) costuma estar em docker-jitsi-meet — parar para libertar RAM
for c in $(docker ps -q 2>/dev/null); do
  name=$(docker inspect -f '{{.Name}}' "$c" 2>/dev/null || echo '')
  if echo "$name" | grep -qiE 'jitsi|java|prosody|jicofo|jvb'; then
    docker stop "$c" 2>/dev/null || true
  fi
done

echo "=== Reiniciar SSH ==="
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

if [ -d /opt/etholys/infra ]; then
  cd /opt/etholys
  git fetch origin 2>/dev/null || true
  git reset --hard origin/main 2>/dev/null || true
  echo "HEAD $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  cd infra
  echo "=== Subir so Postgres + Web (sem build) ==="
  docker compose -f docker-compose.prod-nginx.yml up -d --no-build postgres web 2>/dev/null || \
    docker compose -f docker-compose.prod-nginx.yml up -d postgres web 2>/dev/null || true
fi

echo "=== Memoria apos recuperacao ==="
free -h
echo "OK. Evite 'docker compose build' neste servidor 4GB."
