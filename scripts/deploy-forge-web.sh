#!/bin/bash
# Atualiza código, reconstrói e sobe etholys-web-prod (forge.etholys.com).
# Contabo: docker-compose.prod.yml (Caddy). Alternativa nginx: docker-compose.prod-nginx.yml
set -eu

cd /opt/etholys
echo "=== $(date -u) — deploy forge web ==="

COMPOSE_FILE="docker-compose.prod.yml"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q etholys-caddy-prod; then
  COMPOSE_FILE="docker-compose.prod.yml"
elif [ -f /opt/etholys/infra/docker-compose.prod-nginx.yml ]; then
  COMPOSE_FILE="docker-compose.prod-nginx.yml"
fi
echo "Compose: $COMPOSE_FILE"

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
docker compose -f "$COMPOSE_FILE" build web

echo "=== Subir web ==="
docker compose -f "$COMPOSE_FILE" up -d web

echo "=== Health ==="
health_ok() {
  curl -sf -m 5 -o /dev/null http://127.0.0.1/api/forge/health 2>/dev/null && return 0
  curl -sf -m 5 -o /dev/null http://127.0.0.1:3001/api/forge/health 2>/dev/null && return 0
  docker exec etholys-web-prod wget -qO- http://127.0.0.1:3000/api/forge/health 2>/dev/null | grep -q '"ok":true'
}

for i in $(seq 1 48); do
  if health_ok; then
    echo "OK health"
    curl -s -m 5 -o /dev/null -w "public /expedicion: checking via container\n" || true
    docker exec etholys-web-prod wget -qO- http://127.0.0.1:3000/expedicion/entrar 2>/dev/null | head -c 80 || true
    echo ""
    exit 0
  fi
  if [ "$((i % 6))" -eq 0 ]; then
    echo "--- aguardando (${i}0s) ---"
    docker logs etholys-web-prod --tail 8 2>&1 || true
  fi
  sleep 5
done

echo "Health falhou — ver logs: docker logs etholys-web-prod --tail 50"
exit 1
