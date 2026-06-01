#!/bin/bash
# Atualiza código, reconstrói e sobe etholys-web-prod (forge.etholys.com).
# Correr como root na consola Hetzner quando SSH estiver estável.
set -eu

cd /opt/etholys
echo "=== $(date -u) — deploy forge web ==="

echo "=== Parar builds antigos ==="
pkill -f "docker-buildx" 2>/dev/null || true
pkill -f "buildkit" 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

echo "=== Código ==="
git fetch origin
git reset --hard origin/main
echo "HEAD $(git rev-parse --short HEAD)"

echo "=== Build web (pode demorar 10–20 min; VPS precisa de RAM livre) ==="
cd /opt/etholys/infra
export DOCKER_BUILDKIT=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
docker compose -f docker-compose.prod-nginx.yml build web

echo "=== Subir web ==="
docker compose -f docker-compose.prod-nginx.yml up -d web

echo "=== Health ==="
for i in $(seq 1 36); do
  if curl -sf -m 3 -o /dev/null http://127.0.0.1:3001/api/forge/health 2>/dev/null; then
    echo "OK health"
    curl -s -m 5 -o /dev/null -w "forge root: %{http_code}\n" http://127.0.0.1:3001/ || true
    exit 0
  fi
  sleep 5
done

echo "Health falhou — ver logs: docker logs etholys-web-prod --tail 50"
exit 1
