# TODO Map — turnbased-cards-demo

## What's Done ✅

### Core Server
- [x] UNO game logic (createDeck, shuffle, play, draw, canPlay)
- [x] Colyseus room with schema (UnoRoomState, PlayerSchema, UnoCardSchema)
- [x] Bot AI players filling empty seats
- [x] Turn scheduling with `scheduleTurn()`
- [x] `play_card` message handler
- [x] `draw_card` message handler
- [x] `restart` message handler
- [x] Win detection
- [x] Direction reversal
- [x] Skip effect
- [x] Draw-2 stacking
- [x] UNO calling mechanic (2-card penalty)
- [x] Card counting (hard-difficulty AI)
- [x] Bot difficulty levels (easy/medium/hard)
- [x] Spectator mode
- [x] Click-to-draw
- [x] Rate limiting (ACTION_COOLDOWN_MS)
- [x] Input validation (cardId, name)
- [x] Structured logging (logger.ts)
- [x] Race condition fix (turnActionActive guard)
- [x] Architectural reconnection (seatsHandedToBot, onJoin distinguishing returning vs new players)
- [x] Unit tests — 56 passing (uno.test.ts, reconnection.test.ts, security.test.ts)
- [x] constants.ts shared between server and clients
- [x] Schema migration docs (docs/schema-migration.md)
- [x] Troubleshooting docs (docs/troubleshooting.md)
- [x] Protocol docs (docs/protocol.md)
- [x] Deployment docs (docs/deployment.md)

### Web Client (React + R3F)
- [x] Lobby UI (name input, create/join)
- [x] 3D card rendering with Three.js / React Three Fiber
- [x] Card flip animation
- [x] Camera shake on play
- [x] Confetti / win animation
- [x] Vibration API on UNO call
- [x] Avatar system (Avatar.tsx)
- [x] ErrorBoundary component
- [x] FPS counter
- [x] GameScene.tsx
- [x] LongPressCard enlarger
- [x] Name validation (non-empty, no special chars)
- [x] Web Audio sound effects
- [x] Playable card highlight
- [x] Card sorting
- [x] Rules overlay
- [x] Connection quality indicator (ping/signal bars)
- [x] State-based chat
- [x] Keyboard accessibility (arrow nav, U/C/S/F/?/Q shortcuts)
- [x] WebGL quality presets (Low/Med/High)
- [x] PWA (sw.js + manifest.json)
- [x] ESLint flat config (eslint.config.js)
- [x] Prettier config (.prettierrc)
- [x] Colyseus client hook (useColyseus)

### CI/CD
- [x] Server CI workflow (.github/workflows/server.yml) — test + type check + build
- [x] Client CI workflow (.github/workflows/client.yml) — lint + type check + build + e2e
- [x] Deploy workflow (.github/workflows/deploy.yml)
- [x] Fly.io deployment docs
- [x] Railway deployment docs
- [x] Redis adapter docs for horizontal scaling
- [x] Health check endpoint docs

### Other Clients
- [x] Haxe + Heaps implementation
- [x] GameMaker implementation
- [x] Defold implementation
- [x] Godot implementation
- [x] Unity implementation

### Docs
- [x] README.md
- [x] QUICKSTART.md
- [x] docs/deployment.md
- [x] docs/protocol.md
- [x] docs/schema-migration.md
- [x] docs/troubleshooting.md

---

## Remaining Work 🔨

### 🔴 Critical (must fix before commit)

- [x] **BUG: TypeScript error in UnoRoom.ts** — FIXED: Changed `chatMessages = []` to `chatMessages = new ArraySchema()` and added `ArraySchema` import from `@colyseus/schema`.
- [x] **Missing: server `build` script** — FIXED: Added `"build": "npx tsc --noEmit"` to server/package.json. Also added `typescript` as devDependency and created `tsconfig.build.json` for production builds.
- [x] **Production build approach** — FIXED: Updated deployment docs to use `npm start` (tsx runtime) instead of compiled dist/. The tsx runner handles TypeScript natively and is production-ready.

### 🟡 Pending (should do before calling "done")

- [ ] **Commit all modified files** — git status shows ~16 modified files in server/ and web-react/
  - server/shared/constants.ts (new file)
  - server/src/logger.ts (new file)
  - server/src/rooms/UnoRoom.ts (major changes)
  - server/shared/uno.ts (major changes)
  - server/src/rooms/schema/UnoRoomState.ts (chatMessages, spectatorCount, unoCaller)
  - server/tsconfig.build.json (new file)
  - web-react/src/components/*.tsx (new components)
  - web-react/src/sound.ts (new file)
  - web-react/public/sw.js, manifest.json, favicon.svg (PWA)
  - .github/workflows/client.yml, server.yml (new files)
  - gamemaker/setup_project.sh (modified)
  - And many package-lock.json updates

- [ ] **Verify GitHub Actions pass** — workflows exist but haven't been run yet in CI
  - server CI: test → type check → build
  - client CI: lint → type check → build → e2e
  - Need to push and check PR checks

- [ ] **Playwright e2e tests need server running** — smoke.spec.ts tests WS errors are ignored, but full gameplay tests would need a running server
  - The e2e job in CI builds and serves the static build, but doesn't start the game server
  - This means the smoke tests may only validate the lobby form, not actual gameplay

### 🟢 Nice to Have (future enhancements)

- [ ] **Large chunk size warning** — Three.js vendor chunk is 724 kB. Could use dynamic imports to code-split.
- [ ] **Redis adapter configuration** — docs exist but no `REDIS_URL` env var handling in code
- [ ] **Private room password** — `setPrivate()` is called but no password flow implemented
- [ ] **Bot difficulty selection UI** — server accepts `difficulty` option but lobby doesn't expose it
- [ ] **Mobile responsive design** — no touch-specific optimizations noted
- [ ] **Leaderboard / stats** — no persistent player stats tracked
- [ ] **Rematch voting** — after a game ends, no rematch vote flow

---

## Blocker Summary

| Priority | Item | Impact |
|----------|------|--------|
| 🔴 | Fix `chatMessages` ArraySchema TypeScript error | Server won't compile |
| 🔴 | Add `build` script to server/package.json | CI build job fails |
| 🔴 | Commit all changes | Work not persisted |
| 🟡 | Verify GitHub Actions pass | CI not validated |
| 🟡 | Fix e2e test server dependency | Smoke tests don't test real gameplay |
