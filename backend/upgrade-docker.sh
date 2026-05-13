#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ".env criado a partir de .env.example"
fi

python preflight_check.py docker

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="backups/api-upgrade-${STAMP}.sql"

echo "[upgrade] backup do banco em ${BACKUP_FILE}"
docker compose exec -T postgres pg_dump -U etholys etholys --no-owner > "${BACKUP_FILE}"
if [[ ! -s "${BACKUP_FILE}" ]]; then
  echo "Backup vazio ou falhou" >&2
  exit 1
fi

echo "[upgrade] rebuild e restart"
docker compose up -d --build

ADMIN_TOKEN="$(grep -E '^API_ADMIN_TOKEN=' .env | head -n1 | cut -d'=' -f2- || true)"

echo "[upgrade] smoke test"
ETHOLYS_API_URL="http://127.0.0.1:8000" API_ADMIN_TOKEN="${ADMIN_TOKEN}" python smoke_test.py

echo "[upgrade] concluido com sucesso"
