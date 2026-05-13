#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ".env criado a partir de .env.example"
fi

python preflight_check.py docker

docker compose up -d --build
echo "Etholys API iniciada em http://localhost:8000"
