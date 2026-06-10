# Audit Log

This file records the state of the recursive audit pass covering the web client
(`web-react/`) and the server (`server/`). It was originally written under
`web-react/AUDIT_LOG.md` and moved to the repository root on 2026-06-10 when
the audit was finalized and committed. Paths are written relative to the
repository root.

The corresponding TODO entry is at `TODO.md` → "Verified Audit Pass (2026-06-10)".

## Verified Fixes

- Fixed turn guidance and action callout text selection in `src/components/tableRoomControllerLogic.ts`.
- Removed duplicate `ActionCallout` type definitions by importing the shared type in `src/components/TableHandDock.tsx`.
- Hardened browser-only audio initialization in `src/audio/sfx.ts`.
- Validated persisted audio volume before applying it in `src/audio/sfx.ts`.
- Added explicit ambient soundscape teardown on table unmount in `src/components/useTableRoomController.ts`.
- Removed the redundant delayed timer in `src/components/HandCardItem.tsx`.
- Corrected stale-join handling in `src/main.tsx` and preserved valid rematch vote values via `src/stateSnapshot.ts`.
- Centralized browser storage access behind `src/storage.ts` and switched client call sites to use it.
- Hoisted tutorial content into `src/components/tableRoomModel.ts` to avoid repeated allocation on render.
- Updated docs in `README.md` and `DEVTOOLS.md` to match the current client behavior.
- Relaxed brittle AI-turn assertions in `server/test/uno.test.ts` to match valid server behavior.
- Cleared stale restart-timeout and rate-limit state in `server/src/rooms/UnoRoom.ts` and covered it with `server/test/uno-room.test.ts`.
- Cancelled in-progress rematch votes on disconnect in `server/src/rooms/UnoRoom.ts` and covered it with `server/test/uno-room.test.ts`.
- Added `server/src/rooms/DemoRoom.ts` lifecycle cleanup and fixed discard recycling so the visible top card is preserved, with coverage in `server/test/demo-room.test.ts`.
- Hardened `server/src/rooms/DemoRoom.ts` against duplicate tick timers during pause/resume cycles, with coverage in `server/test/demo-room.test.ts`.
- Removed a stale `DemoRoom.pickBestCard(...)` test call that was still using the old signature, so the replay selector regression now exercises the real active-color path.
- Fixed `server/src/rooms/DemoRoom.ts` to persist chosen wild colors onto the discard card in both the normal-play and draw-and-play replay paths, with coverage in `server/test/demo-room.test.ts`.
- Aligned `server/src/rooms/DemoRoom.ts` replay card selection with the shared strategy so same-value action cards are preferred over wilds when color does not match, with coverage in `server/test/demo-room.test.ts`.
- Tightened the AI/replay selection order so `draw2` is preferred over wilds when it is a legal action, with coverage in `server/test/uno.test.ts` and `server/test/demo-room.test.ts`.
- Extracted the shared best-card selector into `shared/gameLogic.ts` so `server/shared/uno.ts` and `server/src/rooms/DemoRoom.ts` both call the same source of truth instead of maintaining their own copies.
- Removed a no-op demo sync assignment in `server/src/rooms/DemoRoom.ts` so the replay state sync only performs meaningful updates.
- Simplified `src/audio/sfx.ts` browser-context typing so the module no longer relies on an `unknown` double-cast to find `AudioContext`.
- Removed the dead `playerIndex` return field from the `server/test/security.test.ts` room helper to reduce test harness noise.
- Renamed the shadowing `afterEach` cleanup helper in `server/test/security.test.ts` to `registerCleanup` so the test file reads more clearly.
- Made `createRoomWithHuman(...)` in `server/test/security.test.ts` self-register its teardown and removed the repeated cleanup registrations throughout the file.
- Introduced a typed mock-client helper in `server/test/security.test.ts` to reduce the repeated `as never`/`unknown as` client casts in the security coverage.
- Added a shared `server/test/testClients.ts` helper and switched the room/reconnection tests to it so mock client creation is centralized instead of being repeated inline.
- Extracted a `schemaHand(...)` helper in `server/src/rooms/UnoRoom.ts` to remove repeated `as unknown as` casts around the live schema hand data.
- Extracted a `resetRoundActionState()` helper in `server/src/rooms/UnoRoom.ts` so `onCreate` and `handleRestart` share the same pending-action/rematch reset logic.
- Added a shared `populateSchemaCard(...)` helper in `shared/gameLogic.ts` and switched both `server/src/rooms/UnoRoom.ts` and `server/src/rooms/DemoRoom.ts` to use it for schema card population.
- Extracted a `toSchemaCard(...)` helper in `server/src/rooms/DemoRoom.ts` to remove duplicated schema-card conversion logic from the replay sync path.
- Fixed `server/src/rooms/DemoRoom.ts` draw-and-play logic to honor legal draws and advance the turn correctly, with coverage in `server/test/demo-room.test.ts` and a cleanup of a brittle UNO-room fixture.
- Corrected `server/src/rooms/DemoRoom.ts` turn-history attribution so recorded actions use the acting seat, with coverage in `server/test/demo-room.test.ts`.
- Fixed `server/src/rooms/DemoRoom.ts` replay card selection so matching-color action cards are preferred over matching-color number cards, with coverage in `server/test/demo-room.test.ts`.
- Fixed `server/src/rooms/DemoRoom.ts` forced-draw history attribution so the drawn turn records the actual drawer, with coverage in `server/test/demo-room.test.ts`.
- Replaced placeholder reconnection stubs with an actual `server/test/reconnection.test.ts` coverage case.
- Removed the duplicated card-count styling helper from `src/components/TableSidePanel.tsx` in favor of the shared helper from `src/gameHelpers.ts`.
- Aligned client wild-draw-four validation with the shared server helper in `src/gameHelpers.ts` and added a regression in `tests/gameHelpers.test.ts`.
- Replaced the server umbrella `colyseus` dependency with direct `@colyseus/core` usage in `server/src/app.config.ts`, dropped the playground/monitor middleware, and cleared the server dependency audit.
- Added a direct `ws` dependency in the client `package.json` so the SDK resolves a patched websocket release, and cleared the client dependency audit.
- Removed the last `any`-based casts from `../shared/gameLogic.ts` by introducing a small shared card-shape helper.
- Reworked `server/test/security.test.ts` cleanup registration so room disposal runs through a suite-level hook instead of being registered inside each test body.
- Tightened `src/audio/sfx.ts` browser-global typing so the module no longer relies on an `any` cast for `AudioContext` lookup.
- Replaced the remaining private-field `any` casts in `server/test/uno-room.test.ts` and `server/test/security.test.ts` with explicit test-access types.
- Removed the explicit `any` suppression from the Colyseus connection error path in `src/main.tsx`.
- Removed the unused `topCard` parameter from `hasWildDrawFourAlternative` and cleaned the dependent call sites in `src/gameHelpers.ts` and `server/src/rooms/UnoRoom.ts`.
- Verified the latest shared-rule cleanup with `npm run test:unit` in the client and `npm run test` in the server.
- Collapsed `canPlay` and `canPlaySchema` onto a single normalized shared implementation in `../shared/gameLogic.ts`.
- Hardened `server/test/uno-room.test.ts` to clear inherited pending-draw/wild-challenge state before the draw-and-play regression runs.

