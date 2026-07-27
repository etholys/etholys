#!/bin/bash
set -e
cd /opt/etholys/infra
docker compose -f docker-compose.prod.yml stop web
docker compose -f docker-compose.prod.yml exec -T postgres psql -U etholys -d postgres -c "DROP DATABASE IF EXISTS etholys;"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U etholys -d postgres -c "CREATE DATABASE etholys;"
cat /tmp/etholys-hetzner.dump | docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U etholys -d etholys --no-owner --no-acl
docker compose -f docker-compose.prod.yml up -d web
sleep 12
docker ps --filter name=etholys-web --format '{{.Status}}'
docker compose -f docker-compose.prod.yml exec -T postgres psql -U etholys -d etholys -c 'SELECT count(*) FROM "User";'
