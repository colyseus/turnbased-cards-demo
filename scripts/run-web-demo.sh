#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$SERVER_DIR"
npm run dev > /tmp/uno-server.log 2>&1 &
SERVER_PID=$!

printf "Waiting for server on http://localhost:2567 ...\n"
for _ in {1..30}; do
  if curl -fsS http://localhost:2567 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://localhost:2567 >/dev/null 2>&1; then
  echo "Server failed to start. Logs:"
  cat /tmp/uno-server.log
  exit 1
fi

echo "Server is up. Starting React client..."
cd "$CLIENT_DIR"
exec npm run dev
