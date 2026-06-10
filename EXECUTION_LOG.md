# Execution Log — Production Epics

> **Status legend:** `[ ]` not started · `[~]` in progress · `[x]` shipped · `[!]` blocked
>
> This file is the authoritative sub-goal tree for the four epics in
> `.gemini-plans/production-roadmap.md`. Each epic is a goal; each
> numbered sub-goal is a goal; each sub-goal decomposes into concrete
> work items (files touched, tests added, verification steps). The
> tree is recursive — a goal stays `[~]` until every sub-goal under it
> is `[x]`.
>
> **Working mode (2026-06-10):** executed directly in this session
> because the kanban dispatcher is non-functional with
> `display.interface: tui` in `~/.hermes/config.yaml`. Each shipped
> sub-goal is a separate commit so the audit trail is preserved even
> without the kanban board.

---

## Epic 1 — Client Performance and Rendering  [ ]

### 1.1 Consolidate card PNGs into a single sprite atlas  [ ]
- [ ] **1.1.1** Audit the current `kenney_playing-cards-pack/PNG/Cards
  (medium)/` directory — confirm the exact file count and naming
  pattern.
- [ ] **1.1.2** Define the sprite-sheet layout. Either:
  (a) one big sheet with all 55 cards in a 10×6 grid (matches the
  existing `ATLAS_ORDER` 10-col logic), or
  (b) split into a few smaller sheets (e.g. one per color) for
  incremental loading. Pick (a) unless file-size dictates otherwise.
- [ ] **1.1.3** Generate the sprite sheet with a build step. Options:
  `spritesmith`, `sharp`, or a one-shot Python script with PIL.
  Whatever is chosen, commit the generator script so future asset
  additions are reproducible.
- [ ] **1.1.4** Update `CardAtlasView.tsx` (or its config) to point
  at the single sheet. The `ATLAS_ORDER` indices should not need to
  change — only the asset URL.
- [ ] **1.1.5** Verify: Vite build still produces the same 95-module
  output, the smoke test still passes, the card visuals are
  pixel-identical to the pre-sprite version.
- [ ] **1.1.6** Measure: count HTTP requests for the card set in the
  network tab before and after. Should drop from ~55 to 1 (or 4–5 if
  option b).

### 1.2 Eliminate per-card re-renders in the table view  [ ]
- [ ] **1.2.1** Add a `why-did-you-render` style dev-only logger
  (or use React DevTools Profiler) and capture the current render
  rate on a typical 4-player game in progress.
- [ ] **1.2.2** Identify the top 3 hot paths in
  `useTableRoomController.ts` and `TableRoom.tsx` (the controller
  re-renders are likely the dominant cost).
- [ ] **1.2.3** Apply `React.memo` to `HandCardItem` and `TableCardAlert`
  with stable prop comparators. Wrap callback props in `useCallback`
  in the parent.
- [ ] **1.2.4** Slice the Colyseus state subscriptions so a card-list
  re-render doesn't trigger an opponent-strip re-render and vice
  versa.
- [ ] **1.2.5** Re-run the profiler. Render rate should drop
  measurably. Commit with before/after numbers in the message body.
- [ ] **1.2.6** Add a Playwright (or the existing agent-browser
  smoke) assertion that FPS stays above 30 during a 4-player
  game in progress. Pin the threshold so future regressions fail.

### 1.3 Asset compression pass  [ ]
- [ ] **1.3.1** Add `oxipng` to the client `devDependencies` and a
  `prebuild` (or `pretest:smoke`) script that compresses PNGs in
  `web-react/public/`.
- [ ] **1.3.2** Run the compression on the existing card PNGs and
  the atlas from 1.1. Record the size delta in the commit message.
- [ ] **1.3.3** Verify the smoke test still passes (compressed
  images are pixel-identical to the originals).
- [ ] **1.3.4** Add a CI check (or local pre-commit hook) that
  fails if a new PNG lands without a compressed counterpart.

## Epic 2 — Server Scalability and Architecture  [ ]

### 2.1 Matchmaking queue  [ ]
- [ ] **2.1.1** Read the Colyseus `MatchMaker` docs and decide:
  built-in `MatchMake` lobby room vs. custom `QueueRoom`.
- [ ] **2.1.2** Implement the queue. Wire it into `app.config.ts`
  so a client `matchmake` message hits it instead of the direct
  `uno` join.
