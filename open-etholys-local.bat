@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
set "INFRA=%ROOT%infra"

if not exist "%INFRA%\docker-compose.yml" (
  echo [Erro] docker-compose.yml nao encontrado em:
  echo   %INFRA%
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [Erro] Docker nao esta no PATH. Abra o Docker Desktop e tente de novo.
  pause
  exit /b 1
)

cd /d "%INFRA%"

echo === A subir Postgres, API e Next.js (docker compose up -d) ===
echo A PRIMEIRA VEZ pode demorar varios minutos (npm install dentro do contentor).
echo.
docker compose up -d
if errorlevel 1 (
  echo.
  echo [Erro] docker compose falhou. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo === Estado dos contentores ===
docker compose ps
echo.

echo A aguardar a porta 3000 ficar disponivel (ate ~3 min)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; for($i=0; $i -lt 90; $i++){ try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 3000); $c.Close(); $ok=$true; break } catch { Start-Sleep -Seconds 2 } }; if(-not $ok){ Write-Host 'Porta 3000 ainda nao respondeu — espere mais um pouco e recarregue o browser.' }"

start "" "http://localhost:3000"
echo.
echo Browser: http://localhost:3000
echo Se recusar ligacao: aguarde e recarregue ^(F5^). Logs: docker compose logs -f web
echo.
pause
