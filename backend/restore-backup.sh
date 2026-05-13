#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ $# -lt 1 ]]; then
  echo "Uso: ./restore-backup.sh <backup.sql>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup não encontrado: $BACKUP_FILE" >&2
  exit 1
fi

if ! docker compose ps --services --filter status=running | grep -q '^postgres$'; then
  echo "Serviço postgres não está em execução. Rode: docker compose up -d postgres" >&2
  exit 1
fi

echo "[restore] restaurando backup: $BACKUP_FILE"
docker compose exec -T postgres psql -U etholys -d etholys < "$BACKUP_FILE"
echo "[restore] concluído"
