# Troubleshooting Guide

## Connection Issues

### "Failed to connect" error

1. **Check the WebSocket URL**: Ensure `VITE_WS_URL` points to the correct server (e.g. `ws://localhost:2567` for development)
2. **Server is not running**: Start the server with `npm run dev` in the `server/` directory
3. **Port blocked**: Ensure port 2567 is accessible (check firewall rules)

### "Room not found" when joining by code

1. The room code may have expired (rooms persist until all players leave)
2. The room may have completed a game and restarted — try rejoining
3. Check for typos in the room code

---

## Gameplay Issues

### Cards don't play when clicked

1. **Wrong turn**: You can only play when `state.currentPlayer === your seat`
2. **No matching cards**: Your hand has no cards matching the active color or top card value
3. **Pending draw**: You must draw cards (click the draw pile) before playing when `pendingDraw > 0`
4. **Rate limit**: Wait 300ms between actions

### Draw pile not responding to clicks

1. Only the current player can draw
2. If `pendingDraw > 0`, you must draw the stacked count (not a voluntary draw)
3. The invisible click mesh may be blocked by another element — try clicking the center of the draw pile

### Bot doesn't play automatically

1. Check the bot turn delay (`BOT_TURN_DELAY` env var, default 800ms)
2. If a bot's turn times out, it should draw a card

### Turn expires immediately

1. Check `HUMAN_TURN_TIMEOUT` env var (default 7000ms = 7 seconds)
2. Ensure the server is not overloaded
3. Check network latency — consider increasing the timeout for mobile players

---

## Build & Type Errors

### `Cannot find name 'process'`

This happens when `server/shared/constants.ts` is referenced from `web-react` without `@types/node`. The `process.env` evaluation has been moved to `UnoRoom.ts` inline. If you still see this error, ensure you're running `npm run build` from the correct directory.

### Vitest tests fail with import errors

Run `npm test -- --no-cache` to clear Vitest's cache and force recompilation.

### ESLint errors after pulling

Run `npm install` in `web-react/` to ensure all ESLint peer dependencies are installed.

---

## Known Edge Cases

### Player disconnects during their turn

The seat is taken over by a bot. If the player reconnects to the same seat, the turn continues as-is (no deadline reset). If they reconnect to a different seat, that seat becomes the new bot.

### Two players leave simultaneously

Each seat is handled independently. The game continues as long as at least one bot seat remains.

### wild_draw4 played illegally

The server enforces the rule: if a player has a matching color or value, they cannot play `wild_draw4`. This is checked server-side and the play is rejected silently.

---

## Performance

### High latency in 3D rendering

1. Enable the FPS counter (top-right corner)
2. If FPS < 30, try reducing window size
3. Three.js bundle is large (724KB) — this is expected for 3D WebGL games

### Memory leak symptoms

If the game runs for many rounds and memory grows:
1. Check that `client.view = undefined` is being called on disconnect
2. Check that `clearTimeout(this.turnTimeout)` is called in `onDispose`

---

## Getting Help

1. Check the [Colyseus documentation](https://docs.colyseus.io/)
2. Check the [GitHub Issues](https://github.com/grantjr1842/turnbased-cards-demo/issues)
3. Run with `LOG_LEVEL=debug` for detailed server logs
