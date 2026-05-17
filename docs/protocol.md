# Colyseus Protocol Documentation

## Room Name
`uno`

## Client-to-Server Messages

### `play_card`
Play a card from the player's hand onto the discard pile.

```typescript
{
  cardId: string;        // ID of the card to play
  chosenColor?: string;   // Required for wild cards: "red" | "blue" | "green" | "yellow"
}
```

**Validation (server-side):**
- Player must be the current player
- `cardId` must be a string ≤ 64 characters
- Card must exist in the player's hand
- Card must be legally playable (matches active color or top card value, or is a wild)
- For `wild_draw4`: player must have NO matching color cards AND NO matching value cards (enforced server-side)
- `chosenColor` must be one of: `red`, `blue`, `green`, `yellow` (if provided)
- Rate limit: max 1 action per 300ms per session

**Response:** State update broadcast to all clients via Colyseus state sync.

---

### `draw_card`
Draw from the draw pile. If `pendingDraw > 0`, draws the pending count; otherwise draws 1 card.

```typescript
// No payload required
```

**Validation (server-side):**
- Player must be the current player
- Rate limit: max 1 action per 300ms per session

**Effect:** Player draws cards, turn passes to next player.

---

### `restart`
Restart the game (after it has finished, or in bot-only dev mode).

```typescript
// No payload required
```

**Validation (server-side):**
- Player must be connected
- Game must be in `finished` phase, or all players are bots (dev mode)

---

## Server-to-Client State

The Colyseus room state (`UnoRoomState`) is the source of truth. Clients receive state updates automatically via the `@colyseus/react` hook `useRoomState`.

### State Schema

```typescript
interface UnoRoomState {
  phase: "waiting" | "playing" | "finished";
  currentPlayer: number;     // 0-3 seat index
  direction: 1 | -1;        // 1 = clockwise, -1 = counter-clockwise
  activeColor: string;       // "red" | "blue" | "green" | "yellow"
  winner: number;            // -1 = none, 0-3 = winner's seat
  pendingDraw: number;       // Stacked draw count (draw2=+2, draw4=+4)
  turnDeadline: number;      // Unix timestamp (ms) when turn expires
  drawPileCount: number;    // Cards remaining in draw pile
  discardPile: UnoCardSchema[];
  players: Map<string, PlayerSchema>;
}
```

### Player Schema

```typescript
interface PlayerSchema {
  sessionId: string;
  seatIndex: number;        // 0-3
  name: string;
  isBot: boolean;
  connected: boolean;
  hand: UnoCardSchema[];   // Private — only synced to that player's StateView
  handCount: number;        // Public count for all players
}
```

### Card Schema

```typescript
interface UnoCardSchema {
  id: string;               // Unique card ID (e.g. "red_5_0")
  cardType: "color" | "wild";
  color: string;            // "" for wild cards
  value: string;            // e.g. "5", "skip", "draw2", "wild", "wild_draw4"
  chosenColor: string;      // Set when a wild card is played
}
```

## Private State (StateView)

Each player has a private `StateView` that includes their own full hand. This prevents players from seeing opponents' cards.

```typescript
// Server-side (UnoRoom.ts)
client.view = new StateView();
client.view.add(botPlayer);  // Only the player's own hand is added
```

## Turn Flow

1. `scheduleTurn()` sets `turnDeadline = Date.now() + HUMAN_TURN_TIMEOUT_MS` (or `BOT_TURN_DELAY_MS` for bots)
2. Human must act within timeout (default 7s)
3. If no action: `botTurn()` fires via `setTimeout`
4. For bots: `botTurn()` runs immediately after `BOT_TURN_DELAY_MS` (default 800ms)

## Wild Draw Four Rule

The server enforces the standard rule: a player may only play `wild_draw4` if they have **no** cards matching the active color AND **no** cards matching the top card's value. This check is done in `handlePlayCard`.

## Reconnection

When a player disconnects:
1. Their seat is converted to a bot (hand preserved)
2. `client.view = undefined` cleans up the StateView
3. `seatsHandedToBot` tracks abandoned seats

When a player reconnects:
1. If returning to their own seat (detected via `seatsHandedToBot`), the game continues as-is
2. If taking a different bot seat, the seat is reset

## Rate Limiting

Each player session is limited to 1 game action per `ACTION_COOLDOWN_MS` (default 300ms). Excess messages are silently dropped server-side.
