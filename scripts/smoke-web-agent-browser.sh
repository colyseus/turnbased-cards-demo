#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"
SHOT_DIR="$ROOT_DIR/.tmp-agent-browser"

cleanup() {
  agent-browser close --all >/dev/null 2>&1 || true
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then kill "$CLIENT_PID" 2>/dev/null || true; fi
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

mkdir -p "$SHOT_DIR"

cd "$SERVER_DIR"
npm run dev > /tmp/uno-server.log 2>&1 &
SERVER_PID=$!

cd "$CLIENT_DIR"
npm run dev > /tmp/uno-web.log 2>&1 &
CLIENT_PID=$!

for _ in {1..40}; do
  if curl -fsS http://localhost:2567 >/dev/null 2>&1 && curl -fsS http://localhost:5173 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS http://localhost:2567 >/dev/null
curl -fsS http://localhost:5173 >/dev/null

agent-browser open http://localhost:5173
agent-browser wait --load networkidle
agent-browser get title
agent-browser screenshot "$SHOT_DIR/web-react-home.png"

echo "Smoke test passed. Screenshot: $SHOT_DIR/web-react-home.png"
