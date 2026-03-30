#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PB_DIR="$SCRIPT_DIR"
PB_BIN="$PB_DIR/pocketbase"
PORT="${1:-${PORT:-8090}}"

cd "$PB_DIR"

if [[ ! -f "$PB_BIN" ]]; then
  echo "PocketBase binary not found at: $PB_BIN"
  exit 1
fi

if [[ ! -x "$PB_BIN" ]]; then
  chmod +x "$PB_BIN"
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required but not installed."
  exit 1
fi

# Stop only PocketBase processes on the selected port.
LISTENING_PIDS=(${(f)"$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"})
if (( ${#LISTENING_PIDS[@]} > 0 )); then
  PB_PIDS=()
  for PID in "${LISTENING_PIDS[@]}"; do
    CMD=$(ps -p "$PID" -o comm= 2>/dev/null || true)
    if [[ "$CMD" == *pocketbase* ]]; then
      PB_PIDS+=("$PID")
    fi
  done

  if (( ${#PB_PIDS[@]} == 0 )); then
    echo "Port $PORT is in use, but not by PocketBase. Refusing to stop other services."
    exit 1
  fi

  echo "Stopping existing PocketBase process(es) on port $PORT: ${PB_PIDS[*]}"
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

  for PID in "${PB_PIDS[@]}"; do
    if kill -0 "$PID" 2>/dev/null; then
      kill -KILL "$PID" 2>/dev/null || true
    fi
  done
fi

echo "Starting PocketBase on 0.0.0.0:$PORT ..."
exec "$PB_BIN" serve --http="0.0.0.0:$PORT"