## Verification Run

- `npm run build` in `../server`
- `npm run test:unit`
- `npm run build`
- `npm run lint`
- `xvfb-run -a npm run test:smoke`
- `npm run test` in `../server`
- `npm audit --omit=dev` in `../server`
- `npm audit --omit=dev` in `.` (client)
- `npm run test` in `../server` after the latest DemoRoom test cleanup
- `npm run build` in `../server` after the wild-color replay fix
- `npm run test` in `../server` after the wild-color replay fix
- `npm run build` in `../server` after the replay selector alignment
- `npm run test` in `../server` after the replay selector alignment
- `npm run build` in `../server` after the draw2 selector alignment
- `npm run test` in `../server` after the draw2 selector alignment
- `npm run build` in `../server` after the shared selector extraction
- `npm run test` in `../server` after the shared selector extraction
- `npm run build` in `../server` after the demo sync cleanup
- `npm run test` in `../server` after the demo sync cleanup
- `npm run build` in the client after the audio typing cleanup
- `npm run lint` in the client after the audio typing cleanup
- `npm run build` in `../server` after the security test helper cleanup
- `npm run test` in `../server` after the security test helper cleanup
- `npm run build` in `../server` after the cleanup helper rename
- `npm run test` in `../server` after the cleanup helper rename
- `npm run build` in `../server` after the schema-hand helper extraction
- `npm run test` in `../server` after the schema-hand helper extraction
- `npm run build` in `../server` after the round-action reset helper extraction
- `npm run test` in `../server` after the round-action reset helper extraction
- `npm run build` in `../server` after the DemoRoom schema-card helper extraction
- `npm run test` in `../server` after the DemoRoom schema-card helper extraction
- `npm run build` in `../server` after removing the unused `makeSilentTestClient` helper
- `npm run test` in `../server` after removing the unused `makeSilentTestClient` helper
- `npm run build` in `../server` after fixing the leave-path draw-lock bug
- `npm run test` in `../server` after fixing the leave-path draw-lock bug
- `npm run build` in `../server` after cleaning malformed-input security test casts
- `npm run test` in `../server` after cleaning malformed-input security test casts
- `npm run build` in `../server` after threading top-card value into AI/replay selector
- `npm run test` in `../server` after threading top-card value into AI/replay selector
- `npm run build` in `web-react` after removing the stale hand-sort memoization
- `npm run lint` in `web-react` after removing the stale hand-sort memoization
- `npm run test:unit` in `web-react` after removing the stale hand-sort memoization
- `xvfb-run -a npm run test:smoke` in `web-react` after removing the stale hand-sort memoization
- `npm run build` in `web-react` after removing the stale leave-confirmation phase branch
- `npm run lint` in `web-react` after removing the stale leave-confirmation phase branch
- `npm run test:unit` in `web-react` after removing the stale leave-confirmation phase branch
- `xvfb-run -a npm run test:smoke` in `web-react` after removing the stale leave-confirmation phase branch
- `npm run build` in `web-react` after normalizing malformed stats storage
- `npm run lint` in `web-react` after normalizing malformed stats storage
- `npm run test:unit` in `web-react` after normalizing malformed stats storage
- `xvfb-run -a npm run test:smoke` in `web-react` after normalizing malformed stats storage
- `npm run build` in `web-react` after fixing malformed stats history booleans
- `npm run lint` in `web-react` after fixing malformed stats history booleans
- `npm run test:unit` in `web-react` after fixing malformed stats history booleans
- `xvfb-run -a npm run test:smoke` in `web-react` after fixing malformed stats history booleans
- `npm run build` in `web-react` after removing the redundant stats history guard
- `npm run lint` in `web-react` after removing the redundant stats history guard
- `npm run test:unit` in `web-react` after removing the redundant stats history guard
- `xvfb-run -a npm run test:smoke` in `web-react` after removing the redundant stats history guard
- `npm run build` in `web-react` after removing the misleading UNO success toast
- `npm run lint` in `web-react` after removing the misleading UNO success toast
- `npm run test:unit` in `web-react` after removing the misleading UNO success toast
- `xvfb-run -a npm run test:smoke` in `web-react` after removing the misleading UNO success toast
- `npm run build` in `web-react` after collapsing side-panel type duplication
- `npm run lint` in `web-react` after collapsing side-panel type duplication
- `npm run test:unit` in `web-react` after collapsing side-panel type duplication
- `xvfb-run -a npm run test:smoke` in `web-react` after collapsing side-panel type duplication
- `npm run build` in `web-react` after hardening audio volume normalization
- `npm run lint` in `web-react` after hardening audio volume normalization
- `npm run test:unit` in `web-react` after hardening audio volume normalization
- `xvfb-run -a npm run test:smoke` in `web-react` after hardening audio volume normalization
- `npm run build` in `web-react` after rejecting empty stored audio volume strings
- `npm run lint` in `web-react` after rejecting empty stored audio volume strings
- `npm run test:unit` in `web-react` after rejecting empty stored audio volume strings
- `xvfb-run -a npm run test:smoke` in `web-react` after rejecting empty stored audio volume strings
- `npm run build` in `web-react` after resuming the audio context on user gesture
- `npm run lint` in `web-react` after resuming the audio context on user gesture
- `npm run test:unit` in `web-react` after resuming the audio context on user gesture
- `xvfb-run -a npm run test:smoke` in `web-react` after resuming the audio context on user gesture

## Remaining Risk Surface

- The server AI and room lifecycle are still more complex than the client, so future work should keep an eye on `server/shared/uno.ts` and `server/src/rooms/UnoRoom.ts`.
- Documentation should be kept aligned when lobby history, bot behavior, or rematch flow change.
- Additional audit passes are likely to produce smaller gains unless the server rules or client state model change.
- The audio settings path now clamps invalid values at both the UI and singleton boundary, and the regression is covered by `tests/sfx.test.ts`.
- Stored audio volume strings are now trimmed before parsing so empty or whitespace-only values do not silently zero out the volume.
- The ambient soundscape now explicitly resumes the `AudioContext` on user gesture, which closes the autoplay-gating gap for browsers that suspend contexts created on load.
