# Security Model — UNO Card Game Server

This document describes the server-side security model for the UNO card game, focusing on information hiding, anti-cheat measures, and known limitations.

## Threat Model

**Adversary:** A malicious client that can:
- Send arbitrary messages to the server
- Inspect all data received from the server
- Attempt to infer hidden game state from public information

**Goal:** Prevent clients from gaining an unfair advantage by accessing hidden state (deck order, opponent hand contents, draw pile composition).

## Information Architecture

### Hidden State (Server-Only)

| Data | Storage | Client Visibility |
|------|---------|-------------------|
| Draw pile card order | `UnoRoom.drawPile` (plain JS array) | **None** — not in schema |
| Opponent hand contents | `PlayerSchema.hand` (`view: true`) | **Self only** — StateView tag `-1` |
| Bot RNG seed/state | `Math.random()` | **None** — server-local |
| Bot difficulty setting | `UnoRoom.difficulty` | **None** — not in schema |
| Discarded card counts (hard mode) | `UnoRoom.discardedCounts` | **None** — not in schema |

### Public State (Visible to All Clients)

| Data | Schema Field | Notes |
|------|-------------|-------|
| Draw pile card count | `drawPileCount` | Count only, no card data |
| Discard pile contents | `discardPile` | All discarded cards visible (standard UNO) |
| Current player | `currentPlayer` | Seat index 0-3 |
| Play direction | `direction` | 1 or -1 |
| Active color | `activeColor` | Current playable color |
| Pending draw count | `pendingDraw` | Cards to draw on next turn |
| Winner | `winner` | -1 = none, 0-3 = winner seat |
| Game phase | `phase` | "waiting" / "playing" / "finished" |
| Hand counts | `handCount` (per player) | Card count for all players |
| Spectator count | `spectatorCount` | Number of spectators |
| Chat messages | `chatMessages` | Sanitized text |
| UNO caller | `unoCaller` | Seat that must call UNO |
| Rematch votes | `rematchVotes` | Seat indices that voted |

## StateView Mechanism

Colyseus `StateView` provides per-client field visibility:

1. **`PlayerSchema.hand`** is annotated with `view: true`, which sets a `-1` tag in the schema metadata.
2. When a human player joins, a `StateView` is created and assigned to `client.view`.
3. The player's own `PlayerSchema` instance is added to their view: `client.view.add(player)`.
4. The Colyseus sync layer uses this view to filter which fields are sent to each client.
5. **Only the player's own hand** is included in their view — opponents' hands are excluded.
6. **Spectators** receive no `StateView` and see only the raw schema (which already hides `hand` via the view tag).
7. **Bot players** have no client, so no `StateView` is ever created for them.

### View Lifecycle

- **Join:** `client.view = new StateView(); client.view.add(player);`
- **Card drawn:** `client.view.add(schemaCard)` — new cards must be explicitly added to the view
- **Leave:** `client.view = undefined;` — prevents memory leaks

## Known Information Leak Points

### 1. `lastDrawnCardId` (Severity: Low)

**What leaks:** The card ID of the card drawn this turn is visible to all clients.

**Impact:** Opponents know the identity of the drawn card (via its ID string), but this is limited to a single card per turn. In standard UNO, drawn cards are typically visible to the drawer anyway.

**Mitigation:** The drawn card is only locked in as "must play this card" — opponents cannot act on this information directly. The `DRAWN_CARD_ONLY` error is only sent to the active player.

### 2. `wildDraw4Illegal` (Severity: Low-Medium)

**What leaks:** When a Wild Draw 4 is played, all clients see whether it was illegal (player had a matching color card in hand).

**Impact:** This is intentional game mechanics — the Wild Draw 4 challenge rule requires this information for the challenge system. The value is set after the card is played and the turn advances.

**Mitigation:** The value is set server-side after `isWildDraw4Illegal()` checks the offender's hand. No client can request this value — it's published as part of the game state.

### 3. `handCount` (Severity: Very Low)

**What leaks:** Real-time hand size for all players is visible to everyone.

**Impact:** Standard UNO behavior — hand counts are always public knowledge. This allows opponents to track when a player is close to winning (1 card = UNO).

**Mitigation:** None needed — this is expected game behavior.

### 4. `discardPile` (Severity: None)

**What leaks:** All played cards are visible in the discard pile.

**Impact:** None — standard UNO rules require all players to see all played cards.

## Anti-Cheat Test Coverage

The `antiCheat.test.ts` file verifies:

1. **Draw pile isolation** — draw pile is not in schema, order not determinable from public state
2. **Opponent hand isolation** — StateView prevents cross-player hand visibility
3. **Known leak points** — documents which fields are intentionally public
4. **State snapshot comparison** — client view matches expected visible state
5. **Bot RNG isolation** — bot decisions not predictable, difficulty not exposed
6. **Card count conservation** — total cards (108) conserved across all state transitions

## Recommendations for Future Hardening

1. **Consider masking `lastDrawnCardId`** — could be replaced with a boolean `hasDrawnCard` flag, with the actual card ID only sent to the active player via an encrypted message.

2. **Obfuscate `wildDraw4Illegal` timing** — the illegality flag is set immediately after the play; consider delaying the reveal until the challenge window closes.

3. **Add rate limiting per message type** — already implemented via `RateLimiter` class (see `security.test.ts`).

4. **Validate all client inputs** — already implemented via Zod schemas (`playCardSchema`, `chatSchema`) and manual validation in handlers.

5. **Sanitize chat content** — already implemented via `sanitizePlainText()` with DOMPurify-style stripping.

## Schema Annotations Reference

```typescript
// PlayerSchema — hand is private (view tag -1)
export const PlayerSchema = schema({
  sessionId: "string",        // public
  seatIndex: "number",        // public
  name: "string",             // public
  isBot: "boolean",           // public
  connected: "boolean",       // public
  hand: { array: UnoCardSchema, view: true },  // PRIVATE
  handCount: "number",        // public
});

// UnoRoomState — no view tags (all fields public or not in schema)
export const UnoRoomState = schema({
  players: { map: PlayerSchema },
  discardPile: { array: UnoCardSchema },
  drawPileCount: "number",    // count only
  // drawPile: NOT IN SCHEMA — server-only
  // difficulty: NOT IN SCHEMA — server-only
  // discardedCounts: NOT IN SCHEMA — server-only
  // ...
});
```

## References

- [Colyseus StateView documentation](https://docs.colyseus.io/state/view/)
- [Colyseus Schema annotations](https://docs.colyseus.io/schema/)
- See also: `server/test/stateView.test.ts` for schema annotation tests
- See also: `server/test/security.test.ts` for input validation tests
