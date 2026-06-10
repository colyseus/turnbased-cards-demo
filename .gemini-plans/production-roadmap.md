# Production Readiness Roadmap

> **Note (2026-06-10):** This roadmap was rewritten to reflect the current
> architecture. The previous version assumed a Three.js / R3F frontend
> ("InstancedMesh", "Card UV mapping") that has been retired. The
> maintained frontend is `web-react/`, a React DOM + CSS client, as
> recorded in `docs/goal-card-demo-correctness.md`.
>
> The decompositions for each item live as numbered sub-goals in
> [`EXECUTION_LOG.md`](../EXECUTION_LOG.md) at the repo root. Sub-goals
> are recursive — a parent goal stays "in progress" until every
> numbered sub-goal under it ships.

## 1. Client Performance and Rendering

**Objective:** Eliminate dropped frames, reduce bundle/asset size, and
stop unnecessary React re-renders.

- [ ] **1.1 Consolidate card PNGs into a single sprite atlas.** The
  CSS sprite positioning is already wired up (`web-react/src/components/
  CardAtlasView.tsx` + `ATLAS_ORDER` + 10-column grid), but the source
  files are still ~55 separate PNGs in `web-react/public/kenney_playing-
  cards-pack/PNG/Cards (medium)/`. Merge them into one (or a small
  number of) sprite-sheet images, drop them in `web-react/public/`, and
  update the `ATLAS_ORDER` paths so the browser does one HTTP request
  for the whole set.
- [ ] **1.2 Eliminate per-card re-renders in the table view.** The
  card list re-renders on every Colyseus state diff. Profile with React
  DevTools, identify the hot paths in `useTableRoomController.ts` and
  `TableRoom.tsx`, and apply `React.memo` + stable callbacks. The
  equivalent of the old "InstancedMesh" win is reducing the per-card
  work the DOM does on every state tick.
- [ ] **1.3 Asset compression pass.** PNG sprite is uncompressed;
  audio is already mp3/ogg per the smoke test. Run `pngcrush` or
  `oxipng` on the atlas from 1.1, and add a `prebuild` step so future
  asset additions get compressed on commit. Verify the 95-module
  Vite build size shrinks meaningfully.

## 2. Server Scalability and Architecture

**Objective:** Handle high concurrent user loads gracefully without
state-sync lag or dropped connections.

- [ ] **2.1 Matchmaking queue.** Replace the basic room-join logic
  with a Colyseus `MatchMaker` queue that groups players by ELO/skill
  or region. Add a `matchmake` message handler and a `QueueRoom` that
  holds players until a table is full.
- [ ] **2.2 Rate-limit expansion.** The current rate limit covers
  card plays (`ACTION_COOLDOWN_MS`). Extend it to chat messages, UNO
  calls, and join attempts. Add per-message-type buckets and reject
  messages with a structured error code (not just `undefined`).
- [ ] **2.3 Redis presence documentation.** `@colyseus/redis-presence`
  is already wired up (per `TODO.md`). Document the multi-process /
  multi-node deployment shape in `docs/scaling.md`: env vars, topology,
  what to watch for, what breaks when the Redis connection drops.
- [ ] **2.4 StateView audit.** `UnoRoomState` is a `@colyseus/schema`
  class. Audit it for `StateView` opportunities — anything that is
  per-player private (hands, vote values) should be hidden from other
  clients. Validate the `onChange`/`onAdd` listeners are filtered
  correctly.

## 3. Observability and Monitoring

**Objective:** Gain deep visibility into server health, client errors,
and game metrics.

- [ ] **3.1 Structured logger (Pino).** Replace the current
  `server/src/logger.ts` with Pino. Output JSON to stdout in
  production, pretty-print in dev. The Colyseus room, schema, and
  reconnection paths should all log through it.
- [ ] **3.2 `/metrics` endpoint.** Add a `prom-client` `Registry`,
  expose Colyseus room counts, active users, memory usage, and game
  duration histograms at `GET /metrics`. Wire it into the existing
  Express setup in `server/src/app.config.ts`.
- [ ] **3.3 Sentry client integration.** Add `@sentry/react` to
  `web-react/`, wrap the root with an `ErrorBoundary` that reports
  to Sentry, and capture unhandled exceptions and React render
  boundary errors. Use a fake DSN in tests; require a real DSN in
  production via env var.

## 4. Quality Assurance and Security

**Objective:** Guarantee a bug-free core loop and protect against
malicious payloads.

- [ ] **4.1 Full game-loop E2E tests.** The current `xvfb-run -a
  npm run test:smoke` covers the lobby → table flow. Extend it to
  run multiple games end-to-end with bots + a human client, capture
  the state at each step, and assert win/loss conditions. Use
  `agent-browser` (already wired up in the smoke test).
- [ ] **4.2 Strict payload validation.** Add a schema validator
  (zod or valibot) to every incoming Colyseus message handler. Reject
  malformed payloads with a structured error code, never crash the
  room. Add a fuzz test that throws random shapes at every handler.
- [ ] **4.3 Anti-cheat audit.** Audit server-side logic for places
  a client could infer hidden state: deck order, opponent card
  values, draw pile composition. Add a `stateSnapshot` test that
  compares what a client *sees* to what the server holds, and fails
  on any leak.
- [ ] **4.4 Middleware security.** Add Express middleware to the
  server: helmet for headers, CORS, body size limits, request
  logging, and a basic rate limiter on the `/metrics` and
  `/healthz` endpoints. Document the threat model in
  `docs/security.md`.

---

## Execution cadence

Each numbered item is a goal with a sub-goal tree. Sub-goals are
written in `EXECUTION_LOG.md` at the repo root. The status of each
goal is tracked by the checkbox in this file (checked = shipped) and
by the linked PR/commits in `EXECUTION_LOG.md`.

**Stopping rule (per user direction 2026-06-10):**
"recursively execute all remaining epics until all of them are
successfully resolved." No per-epic stop. Ship all four epics.

**Working-mode constraint (2026-06-10):**
The kanban dispatcher is non-functional with `display.interface: tui`
set in `~/.hermes/config.yaml`. All work for these epics is being
executed **directly in the orchestrator session** rather than queued
on the kanban board, per the direct-execution fallback in the
`kanban-orchestrator` skill. Each completed goal still gets a
commit + an entry in `EXECUTION_LOG.md` so the audit trail is
preserved.
