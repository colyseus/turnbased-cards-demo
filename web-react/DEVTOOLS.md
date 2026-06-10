# DevTools Guide

This file captures the current client-side debugging and verification workflow for the UNO web app.

## Common Checks

- `npm run build` - Type-checks and creates a production bundle.
- `npm run lint` - Runs `oxlint` across the client.
- `npm run test:unit` - Runs the node test suite in `tests/*.test.ts`.
- `npm run test:smoke` - Runs the browser smoke script against a live game server on port `2567`.

## Smoke Testing

The smoke script does not start the game server for you. Start the server separately, then run the client smoke against it.

If the environment has no display server, wrap the smoke run with `xvfb-run`:

```bash
xvfb-run -a npm run test:smoke
```

The smoke runner writes screenshots and stitched media to `../.tmp-agent-browser/`.

## Browser Debugging

- The client persists local preferences in `localStorage` using `uno_*` keys.
- The table UI depends on a live Colyseus room connection and the shared schema from `../shared/`.
- When inspecting UI regressions, check the smoke screenshots first, then re-run the relevant browser flow locally.

## Notes

- This repository is a 2D React client, not a 3D scene. Older generic debugging notes are no longer applicable.
- Keep client behavior aligned with the shared server/game logic whenever gameplay rules change.
