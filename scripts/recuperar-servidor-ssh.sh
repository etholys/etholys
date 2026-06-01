#!/bin/bash
# Cole na CONSOLA WEB da Hetzner (quando SSH do PC da timeout).
# Libera RAM, reinicia SSH e opcionalmente o web sem rebuild.
set -eu

echo "=== $(date -u) recuperar SSH + forge ==="
echo "load: $(cat /proc/loadavg)"
free -h || true

if [ -x /opt/etholys/scripts/recuperar-servidor-oom.sh ]; then
  exec bash /opt/etholys/scripts/recuperar-servidor-oom.sh
fi

echo "=== Parar builds Docker (liberar RAM) ==="
pkill -f docker-buildx 2>/dev/null || true
pkill -f buildkit 2>/dev/null || true
docker builder prune -f 2>/dev/null || true

echo "=== Reiniciar SSH ==="
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null || true

if [ -d /opt/etholys ]; then
  echo "=== Codigo atual ==="
  cd /opt/etholys
  git fetch origin 2>/dev/null || true
  git reset --hard origin/main 2>/dev/null || true
  git rev-parse --short HEAD 2>/dev/null || true
  echo "=== Web rapido (sem rebuild) ==="
  bash /opt/etholys/scripts/restore-forge-web.sh || true
else
  echo "Repo /opt/etholys nao encontrado."
fi

echo "=== Fim. Teste no PC: ssh root@$(hostname -I | awk '{print $1}') echo ok ==="
