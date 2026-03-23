#!/usr/bin/env zsh
set -euo pipefail

PORT="8090"
PID=$(lsof -ti tcp:"$PORT" || true)

LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || true)
  if [[ -z "$LAN_IP" ]]; then
    LAN_IP=$(ipconfig getifaddr en1 2>/dev/null || true)
  fi
fi

if [[ -n "$PID" ]]; then
  echo "PocketBase status: RUNNING"
  echo "PID: $PID"
  echo "Local health: http://127.0.0.1:$PORT/api/health"
  if [[ -n "$LAN_IP" ]]; then
    echo "LAN URL: http://$LAN_IP:$PORT"
  else
    echo "LAN URL: (could not detect en0/en1 IP)"
  fi
  exit 0
fi

echo "PocketBase status: STOPPED"
echo "No process is listening on port $PORT"
if [[ -n "$LAN_IP" ]]; then
  echo "Expected LAN URL after start: http://$LAN_IP:$PORT"
fi
exit 1

