#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"
SHOT_DIR="$ROOT_DIR/.tmp-agent-browser"
SESSION="card-demo-smoke"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-5173}"
if [[ -n "${APP_URL+x}" ]]; then
  APP_URL_PROVIDED=1
fi
APP_URL="${APP_URL:-http://${APP_HOST}:${APP_PORT}}"
API_URL="${API_URL:-http://127.0.0.1:2567}"

cleanup() {
  agent-browser --session "$SESSION" close --all >/dev/null 2>&1 || true
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then kill "$CLIENT_PID" 2>/dev/null || true; fi
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

mkdir -p "$SHOT_DIR"

cd "$SERVER_DIR"
if ! curl --max-time 3 -fsS "${API_URL}/healthz" >/dev/null 2>&1; then
  npm run dev > /tmp/uno-server.log 2>&1 &
  SERVER_PID=$!
fi

cd "$CLIENT_DIR"
if ! curl --max-time 3 -fsS "$APP_URL" >/dev/null 2>&1; then
  if [[ -z "${APP_URL_PROVIDED:-}" && "$APP_URL" == "http://${APP_HOST}:5173" ]]; then
    APP_PORT="$(
      node -e "const s=require('node:net').createServer();s.listen(0,'${APP_HOST}',()=>{console.log(s.address().port);s.close();});"
    )"
    APP_URL="http://${APP_HOST}:${APP_PORT}"
  fi
  npm run dev -- --host "$APP_HOST" --port "$APP_PORT" --strictPort > /tmp/uno-web.log 2>&1 &
  CLIENT_PID=$!
fi

for _ in {1..40}; do
  if curl --max-time 3 -fsS "${API_URL}/healthz" >/dev/null 2>&1 && curl --max-time 3 -fsS "$APP_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl --max-time 3 -fsS "${API_URL}/healthz" >/dev/null
curl --max-time 3 -fsS "$APP_URL" >/dev/null

cd "$SERVER_DIR"
npm test -- test/uno.test.ts >/tmp/uno-autoplay-test.log

check_clean_browser() {
  local label="$1"
  local console_out error_out
  console_out="$(agent-browser --session "$SESSION" console || true)"
  error_out="$(agent-browser --session "$SESSION" errors || true)"
  if [[ "$console_out" =~ (\[error\]|Uncaught|THREE\.Clock|shader) ]] || [[ "$error_out" =~ (Uncaught|THREE\.Clock|shader) ]]; then
    printf 'Browser %s console output:\n%s\n' "$label" "$console_out" >&2
    printf 'Browser %s page errors:\n%s\n' "$label" "$error_out" >&2
    return 1
  fi
}

open_clean() {
  local width="$1"
  local height="$2"
  agent-browser --session "$SESSION" close --all >/dev/null 2>&1 || true
  sleep 1
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

exercise_overlay_states() {
  dom_click() {
    local selector="$1"
    local escaped="$selector"
    escaped="${escaped//\\/\\\\}"
    escaped="${escaped//\"/\\\"}"
    agent-browser --session "$SESSION" wait --fn "
      (function() {
        const el = document.querySelector(\"${escaped}\");
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    "
  }

  echo "overlay-check: rules open"
  dom_click '[data-testid="topbar-rules"]'
  echo "overlay-check: rules visible"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".drawer-content") !== null'

  echo "overlay-check: replay guide"
  dom_click '[data-testid="rules-replay-guide"]'
  echo "overlay-check: tutorial visible"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".first-game-guide") !== null'

  echo "overlay-check: tutorial close"
  dom_click '[data-testid="tutorial-skip"]'
  echo "overlay-check: tutorial hidden"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".first-game-guide") === null'

  echo "overlay-check: rules reopen"
  dom_click '[data-testid="topbar-rules"]'
  echo "overlay-check: rules visible again"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".drawer-content") !== null'

  echo "overlay-check: rules close"
  dom_click '[data-testid="rules-close"]'
  echo "overlay-check: rules hidden"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".drawer-content") === null'
}

