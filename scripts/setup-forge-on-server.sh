#!/bin/bash
# Instala/atualiza FORGE (La Expedición) no servidor com Nginx existente.
# Uso (como root): bash /opt/etholys/scripts/setup-forge-on-server.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/etholys}"
DOMAIN="${APP_DOMAIN:-forge.etholys.com}"
COMPOSE_FILE="docker-compose.prod-nginx.yml"

echo "=== FORGE — setup em $(hostname) ==="

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root (ssh root@servidor)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "A instalar Docker..."
  curl -fsSL https://get.docker.com | sh
  apt-get install -y docker-compose-plugin git
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "A clonar repositório..."
  git clone https://github.com/etholys/etholys.git "$REPO_DIR"
fi

cd "$REPO_DIR"
git pull origin main

if [ ! -f "$REPO_DIR/infra/.env" ]; then
  echo "ERRO: Crie $REPO_DIR/infra/.env (copie de infra/.env.production.example)"
  exit 1
fi

if [ ! -f "$REPO_DIR/apps/web/.env" ]; then
  echo "ERRO: Crie $REPO_DIR/apps/web/.env com NEXTAUTH_URL e NEXTAUTH_SECRET"
  exit 1
fi

# Garantir NEXTAUTH_URL alinhado ao domínio
if ! grep -q "NEXTAUTH_URL=https://$DOMAIN" "$REPO_DIR/apps/web/.env" 2>/dev/null; then
  echo "AVISO: Confirme NEXTAUTH_URL=https://$DOMAIN em apps/web/.env"
fi

cd "$REPO_DIR/infra"
echo "=== Docker build + start (porta interna 3001) ==="
docker compose -f "$COMPOSE_FILE" up -d --build

echo "=== A aguardar health ==="
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:3001/api/forge/health" | grep -q '"ok":true'; then
    echo "OK: app responde em 127.0.0.1:3001"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERRO: health não respondeu. Ver: docker compose -f $COMPOSE_FILE logs web --tail 40"
    exit 1
  fi
  sleep 3
done

echo "=== Nginx — $DOMAIN ==="
cp "$REPO_DIR/infra/nginx-forge.etholys.com.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t
systemctl reload nginx

if command -v certbot >/dev/null 2>&1; then
  echo "=== Certificado SSL (certbot) ==="
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "${CERTBOT_EMAIL:-admin@etholys.com}" || true
fi

echo "=== Seed La Expedición (se titular existir na BD) ==="
docker compose -f "$COMPOSE_FILE" exec -T web \
  npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts || echo "(seed opcional falhou — pode já existir curso)"

echo ""
echo "============================================"
echo " CONCLUÍDO"
echo " Alunos:  https://$DOMAIN/expedicion"
echo " Health:  https://$DOMAIN/api/forge/health"
echo " Facilitador: login → FORGE → Alumnos (convites)"
echo " Salón:   /hub/forge/cursos/ID/salon"
echo "============================================"
docker compose -f "$COMPOSE_FILE" ps
