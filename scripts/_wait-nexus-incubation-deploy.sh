#!/bin/bash
set -eu
LOG=/tmp/nexus-incubation-deploy.log
for i in $(seq 1 80); do
  if grep -q "OK health" "$LOG" 2>/dev/null; then
    echo READY
    tail -25 "$LOG"
    docker ps --filter name=etholys-web-prod --format '{{.Names}} {{.Status}}'
    cd /opt/etholys && git rev-parse --short HEAD
    docker exec etholys-web-prod wget -qO- http://127.0.0.1:3000/api/nexus/at/sectors 2>/dev/null | head -c 120 || true
    echo
    exit 0
  fi
  if grep -Eiq 'Health falhou|failed to solve|npm ERR' "$LOG" 2>/dev/null; then
    echo FAIL
    tail -50 "$LOG"
    exit 1
  fi
  if ! pgrep -f 'deploy-forge-web.sh' >/dev/null 2>&1; then
    if grep -q "OK health" "$LOG" 2>/dev/null; then
      echo READY
      tail -25 "$LOG"
      exit 0
    fi
    echo ENDED_WITHOUT_OK
    tail -50 "$LOG"
    exit 1
  fi
  echo "wait $i $(date -u +%H:%M:%S)"
  sleep 30
done
echo TIMEOUT
tail -50 "$LOG"
exit 1
