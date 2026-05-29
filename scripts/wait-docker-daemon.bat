@echo off
setlocal
set "DOCKER=%~1"
if "%DOCKER%"=="" set "DOCKER=docker"

"%DOCKER%" info >nul 2>&1
if not errorlevel 1 exit /b 0

echo O motor Docker nao esta a correr.
set "DD=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%DD%" (
  echo A iniciar Docker Desktop — aguarde o icone ficar verde ^(Running^)...
  start "" "%DD%"
) else (
  echo Abra manualmente o Docker Desktop e espere ficar "Running".
)

set /a N=0
:wait_loop
"%DOCKER%" info >nul 2>&1
if not errorlevel 1 (
  echo Docker pronto.
  exit /b 0
)
set /a N+=1
if %N% geq 90 (
  echo.
  echo [Erro] Docker nao respondeu em ~3 minutos.
  echo   1^) Abra Docker Desktop e confirme "Engine running"
  echo   2^) Reinicie o PC se o erro persistir
  echo   3^) Alternativa: use open-etholys-dev-local.bat ^(Postgres no Docker + Next no Windows^)
  echo      ou instale PostgreSQL nativo na porta 5433
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_loop
