#!/usr/bin/env zsh
set -euo pipefail

PB_DIR="/Users/sagar/AIKeeper1/backend/pocketbase"
PB_BIN="$PB_DIR/pocketbase"
PORT="8090"

cd "$PB_DIR"

if [[ ! -f "$PB_BIN" ]]; then
  echo "PocketBase binary not found at: $PB_BIN"
  exit 1
fi

if [[ ! -x "$PB_BIN" ]]; then
  chmod +x "$PB_BIN"
fi

# Stop old process on same port (if any)
EXISTING_PID=$(lsof -ti tcp:"$PORT" || true)
if [[ -n "${EXISTING_PID}" ]]; then
  echo "Stopping existing process on port $PORT (PID: $EXISTING_PID)"
  kill -9 "$EXISTING_PID"
fi

echo "Starting PocketBase on 0.0.0.0:$PORT ..."
exec "$PB_BIN" serve --http="0.0.0.0:$PORT"