- [ ] **2.1.3** Add a server test: two clients send `matchmake`,
  assert they end up in the same `UnoRoom`.
- [ ] **2.1.4** Add a server test: 4 clients send `matchmake`,
  assert they're grouped into one `UnoRoom` (not split across two).
- [ ] **2.1.5** Backward-compat: keep the direct `uno` join working
  for at least one release behind a feature flag.

### 2.2 Rate-limit expansion  [ ]
- [ ] **2.2.1** Audit the existing `ACTION_COOLDOWN_MS` usage.
  Map every message type → which rate-limit bucket it should hit.
- [ ] **2.2.2** Add per-message-type buckets: `play`, `draw`,
  `chat`, `uno_call`, `join`, `rematch_vote`. Use a single
  `RateLimiter` class with named buckets.
- [ ] **2.2.3** Add a structured error code (`RATE_LIMITED`) to
  the rate-limit response so clients can show a useful message.
- [ ] **2.2.4** Add server tests: send 5 chat messages in 100ms
  and assert the 5th is rejected with `RATE_LIMITED`. Same for
  UNO calls.

### 2.3 Redis presence documentation  [ ]
- [ ] **2.3.1** Write `docs/scaling.md`: topology diagram (ASCII
  is fine), env vars, the failure modes, what to watch for in
  production.
- [ ] **2.3.2** Add a runbook section to `incident-response/`
  for "Redis presence connection lost" — the symptoms, the
  immediate mitigation, the long-term fix.

### 2.4 StateView audit  [ ]
- [ ] **2.4.1** Read `UnoRoomState.ts`. Identify every field that
  is per-player-private (hands, votes, draw pile composition).
- [ ] **2.4.2** Audit the `onChange`/`onAdd` listeners. Assert
  the server filters state before broadcast, not the client.
- [ ] **2.4.3** Add a server test that proves a malicious client
  cannot reconstruct the deck from the broadcast state. Snapshot
  both server and client views, diff, assert only the public
  surface is shared.
- [ ] **2.4.4** Document the `StateView` policy in
  `docs/architecture.md` so future schema changes preserve it.

## Epic 3 — Observability and Monitoring  [ ]

### 3.1 Structured logger (Pino)  [ ]
- [ ] **3.1.1** Add `pino` and `pino-pretty` to `server/`
  devDeps. Replace the existing `logger.ts` implementation.
- [ ] **3.1.2** Wire the new logger into `UnoRoom`, `DemoRoom`,
  and the reconnection path. Existing log callsites should need
  minimal changes.
- [ ] **3.1.3** Configure JSON output in production (when
  `NODE_ENV=production`), pretty-print in dev. Document the
  config in `server/README.md`.
- [ ] **3.1.4** Add a server test that asserts log output is valid
  JSON when `NODE_ENV=production` and has the expected fields
  (timestamp, level, msg, ...).

### 3.2 `/metrics` endpoint  [ ]
- [ ] **3.2.1** Add `prom-client` to the server deps. Create a
  `metrics.ts` module with a `Registry` and the default Node
  process metrics enabled.
- [ ] **3.2.2** Add Colyseus-specific gauges: room count by
  name, active users (sessions), memory usage, game duration
  histogram.
- [ ] **3.2.3** Wire `GET /metrics` into the Express setup in
  `app.config.ts`. Make sure it doesn't fight with Colyseus's
  internal routes.
- [ ] **3.2.4** Add a server test: `GET /metrics` returns
  Prometheus text format, includes the expected metric names.
- [ ] **3.2.5** Add a rate limiter to `/metrics` (any of
  express-rate-limit or a custom one) so a malicious client
  can't scrape it into a DoS.

### 3.3 Sentry client integration  [ ]
- [ ] **3.3.1** Add `@sentry/react` to the client deps. Create
  `web-react/src/sentry.ts` that initializes Sentry from
  `VITE_SENTRY_DSN` (or no-ops if unset).
- [ ] **3.3.2** Wrap the root render with Sentry's `ErrorBoundary`
  and add a `Sentry.init` call with the right `tracesSampleRate`
  for dev vs. production.
- [ ] **3.3.3** Add a test-mode flag that makes Sentry no-op
  in the smoke test (we don't want test errors going to a real
  Sentry project).
