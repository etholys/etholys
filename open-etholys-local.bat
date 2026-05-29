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

set "DOCKER=docker"
where docker >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "DOCKER=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
  ) else (
    echo [Erro] Docker nao esta no PATH. Instale o Docker Desktop.
    pause
    exit /b 1
  )
)

cd /d "%INFRA%"

call "%ROOT%scripts\wait-docker-daemon.bat" "%DOCKER%"
if errorlevel 1 (
  pause
  exit /b 1
)

echo === A subir Postgres, API e Next.js (docker compose up -d) ===
echo A PRIMEIRA VEZ pode demorar varios minutos (npm install dentro do contentor).
echo.
"%DOCKER%" compose up -d
if errorlevel 1 (
  echo.
  echo [Erro] docker compose falhou. Veja a mensagem acima.
  echo Se so precisa de desenvolver FORGE/Next: experimente open-etholys-dev-local.bat
  pause
  exit /b 1
)

echo.
echo === Estado dos contentores ===
"%DOCKER%" compose ps
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
