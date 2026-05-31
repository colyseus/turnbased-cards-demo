# Fresh Milestone Roadmap

> Goal: replace stale frontend/verification assumptions with a complete, current roadmap for the maintained DOM/CSS React UNO client, then execute the roadmap until every milestone has evidence.

## Milestone 1 - Verification Truth

Acceptance:
- CI runs when web, server, shared rules, or smoke-test files change.
- The browser smoke workflow installs both web and server dependencies before launching the full-stack smoke test.
- Server CI runs when shared rules change.

Tasks:
- [x] Update Client CI path filters for `web-react/`, `server/`, `shared/`, and `scripts/smoke-web-agent-browser.sh`.
- [x] Update Client CI smoke job to install `server/` dependencies before running the root smoke script.
- [x] Update Server CI path filters to include `shared/`.
- [x] Verify CI YAML remains syntactically valid.

## Milestone 2 - Current Documentation

Acceptance:
- Top-level docs describe the maintained React DOM/CSS client, not the retired R3F frontend.
- Quickstart documents what the browser smoke test actually does and where screenshots are written.
- The correctness baseline points at current tests and runtime gates.

Tasks:
- [x] Update `README.md`.
- [x] Update `web-react/README.md`.
- [x] Update `QUICKSTART.md`.
- [x] Replace stale R3F correctness notes in `docs/goal-card-demo-correctness.md`.

## Milestone 3 - Autoplay and Rule Coverage

Acceptance:
- Server tests can autoplay games to completion.
- Server tests cover turn-limit exhaustion.
- Room-level tests exercise bot-driven progress.
- Security tests reject malformed card input.

Tasks:
- [x] Keep `autoPlayGame` coverage in `server/test/uno.test.ts`.
- [x] Keep room-level bot completion coverage in `server/test/uno-room.test.ts`.
- [x] Keep malformed card rejection coverage in `server/test/security.test.ts`.
- [x] Run the full server test suite.

## Milestone 4 - Browser Runtime Smoke

Acceptance:
- The approved `agent-browser` smoke test starts the full stack.
- Desktop and mobile sessions join a live table.
- The smoke test attempts a real play or draw.
- Relevant browser console/page errors fail the script.
- Screenshots are written for review.

Tasks:
- [x] Run `./scripts/smoke-web-agent-browser.sh`.
- [x] Confirm desktop screenshots are produced.
- [x] Confirm mobile screenshots are produced.

## Milestone 5 - Completion Gate

Acceptance:
- Server tests pass.
- Server typecheck/build passes.
- Web lint passes.
- Web build passes.
- Browser smoke passes.
- This roadmap is updated with executed status and evidence.

Tasks:
- [x] Run `cd server && npm test`.
- [x] Run `cd server && npm run build`.
- [x] Run `cd web-react && npm run lint`.
- [x] Run `cd web-react && npm run build`.
- [x] Run `./scripts/smoke-web-agent-browser.sh`.
- [x] Update this file with final evidence.

## Evidence

Fresh verification on 2026-05-30 after the final whitespace cleanup:

- `cd server && npm test` passed: 4 test files, 125 tests.
- `cd server && npm run build` passed.
- `cd web-react && npm run lint` passed.
- `cd web-react && npm run build` passed.
- `./scripts/smoke-web-agent-browser.sh` passed and wrote desktop/mobile screenshots under `.tmp-agent-browser/`.
- `ls -l .tmp-agent-browser/web-react-game-{desktop,mobile}-*.png` confirmed the six expected screenshots exist with nonzero file sizes.
- `git diff --check` passed.
- `python3`/PyYAML parsed `.github/workflows/client.yml` and `.github/workflows/server.yml`.
