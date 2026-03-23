#!/usr/bin/env zsh
set -euo pipefail

PORT="${1:-${PORT:-8090}}"

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required but not installed."
  exit 1
fi

LISTENING_PIDS=(${(f)"$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"})
if (( ${#LISTENING_PIDS[@]} == 0 )); then
  echo "No process found on port $PORT"
  exit 0
fi

PB_PIDS=()
for PID in "${LISTENING_PIDS[@]}"; do
  CMD=$(ps -p "$PID" -o comm= 2>/dev/null || true)
  if [[ "$CMD" == *pocketbase* ]]; then
    PB_PIDS+=("$PID")
  fi
done

if (( ${#PB_PIDS[@]} == 0 )); then
  echo "Port $PORT is in use, but not by PocketBase. Nothing was stopped."
  exit 1
fi

echo "Stopping PocketBase on port $PORT (PID(s): ${PB_PIDS[*]})..."
for PID in "${PB_PIDS[@]}"; do
  kill -TERM "$PID" 2>/dev/null || true
done

for _ in {1..20}; do
  STILL_RUNNING=0
  for PID in "${PB_PIDS[@]}"; do
    if kill -0 "$PID" 2>/dev/null; then
      STILL_RUNNING=1
      break
    fi
  done
  (( STILL_RUNNING == 0 )) && break
  sleep 0.2
done

FORCE_KILLED=()
for PID in "${PB_PIDS[@]}"; do
  if kill -0 "$PID" 2>/dev/null; then
    kill -KILL "$PID" 2>/dev/null || true
    FORCE_KILLED+=("$PID")
  fi
done

if (( ${#FORCE_KILLED[@]} > 0 )); then
  echo "Force-stopped PocketBase PID(s): ${FORCE_KILLED[*]}"
else
  echo "PocketBase stopped successfully on port $PORT"
fi
