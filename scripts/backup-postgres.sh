#!/usr/bin/env bash
# Backup Postgres no contentor etholys-postgres. Executar na raiz do repo:
#   bash scripts/backup-postgres.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
if ! docker ps --format '{{.Names}}' | grep -q '^etholys-postgres$'; then
  echo "etholys-postgres não está a correr." >&2
  exit 1
fi
OUT="$ROOT/backups/etholys-$(date +%Y%m%d-%H%M%S).sql"
echo "Dump -> $OUT"
docker exec etholys-postgres pg_dump -U etholys etholys --no-owner > "$OUT"
if [[ ! -s "$OUT" ]]; then
  echo "Dump vazio ou falhou." >&2
  exit 1
fi
echo "OK ($(du -h "$OUT" | cut -f1)). Copie para outro disco ou nuvem."
