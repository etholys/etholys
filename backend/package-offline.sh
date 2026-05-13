#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

mkdir -p dist
STAMP="$(date +%Y%m%d-%H%M%S)"
BUNDLE_ROOT="dist/etholys-api-offline-${STAMP}"
mkdir -p "${BUNDLE_ROOT}"

items=(
  Dockerfile
  docker-compose.yml
  .env.example
  requirements.txt
  main.py
  db.py
  config.py
  security.py
  migrations_runner.py
  README.md
  API_PRODUCT.md
  RELEASE_CHECKLIST.md
  smoke_test.py
  preflight_check.py
  install-docker.ps1
  install-docker.sh
  upgrade-docker.ps1
  upgrade-docker.sh
  routers
  services
  static
  migrations
)

for item in "${items[@]}"; do
  if [[ -e "${item}" ]]; then
    cp -R "${item}" "${BUNDLE_ROOT}/"
  fi
done

ARCHIVE="${BUNDLE_ROOT}.tar.gz"
tar -czf "${ARCHIVE}" -C "dist" "$(basename "${BUNDLE_ROOT}")"
HASH_FILE="${ARCHIVE}.sha256"
sha256sum "${ARCHIVE}" > "${HASH_FILE}"
echo "Pacote offline criado: ${ARCHIVE}"
echo "Checksum SHA256: ${HASH_FILE}"
