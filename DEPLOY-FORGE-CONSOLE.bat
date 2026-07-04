@echo off
chcp 65001 >nul
title Deploy FORGE via consola Contabo
echo.
echo  SSH do PC nao alcanca o servidor.
echo  Use SSH ou consola do painel Contabo:
echo.
echo  1) https://my.contabo.com -^> VPS -^> Console / VNC
echo  2) IP exemplo: 84.247.187.155
echo  3) Cole:
echo.
echo     bash /opt/etholys/scripts/deploy-forge-web.sh
echo.
echo  Se OOM no build: ver scripts/recuperar-servidor-oom.sh
echo.
echo  Guia: docs\DEPLOY-CONTABO-CLOUDFLARE.md
echo.
start "" "https://my.contabo.com"
pause
