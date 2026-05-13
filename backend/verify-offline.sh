#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: ./verify-offline.sh <arquivo> [checksum.sha256]" >&2
  exit 1
fi

ARCHIVE="$1"
CHECKSUM_FILE="${2:-${ARCHIVE}.sha256}"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Arquivo não encontrado: $ARCHIVE" >&2
  exit 1
fi

if [[ ! -f "$CHECKSUM_FILE" ]]; then
  echo "Checksum não encontrado: $CHECKSUM_FILE" >&2
  exit 1
fi

sha256sum -c "$CHECKSUM_FILE"
