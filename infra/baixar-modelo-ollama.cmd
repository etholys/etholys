@echo off
cd /d "%~dp0"
echo Baixando modelo no container Ollama (pode demorar)...
docker compose exec ollama ollama pull llama3
echo.
echo Pronto. Se usar outro nome no .env (OLLAMA_MODEL), rode: docker compose exec ollama ollama pull SEU_MODELO
pause
