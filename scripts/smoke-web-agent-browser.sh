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

cd "$SERVER_DIR"
npm test -- test/uno.test.ts >/tmp/uno-autoplay-test.log

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
  agent-browser --session "$SESSION" fill 'input[placeholder="Enter your name"]' "$name"
  agent-browser --session "$SESSION" click '.primary-btn'
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".game-shell") !== null'
  agent-browser --session "$SESSION" wait 1000
}

simulate_play() {
  local label="$1"
  # Wait for either a playable card or the pulsing deck stack to appear (up to 15 seconds)
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".hand-card-wrapper.playable") !== null || document.querySelector(".deck-stack.guidance-pulse") !== null' --timeout 15000
  
  # Capture initial dealt state screenshot
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-0-initial.png"

  # Click 1: Click a playable card to select it, or click the pulsing draw stack if no plays
  agent-browser --session "$SESSION" wait --fn '
    (function() {
      const playableCard = document.querySelector(".hand-card-wrapper.playable button");
      if (playableCard) {
        playableCard.click();
        return true;
      }
      const drawDeck = document.querySelector(".deck-stack.guidance-pulse");
      if (drawDeck) {
        drawDeck.click();
        return true;
      }
      return false;
    })()
  '
  
  # Wait 800ms for fanned card lift and straightening select transitions
  agent-browser --session "$SESSION" wait 800
  
  # Capture intermediate selected state screenshot (shows elevated unclipped card!)
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-1-selected.png"
  
  # Click 2: Click the selected card again to play it (if one was selected)
  agent-browser --session "$SESSION" wait --fn '
    (function() {
      const selected = document.querySelector(".hand-card-wrapper.playable.keyboard-focused button");
      if (selected) {
        selected.click();
        return true;
      }
      return true;
    })()
  '

  # Wait 2.5 seconds for card play visual animations, dealer HUD updates, and turn transitions
  agent-browser --session "$SESSION" wait 2500
  
  # Capture final post-play/post-draw state screenshot
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-2-played.png"
}

open_clean 1280 720
quick_game "SmokeDesk"
simulate_play "desktop"
check_clean_browser "desktop"

open_clean 390 844
quick_game "SmokeMob"
simulate_play "mobile"
check_clean_browser "mobile"

cat <<EOF
Smoke test passed. Screenshots:
- $SHOT_DIR/web-react-game-desktop.png
- $SHOT_DIR/web-react-game-mobile.png

Manual visual pass required:
- Server game-logic tests include autoPlayGame full-game completion and turn-limit exhaustion.
- Lobby and table surfaces render with the rebuilt frontend only.
- Room join creates a live table on desktop and mobile.
- HUD, hand dock, opponent strips, chat, and table controls do not incoherently overlap.
EOF
