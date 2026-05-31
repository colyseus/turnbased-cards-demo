# Card Demo Correctness Baseline

This file records the current correctness baseline for the maintained web demo.

## Current Architecture

- The maintained frontend is `web-react/`, a React DOM/CSS client.
- The authoritative multiplayer server is `server/`, powered by Colyseus.
- Shared rule helpers live in `shared/` and `server/shared/`.
- The old R3F/Three.js frontend issues are retired because the current frontend no longer uses Three.js.

## Acceptance Gates

- Server game-logic tests pass, including full-game autoplay completion and turn-limit exhaustion.
- Room-level tests pass for bot turns and repeated game completion.
- Invalid/malformed card inputs are rejected by shared play validation.
- The React client builds and lints.
- The browser smoke test starts the server and client, joins a live table on desktop and mobile, attempts a real play/draw action, captures screenshots, and fails on relevant browser console/page errors.

## Verification Commands

```bash
cd server && npm test
cd server && npm run build
cd web-react && npm run lint
cd web-react && npm run build
./scripts/smoke-web-agent-browser.sh
```
