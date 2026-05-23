#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"
SHOT_DIR="$ROOT_DIR/.tmp-agent-browser"
SESSION="card-demo-smoke"
APP_URL="${APP_URL:-http://127.0.0.1:5173}"
API_URL="${API_URL:-http://127.0.0.1:2567}"

cleanup() {
  agent-browser --session "$SESSION" close --all >/dev/null 2>&1 || true
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then kill "$CLIENT_PID" 2>/dev/null || true; fi
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

mkdir -p "$SHOT_DIR"

cd "$SERVER_DIR"
if ! curl --max-time 3 -fsS "$API_URL" >/dev/null 2>&1; then
  npm run dev > /tmp/uno-server.log 2>&1 &
  SERVER_PID=$!
fi

cd "$CLIENT_DIR"
if ! curl --max-time 3 -fsS "$APP_URL" >/dev/null 2>&1; then
  npm run dev > /tmp/uno-web.log 2>&1 &
  CLIENT_PID=$!
fi

for _ in {1..40}; do
  if curl --max-time 3 -fsS "$API_URL" >/dev/null 2>&1 && curl --max-time 3 -fsS "$APP_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl --max-time 3 -fsS "$API_URL" >/dev/null
curl --max-time 3 -fsS "$APP_URL" >/dev/null

check_clean_browser() {
  local label="$1"
  local console_out error_out
  console_out="$(agent-browser --session "$SESSION" console || true)"
  error_out="$(agent-browser --session "$SESSION" errors || true)"
  if [[ "$console_out" =~ (error|warn|THREE.Clock|shader) ]] || [[ "$error_out" =~ (Error|Exception|THREE.Clock|shader) ]]; then
    printf 'Browser %s console output:\n%s\n' "$label" "$console_out" >&2
    printf 'Browser %s page errors:\n%s\n' "$label" "$error_out" >&2
    return 1
  fi
}

open_clean() {
  local width="$1"
  local height="$2"
  agent-browser --session "$SESSION" close --all >/dev/null 2>&1 || true
  agent-browser --session "$SESSION" --headed --args "--no-sandbox,--disable-gpu-sandbox,--use-gl=swiftshader,--ignore-gpu-blocklist,--enable-unsafe-swiftshader" open "$APP_URL"
  agent-browser --session "$SESSION" set viewport "$width" "$height"
  agent-browser --session "$SESSION" wait --load networkidle
  agent-browser --session "$SESSION" console --clear
  agent-browser --session "$SESSION" errors --clear
}

quick_game() {
  local name="$1"
  agent-browser --session "$SESSION" find placeholder "Player name" fill "$name"
  agent-browser --session "$SESSION" find role button click --name "Start Table"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector("canvas") !== null'
  agent-browser --session "$SESSION" wait 1000
}

open_clean 1280 720
quick_game "SmokeDesk"
agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-desktop.png"
check_clean_browser "desktop"

open_clean 390 844
quick_game "SmokeMob"
agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-mobile.png"
check_clean_browser "mobile"

open_clean 1280 720
agent-browser --session "$SESSION" find role button click --name "STRESS TEST"
agent-browser --session "$SESSION" wait --fn 'document.body.innerText.includes("RENDERING STRESS TEST")'
agent-browser --session "$SESSION" wait --fn 'document.querySelector("canvas") !== null'
agent-browser --session "$SESSION" wait 1000
agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-stress.png"
check_clean_browser "stress"

cat <<EOF
Smoke test passed. Screenshots:
- $SHOT_DIR/web-react-game-desktop.png
- $SHOT_DIR/web-react-game-mobile.png
- $SHOT_DIR/web-react-stress.png

Manual visual pass required:
- Hidden hands and draw pile show card backs only.
- Local hand and discard pile are upright.
- HUD, cards, rematch, last-play, and debug controls do not incoherently overlap.
EOF
