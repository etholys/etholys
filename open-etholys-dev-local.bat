@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
set "INFRA=%ROOT%infra"
set "WEB=%ROOT%apps\web"

if not exist "%INFRA%\docker-compose.yml" (
  echo [Erro] docker-compose.yml nao encontrado em: %INFRA%
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
echo === Modo dev local: so Postgres no Docker, Next.js no Windows ===
echo.

call "%~dp0scripts\wait-docker-daemon.bat" "%DOCKER%"
if errorlevel 1 (
  pause
  exit /b 1
)

echo === A subir apenas Postgres (porta 5433) ===
"%DOCKER%" compose up -d postgres
if errorlevel 1 (
  echo [Erro] Nao foi possivel subir o Postgres.
  pause
  exit /b 1
)

echo A aguardar Postgres...
powershell -NoProfile -Command ^
  "$ok=$false; for($i=0;$i -lt 60;$i++){ try{$c=New-Object System.Net.Sockets.TcpClient;$c.Connect('127.0.0.1',5433);$c.Close();$ok=$true;break}catch{Start-Sleep 2}}; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo [Aviso] Porta 5433 ainda nao responde — pode demorar mais um minuto.
)

if not exist "%WEB%\.env" (
  if exist "%WEB%\.env.example" (
    copy /Y "%WEB%\.env.example" "%WEB%\.env" >nul
    echo Criado apps\web\.env a partir de .env.example
  ) else (
    echo [Aviso] Crie apps\web\.env com DATABASE_URL em localhost:5433
  )
)

cd /d "%WEB%"
echo.
echo === Prisma migrate + Next.js (localhost:3000) ===
echo Primeira vez: npm install e migrate podem demorar.
echo.
call npm run dev:clean 2>nul
if errorlevel 1 call npm run dev
if errorlevel 1 (
  echo [Erro] npm run dev falhou. Corra manualmente em apps\web: npm install ^&^& npx prisma migrate deploy ^&^& npm run dev
  pause
  exit /b 1
)