- [ ] **3.3.4** Add a vitest-style test that renders a
  deliberately-throwing component and asserts Sentry's
  `captureException` is called with the right context.

## Epic 4 — Quality Assurance and Security  [ ]

### 4.1 Full game-loop E2E tests  [ ]
- [ ] **4.1.1** Read the existing `scripts/smoke-web-agent-
  browser.sh`. Identify which game-loop steps it covers and
  which it doesn't.
- [ ] **4.1.2** Extend the smoke script to run a complete game
  with a human client + 3 bots: join, deal, play, draw, play,
  end, rematch. Capture the state at each step.
- [ ] **4.1.3** Add a test assertion: the game ends with exactly
  one winner, the `winner` field matches the player who played
  their last card, the other players' final hand counts add up
  to the deck math.
- [ ] **4.1.4** Run the test in CI. Make sure it gates merges.

### 4.2 Strict payload validation  [ ]
- [ ] **4.2.1** Pick the validator. Recommendation: `zod` (mature
  ecosystem, good TS interop, smaller bundle than alternatives).
  Add it to server deps.
- [ ] **4.2.2** Define a schema for every incoming Colyseus
  message type (`play_card`, `draw_card`, `chat`, `uno_call`,
  `rematch_vote`, etc.). Keep them in `server/src/schemas/`.
- [ ] **4.2.3** Wrap every message handler with the schema. On
  parse failure, send a `MESSAGE_REJECTED` error with the
  schema path that failed (so clients can show useful errors).
- [ ] **4.2.4** Add a fuzz test: throw 1000 random shapes at
  every message handler, assert none crash the room. Log the
  first 10 failures for debugging.
- [ ] **4.2.5** Document the schema files in
  `docs/protocol.md` (or a new `docs/message-schemas.md`).

### 4.3 Anti-cheat audit  [ ]
- [ ] **4.3.1** Identify the high-value hidden state: deck
  order, opponent card values, draw pile composition, internal
  bot RNG state. List it in `docs/security.md`.
- [ ] **4.3.2** Add a server test that compares the broadcast
  state (what a client sees) to the server's actual state. Fail
  on any field that leaks.
- [ ] **4.3.3** Audit the RNG: is the deck shuffle deterministic
  from the seed? Could a client replay past states to predict
  the next draw? Document the answer in `docs/security.md`.
- [ ] **4.3.4** Audit the bot: can a client tell which seats
  are bots vs. humans from timing? (Yes, probably. Document
  the leak and decide if it's a threat to fix.)

### 4.4 Middleware security  [ ]
- [ ] **4.4.1** Add `helmet` to the server deps. Configure it
  with the project's CSP (we serve an SPA, so the policy is
  fairly tight by default).
- [ ] **4.4.2** Add `cors` with an allow-list. Default to the
  deployment's known origins. Document the config in
  `docs/security.md`.
- [ ] **4.4.3** Add a body-size limit to the Colyseus transport
  (Colyseus has its own message size limits, but check).
- [ ] **4.4.4** Add a request logger middleware that logs
  method, path, status, duration. Use the Pino logger from 3.1.
- [ ] **4.4.5** Add a rate limiter on `/metrics` and `/healthz`
  (one we wired in 3.2.5) — make sure it survives under
  expected scrape rates but rejects bursts.
- [ ] **4.4.6** Document the threat model and the mitigations
  in `docs/security.md`.

---

## Cross-epic items

- [ ] **X.1** Update `TODO.md` to mark this log as the source of
  truth for production-readiness status.
- [ ] **X.2** Add `docs/scaling.md` and `docs/security.md` to
  the docs CI lint so they stay in sync.
- [ ] **X.3** Add a final verification run at the end of all
  four epics: the full matrix (server + web build/test/lint/smoke)
  on a clean tree, all 0 vulns, all green.

## Verifications applied to every shipped sub-goal

- `cd server && npm test` — 143+ tests pass
- `cd server && npm run build` — clean
- `cd web-react && npm run test:unit` — 19+ tests pass
- `cd web-react && npm run build` — clean
- `cd web-react && npm run lint` — 0 errors
- `cd web-react && xvfb-run -a npm run test:smoke` — pass
- `npm audit --omit=dev` in both — 0 vulns
- One commit per sub-goal, with verification log in the body
