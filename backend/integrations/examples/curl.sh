#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ETHOLYS_API_URL:-http://127.0.0.1:8000}"
ADMIN_TOKEN="${API_ADMIN_TOKEN:-change-me-admin-token}"

echo "[1/3] Creating API client..."
CREATE_RESP=$(curl -sS -X POST "$BASE_URL/api-product/clients" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Partner Demo","plan":"starter","rpm_limit":60}')

API_KEY=$(python - <<'PY'
import json, sys
print(json.loads(sys.stdin.read())["api_key"])
PY
<<< "$CREATE_RESP")

echo "[2/3] Calling protected endpoint /api-product/me..."
curl -sS "$BASE_URL/api-product/me" -H "X-API-Key: $API_KEY"
echo

echo "[3/3] Sending a chat message..."
curl -sS -X POST "$BASE_URL/ai/chat" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from external system integration test"}'
echo
