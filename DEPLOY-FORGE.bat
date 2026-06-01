@echo off
chcp 65001 >nul
setlocal
title ETHOLYS — Deploy FORGE (git + servidor)
cd /d "%~dp0"

if not exist "%~dp0scripts\deploy-forge-from-windows.ps1" (
  echo [Erro] Script nao encontrado em scripts\deploy-forge-from-windows.ps1
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-forge-from-windows.ps1"
set "EC=%ERRORLEVEL%"
echo.
if %EC% neq 0 (
  echo Falhou com codigo %EC%.
) else (
  echo Tudo OK.
)
pause
exit /b %EC%
