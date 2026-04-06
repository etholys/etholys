@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  echo Criando .env a partir de .env.example ...
  copy /Y .env.example .env
)
echo Frontend Next.js: http://localhost:3000  (Hub / ATLAS / SIEP)
echo API FastAPI:      http://localhost:8000/docs  |  Chat IA: http://localhost:8000/ui
echo Subindo Postgres + web + api (hot reload)
docker compose -f infra/docker-compose.yml up --build
