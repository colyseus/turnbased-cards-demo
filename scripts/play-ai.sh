#!/usr/bin/env bash
# scripts/play-ai.sh
# A workflow/script to let Antigravity (the AI agent) jump into a real game of UNO and play with bots.
# This script starts the local server and client if they are not already running,
# and opens an agent-browser session so the AI can play live.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"
SESSION="uno-ai-play"
APP_HOST="127.0.0.1"
APP_PORT="5173"
APP_URL="http://${APP_HOST}:${APP_PORT}"
API_URL="http://127.0.0.1:2567"

# PIDs to clean up if we started them
SERVER_PID=""
CLIENT_PID=""

cleanup() {
  echo "Cleaning up..."
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Stopping server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then
    echo "Stopping client (PID $CLIENT_PID)..."
    kill "$CLIENT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 1. Start Server if not running
if ! curl --max-time 2 -fsS "$API_URL" >/dev/null 2>&1; then
  echo "Starting authoritative UNO server on $API_URL..."
  cd "$SERVER_DIR"
  npm run dev > /tmp/uno-server.log 2>&1 &
  SERVER_PID=$!
else
  echo "Authoritative UNO server is already running on $API_URL."
fi

# 2. Start Client if not running
if ! curl --max-time 2 -fsS "$APP_URL" >/dev/null 2>&1; then
  echo "Starting React client on $APP_URL..."
  cd "$CLIENT_DIR"
  npm run dev -- --host "$APP_HOST" --port "$APP_PORT" --strictPort > /tmp/uno-web.log 2>&1 &
  CLIENT_PID=$!
else
  echo "React client is already running on $APP_URL."
fi

# 3. Wait for services to be ready
echo "Waiting for services to be fully responsive..."
for _ in {1..30}; do
  if curl --max-time 2 -fsS "$API_URL" >/dev/null 2>&1 && curl --max-time 2 -fsS "$APP_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl --max-time 2 -fsS "$API_URL" >/dev/null 2>&1 || ! curl --max-time 2 -fsS "$APP_URL" >/dev/null 2>&1; then
  echo "Error: Services failed to start properly. Check /tmp/uno-server.log and /tmp/uno-web.log"
  exit 1
fi

echo "Services are ready!"

# 4. Open agent-browser session and join game
echo "Initializing agent-browser session: $SESSION"
agent-browser --session "$SESSION" close --all >/dev/null 2>&1 || true

echo "Opening UNO Web Client..."
agent-browser --session "$SESSION" --headed --args "--no-sandbox,--disable-gpu-sandbox,--use-gl=swiftshader,--ignore-gpu-blocklist" open "$APP_URL"
agent-browser --session "$SESSION" set viewport 1280 720
agent-browser --session "$SESSION" wait --load networkidle

echo "Joining game as 'Antigravity'..."
agent-browser --session "$SESSION" fill 'input[placeholder="Enter your name"]' "Antigravity"
agent-browser --session "$SESSION" click '.primary-btn'
agent-browser --session "$SESSION" wait --fn 'document.querySelector(".game-shell") !== null'
sleep 2

# Take an initial screenshot so the agent can see the board
mkdir -p "$ROOT_DIR/.tmp-agent-browser"
agent-browser --session "$SESSION" screenshot "$ROOT_DIR/.tmp-agent-browser/live-game-start.png"

cat <<EOF

================================================================================
🎉 SUCCESS! You are now joined to the live UNO game with actual bots.
================================================================================
Session: $SESSION
Screenshot saved to: $ROOT_DIR/.tmp-agent-browser/live-game-start.png

To play the game as Antigravity, you can run the following agent-browser commands
using your run_command tool:

1. Check the board status (take a screenshot):
   agent-browser --session $SESSION screenshot "$ROOT_DIR/.tmp-agent-browser/live-game.png"

2. Play a playable card (if it is your turn):
   agent-browser --session $SESSION wait --fn '
     (function() {
       const playableCard = document.querySelector(".hand-card-wrapper.playable button");
       if (playableCard) { playableCard.click(); return true; }
       return false;
     })()
   '

3. Draw a card (if you have no playable cards):
   agent-browser --session $SESSION wait --fn '
     (function() {
       const drawDeck = document.querySelector(".draw-pile.guidance-pulse");
       if (drawDeck) { drawDeck.click(); return true; }
       return false;
     })()
   '

To exit and clean up the processes, stop the script.
================================================================================
EOF

# Keep script running to preserve PIDs
while true; do
  sleep 10
done
