@echo off
chcp 65001 >nul
title Deploy FORGE via consola Hetzner
echo.
echo  SSH do PC nao alcanca o servidor.
echo  Use a CONSOLA WEB da Hetzner:
echo.
echo  1) https://console.hetzner.cloud
echo  2) Servidor 178.105.80.131 -^> Console
echo  3) Cole:
echo.
echo     bash /opt/etholys/scripts/recuperar-servidor-oom.sh
echo.
echo  Se a consola mostrar "Out of memory": Power -^> Reboot primeiro.
echo.
echo  Guia completo: docs\FORGE-DEPLOY-SEM-SSH.md
echo.
start "" "https://console.hetzner.cloud"
pause
