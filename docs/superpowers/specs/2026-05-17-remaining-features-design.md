# Design Spec: Remaining Nice-to-Have Features

## Date: 2026-05-17
## Scope: 6 remaining items from TODO.md (bot difficulty UI already implemented)

---

## 1. Chunk Size Warning

**Problem:** Vite build warns that `three-vendor` chunk is 724 kB.

**Root Cause:** Three.js is inherently large. The project already uses `manualChunks` and lazy-loads `GameScene`, so the chunking is optimal.

**Solution:** Raise `build.chunkSizeWarningLimit` from default 500 kB to 800 kB in `vite.config.ts`. No other changes needed.

**Files:** `web-react/vite.config.ts`

---

## 2. Private Room Password

**Problem:** `setPrivate()` hides rooms from matchmaking, but anyone with the room ID can still join.

**Solution:**
- **Lobby (create):** Add password input (optional, max 32 chars) below the "Private room" toggle.
- **Lobby (join):** Show password input when joining a private room by code.
- **Server:** Store `password` in room options. In `onJoin`, if `this.password` is set, reject clients that don't provide a matching password.
- **Client:** Pass `password` in join options. Show clear error when rejected.
- **Schema:** No schema changes needed — password is server-only metadata.

**Files:**
- `web-react/src/main.tsx` — password inputs
- `server/src/rooms/UnoRoom.ts` — password validation in `onJoin`

---

## 3. Redis Adapter

**Problem:** Docs describe Redis horizontal scaling but code has no adapter wiring.

**Solution:**
- Add `@colyseus/redis-adapter` as optional dependency.
- In `server/src/app.config.ts`, conditionally create `RedisPresence` when `REDIS_URL` env var is present.
- Parse `REDIS_URL` (supports `redis://host:port` format) or use `REDIS_HOST` + `REDIS_PORT` fallback.
- Update `docs/deployment.md` with env var docs.

**Files:**
- `server/package.json` — add `@colyseus/redis-adapter`
- `server/src/app.config.ts` — conditional RedisPresence
- `docs/deployment.md` — env var documentation

---

## 4. Rematch Voting

**Problem:** After a game ends, players must manually click "New Game" which immediately restarts. No consensus mechanism.

**Solution:**
- **Schema addition:** Add `rematchVotes: { array: "number" }` to `UnoRoomState` — stores seat indices of players who voted to rematch.
- **Server behavior:**
  - On game end (`phase = "finished"`), clear rematchVotes.
  - Add `vote_rematch` message handler: validate sender is human, add their seat to rematchVotes.
  - After each vote, check if ALL connected human players have voted. If yes, auto-call `handleRestart()`.
  - If a player leaves, remove their vote from the set.
- **Client UI:** In winner overlay, replace "New Game" with "Vote Rematch" button. Show vote count ("2/3 voted"). Keep "New Game" as force-restart for the host (first human player).

**Files:**
- `server/src/rooms/schema/UnoRoomState.ts` — add rematchVotes field
- `server/src/rooms/UnoRoom.ts` — vote_rematch handler, auto-restart logic
- `web-react/src/components/Game.tsx` — winner overlay UI changes

---

## 5. Mobile Responsive Design

**Problem:** Game works on desktop but touch targets and layout could be improved on mobile.

**Solution:**
- **Touch targets:** Increase invisible hit area for cards and draw pile on touch devices (`'ontouchstart' in window` check).
- **Swipe gestures:** Add swipe left/right on the canvas to navigate playable cards (alternative to keyboard arrows).
- **HUD:** Collapse bottom player labels on very small screens; show only active player's info.
- **Canvas sizing:** Ensure the Three.js canvas doesn't overflow on mobile browsers (address bar height issues).

**Files:**
- `web-react/src/components/Game.tsx` — touch handling, swipe gestures
- `web-react/src/index.css` — mobile media queries

---

## 6. Leaderboard / Stats

**Problem:** No persistence of player performance across sessions.

**Solution:**
- **localStorage key:** `uno-stats-v1`
- **Data per player (keyed by name):**
  - `gamesPlayed`: number
  - `wins`: number
  - `unoCalls`: number (successful UNO calls)
  - `cardsPlayed`: number
- **Tracking:**
  - Increment `gamesPlayed` on game start (when local player is in a seat).
  - Increment `wins` when local player wins.
  - Increment `unoCalls` when player sends "uno" message successfully.
  - Increment `cardsPlayed` when local player plays a card.
- **UI:**
  - Add "Stats" button to lobby showing a simple table of top players.
  - Show personal stats in the options overlay.

**Files:**
- `web-react/src/stats.ts` — new utility module for localStorage read/write
- `web-react/src/main.tsx` — stats button in lobby
- `web-react/src/components/Game.tsx` — track stats during gameplay

---

## Dependencies

| Feature | New Dependencies |
|---------|-----------------|
| Redis Adapter | `@colyseus/redis-adapter` |
| All others | None |

---

## Testing Plan

1. **Chunk size:** Run `npm run build` in web-react — no warnings.
2. **Password:** Create private room with password, try joining without password → rejected. Join with correct password → accepted.
3. **Redis:** Set `REDIS_URL=redis://localhost:6379`, verify server starts with RedisPresence.
4. **Rematch:** End a game, have 2 humans vote rematch → game auto-restarts.
5. **Mobile:** Test on mobile viewport in DevTools — cards are tappable, swipe works.
6. **Stats:** Play a game, check localStorage has stats entry.

---

## Implementation Order

1. Chunk size (quickest — unblock build)
2. Password (independent, medium)
3. Redis (independent, medium — can run in parallel with 2)
4. Rematch (depends on schema + server + UI)
5. Mobile (independent UI work)
6. Stats (independent, but nicer after rematch is done)