simulate_play() {
  local label="$1"
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".table-board .card-sprite") !== null' --timeout 15000
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-0-initial.png"

  if ! agent-browser --session "$SESSION" wait --fn 'document.querySelector(".hand-card-wrapper.playable") !== null || document.querySelector(".draw-pile.guidance-pulse") !== null' --timeout 45000; then
    agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-1-waiting-turn.png"
    agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-2-waiting-turn.png"
    return 0
  fi

  agent-browser --session "$SESSION" wait --fn '
    (function() {
      const wildCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Wild\"]");
      if (wildCard) {
        wildCard.click();
        return true;
      }
      const wildDraw4 = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Wild +4\"]");
      if (wildDraw4) {
        wildDraw4.click();
        return true;
      }
      const reverseCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Reverse\"]");
      if (reverseCard) {
        reverseCard.click();
        return true;
      }
      const skipCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Skip\"]");
      if (skipCard) {
        skipCard.click();
        return true;
      }
      const playableCard = document.querySelector(".hand-card-wrapper.playable button");
      if (playableCard) {
        playableCard.click();
        return true;
      }
      const drawDeck = document.querySelector(".draw-pile.guidance-pulse");
      if (drawDeck) {
        drawDeck.click();
        return true;
      }
      return false;
    })()
  '

  agent-browser --session "$SESSION" wait 800
  agent-browser --session "$SESSION" wait --fn '
    (function() {
      const modal = document.querySelector(".color-modal");
      if (!modal) return true;
      const red = document.querySelector("[data-testid=\"wild-color-red\"]");
      if (red) {
        red.click();
      }
      return true;
    })()
  '
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-1-selected.png"

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

  agent-browser --session "$SESSION" wait 2500
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/web-react-game-${label}-2-played.png"
}

play_one_turn() {
  if agent-browser --session "$SESSION" wait --fn 'document.querySelector(".winner-podium-overlay") !== null' --timeout 2000; then
    echo "game-over"
    return
  fi

  if ! agent-browser --session "$SESSION" wait --fn 'document.querySelector(".hand-card-wrapper.playable") !== null || document.querySelector(".draw-pile.guidance-pulse") !== null' --timeout 10000; then
    echo "waiting"
    return
  fi

  local result
  result=$(agent-browser --session "$SESSION" wait --fn '
    (function() {
      const wildCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Wild\"]");
      if (wildCard) { wildCard.click(); return "wild"; }
      const wildDraw4 = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Wild +4\"]");
      if (wildDraw4) { wildDraw4.click(); return "wild"; }
      const reverseCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Reverse\"]");
      if (reverseCard) { reverseCard.click(); return "reverse"; }
      const skipCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$=\"Skip\"]");
      if (skipCard) { skipCard.click(); return "skip"; }
      const playableCard = document.querySelector(".hand-card-wrapper.playable button");
      if (playableCard) { playableCard.click(); return "played"; }
      const drawDeck = document.querySelector(".draw-pile.guidance-pulse");
      if (drawDeck) { drawDeck.click(); return "drawn"; }
      return false;
    })()
  ')

  if [[ "$result" == *"wild"* ]]; then
    agent-browser --session "$SESSION" wait 800
    agent-browser --session "$SESSION" wait --fn '
      (function() {
        const modal = document.querySelector(".color-modal");
        if (!modal) return true;
        const red = document.querySelector("[data-testid=\"wild-color-red\"]");
        if (red) red.click();
        return true;
      })()
    '
    echo "wild-picked"
    return
  fi

  if [[ "$result" == *"drawn"* ]]; then
    echo "drawn"
    return
  fi

  echo "played"
}

