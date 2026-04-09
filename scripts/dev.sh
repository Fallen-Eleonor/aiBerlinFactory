#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

require_backend() {
  if [[ ! -x "$BACKEND_DIR/.venv/bin/python" ]]; then
    cat <<EOF
Missing backend virtualenv at:
  $BACKEND_DIR/.venv

Create it with:
  cd $BACKEND_DIR
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -e .[dev]
EOF
    exit 1
  fi

  if ! "$BACKEND_DIR/.venv/bin/python" -c "import uvicorn" >/dev/null 2>&1; then
    cat <<EOF
Backend dependency 'uvicorn' is not installed in:
  $BACKEND_DIR/.venv

Install backend dependencies with:
  cd $BACKEND_DIR
  source .venv/bin/activate
  pip install -e .[dev]
EOF
    exit 1
  fi
}

require_frontend() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    cat <<EOF
Missing frontend dependencies at:
  $FRONTEND_DIR/node_modules

Install them with:
  cd $FRONTEND_DIR
  npm install
EOF
    exit 1
  fi
}

require_free_port() {
  local port="$1"
  local name="$2"

  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    cat <<EOF
$name port $port is already in use.

Stop the existing process or choose a different port:
  BACKEND_PORT=8010 FRONTEND_PORT=3010 npm run dev
EOF
    exit 1
  fi
}

require_frontend_workspace_free() {
  local lock_file="$FRONTEND_DIR/.next/dev/lock"

  if [[ ! -f "$lock_file" ]]; then
    return
  fi

  local pid=""
  local port=""

  pid="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1])).get("pid", ""))' "$lock_file" 2>/dev/null || true)"
  port="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1])).get("port", ""))' "$lock_file" 2>/dev/null || true)"

  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    cat <<EOF
Frontend workspace is already running in another Next.js dev process.

Existing process:
  PID: $pid
  Port: ${port:-unknown}

Stop that process first, or reuse the existing frontend server.
EOF
    exit 1
  fi
}

trap cleanup EXIT INT TERM

require_backend
require_frontend
require_free_port "$BACKEND_PORT" "Backend"
require_free_port "$FRONTEND_PORT" "Frontend"
require_frontend_workspace_free

echo "Starting backend on http://localhost:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  exec .venv/bin/python -m uvicorn app.main:app --reload --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

wait -n "$BACKEND_PID" "$FRONTEND_PID"