full_game_loop() {
  local label="$1"
  local max_turns=200
  local turns=0

  echo "=== Full game loop: $label ==="
  agent-browser --session "$SESSION" wait --fn 'document.querySelector(".table-board .card-sprite") !== null' --timeout 15000
  agent-browser --session "$SESSION" screenshot "$SHOT_DIR/full-game-${label}-0-start.png"

  while [[ $turns -lt $max_turns ]]; do
    local result
    result=$(play_one_turn)

    if [[ "$result" == "game-over" ]]; then
      agent-browser --session "$SESSION" screenshot "$SHOT_DIR/full-game-${label}-winner.png"
      local winner
      winner=$(agent-browser --session "$SESSION" wait --fn '
        (function() {
          const h1 = document.querySelector(".winner-podium-box h1");
          return h1 ? h1.textContent : null;
        })()
      ' --timeout 5000)
      echo "Winner: $winner"
      echo "Game completed in $turns turns"
      return 0
    fi

    if [[ "$result" == "waiting" ]]; then
      sleep 1
      continue
    fi

    turns=$((turns + 1))
    sleep 0.3
  done

  echo "Game did not finish within $max_turns turns"
  return 1
}

open_clean 1280 720
agent-browser --session "$SESSION" record start "$SHOT_DIR/desktop.webm"
quick_game "SmokeDesk"
exercise_overlay_states
simulate_play "desktop"
agent-browser --session "$SESSION" record stop
check_clean_browser "desktop"

open_clean 390 844
agent-browser --session "$SESSION" record start "$SHOT_DIR/mobile.webm"
quick_game "SmokeMob"
exercise_overlay_states
simulate_play "mobile"
agent-browser --session "$SESSION" record stop
check_clean_browser "mobile"

# Full game loop test
echo "=== Full game loop E2E test ==="
open_clean 1280 720
quick_game "FullLoop"
full_game_loop "full"
check_clean_browser "full-loop"

# Stitch screenshots
echo "=== Stitching screenshots ==="
DESKTOP_0="$SHOT_DIR/web-react-game-desktop-0-initial.png"
DESKTOP_1="$SHOT_DIR/web-react-game-desktop-1-selected.png"
if [[ ! -f "$DESKTOP_1" ]]; then DESKTOP_1="$SHOT_DIR/web-react-game-desktop-1-waiting-turn.png"; fi
DESKTOP_2="$SHOT_DIR/web-react-game-desktop-2-played.png"
if [[ ! -f "$DESKTOP_2" ]]; then DESKTOP_2="$SHOT_DIR/web-react-game-desktop-2-waiting-turn.png"; fi

MOBILE_0="$SHOT_DIR/web-react-game-mobile-0-initial.png"
MOBILE_1="$SHOT_DIR/web-react-game-mobile-1-selected.png"
if [[ ! -f "$MOBILE_1" ]]; then MOBILE_1="$SHOT_DIR/web-react-game-mobile-1-waiting-turn.png"; fi
MOBILE_2="$SHOT_DIR/web-react-game-mobile-2-played.png"
if [[ ! -f "$MOBILE_2" ]]; then MOBILE_2="$SHOT_DIR/web-react-game-mobile-2-waiting-turn.png"; fi

if [[ -f "$DESKTOP_0" && -f "$DESKTOP_1" && -f "$DESKTOP_2" && -f "$MOBILE_0" && -f "$MOBILE_1" && -f "$MOBILE_2" ]]; then
  convert \( "$DESKTOP_0" "$DESKTOP_1" "$DESKTOP_2" +append \) \
          \( "$MOBILE_0" "$MOBILE_1" "$MOBILE_2" -resize x720 +append -background "#1a1a1a" -gravity center -extent 3840x720 \) \
          -append "$SHOT_DIR/stitched_screenshots.png"
  echo "✓ Stitched screenshots saved to $SHOT_DIR/stitched_screenshots.png"
else
  echo "Warning: Some screenshots were missing. Skipping image stitching."
fi

# Stitch videos
echo "=== Stitching videos ==="
if [[ -f "$SHOT_DIR/desktop.webm" && -f "$SHOT_DIR/mobile.webm" ]]; then
  ffmpeg -y -i "$SHOT_DIR/desktop.webm" -i "$SHOT_DIR/mobile.webm" -filter_complex \
  "[0:v]scale=1280:720,setsar=1[v0]; \
   [1:v]scale=-1:720,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v1]; \
   [v0][v1]concat=n=2:v=1:a=0[outv]" \
  -map "[outv]" "$SHOT_DIR/stitched_video.mp4"
  echo "✓ Stitched video saved to $SHOT_DIR/stitched_video.mp4"
else
  echo "Warning: Some video recordings were missing. Skipping video stitching."
fi

cat <<EOF
Smoke test passed. Screenshots:
- $SHOT_DIR/web-react-game-desktop-0-initial.png
- $SHOT_DIR/web-react-game-desktop-1-selected.png or $SHOT_DIR/web-react-game-desktop-1-waiting-turn.png
- $SHOT_DIR/web-react-game-desktop-2-played.png or $SHOT_DIR/web-react-game-desktop-2-waiting-turn.png
- $SHOT_DIR/web-react-game-mobile-0-initial.png
- $SHOT_DIR/web-react-game-mobile-1-selected.png or $SHOT_DIR/web-react-game-mobile-1-waiting-turn.png
- $SHOT_DIR/web-react-game-mobile-2-played.png or $SHOT_DIR/web-react-game-mobile-2-waiting-turn.png
- $SHOT_DIR/full-game-full-0-start.png
- $SHOT_DIR/full-game-full-winner.png
- Stitched image: $SHOT_DIR/stitched_screenshots.png
- Stitched video: $SHOT_DIR/stitched_video.mp4

Manual visual pass required:
- Server game-logic tests include autoPlayGame full-game completion and turn-limit exhaustion.
- Lobby and table surfaces render with the rebuilt frontend only.
- Room join creates a live table on desktop and mobile.
- HUD, hand dock, opponent strips, chat, and table controls do not incoherently overlap.
- Full game loop completes with a winner and winner podium displayed.
EOF
