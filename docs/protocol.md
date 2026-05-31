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

### `uno`
Call UNO when a player has exactly one card remaining. If a player fails to call UNO before acting, a 2-card penalty is applied to the next player.

```typescript
// No payload required
```

**Validation (server-side):**
- Player must be the current `unoCaller` (i.e., player must have exactly 1 card and must not have already called UNO)

**Effect:** Clears the `unoCaller` state flag. If the player fails to call UNO in time, the next player draws 2 cards as a penalty.

---

### `vote_rematch`
Vote to restart the game after it has finished. When all connected human players have voted, the game restarts automatically.

```typescript
// No payload required
```

**Validation (server-side):**
- Player must be a human (not a bot)
- Game must be in `finished` phase

**Effect:** Adds the player's seat index to `rematchVotes`. When all connected human players have voted, the game restarts automatically with `handleRestart`.

---

### `chat`
Send a chat message to all players and spectators in the room.

```typescript
{
  text: string;  // 1-200 characters, sanitized server-side
}
```

**Validation (server-side):**
- Player or spectator must be in the room
- `text` must be a non-empty string ≤ 200 characters
- Content is sanitized via DOMPurify to prevent XSS

**Response:** Chat message broadcast via state sync at `state.chatMessages`. Messages are stored in a rolling buffer of up to 50 messages.

**Chat message format (broadcast):**
```typescript
{
  sender: string;     // Player name or "Spectator (XXXX)"
  text: string;       // Sanitized message text
  timestamp: number;  // Unix timestamp (ms)
}
```

---

### `ping`
Keep-alive message. The server responds with a `pong` message.

```typescript
// No payload required
```

**Server response:**
```typescript
"pong"  // string literal, sent directly to the requesting client
```

**Use case:** Clients can send `ping` to keep their connection alive and detect network issues. This is especially useful for spectators who may have long idle periods.

---

## Server-to-Client Messages

### `error`
Error message sent to a specific client when a game action fails.

```typescript
{
  message: string;  // Human-readable error description
  code: string;     // Error code (e.g., "NOT_YOUR_TURN", "PLAY_CARD_ERROR")
}
```

---

### `pong`
Response to `ping` keep-alive message. Sent directly to the client, not via state sync.

```typescript
// string literal "pong"
```

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
  spectatorCount: number;    // Number of spectators watching the game
  chatMessages: ChatMessageSchema[];  // Rolling buffer of up to 50 messages
  unoCaller: number;         // Seat index that must call UNO; -1 if not applicable
  rematchVotes: number[];    // Seat indices that have voted to rematch
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

### Chat Message Schema

```typescript
interface ChatMessageSchema {
  sender: string;     // Player name, or "Spectator (XXXX)" for spectators
  text: string;       // Sanitized message text (max 200 chars)
  timestamp: number;  // Unix timestamp (ms) when sent
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

### `turnActionActive` Guard

The `turnActionActive` flag prevents the `botTurn()` callback from firing while a human player is actively processing a turn. This avoids race conditions where a scheduled botTurn would fire during an in-progress human turn action.

## UNO Call Rule

When a player plays their second-to-last card and reaches exactly 1 card remaining:
1. `unoCaller` is set to that player's seat index (for human players; bots auto-clear it)
2. The player must send the `uno` message before the next player acts
3. If the player fails to call UNO in time, the next player draws 2 cards as a penalty
4. Calling UNO clears the `unoCaller` flag

## Rematch Voting

After the game ends (`phase: "finished"`):
1. Human players can send `vote_rematch`
2. Each player's seat index is added to `rematchVotes` (duplicates are ignored)
3. When **all connected human players** have voted, the game restarts automatically
4. `handleRestart` clears all hands, the discard pile, `rematchVotes`, and re-deals

## Wild Draw Four Rule

The server enforces the standard rule: a player may only play `wild_draw4` if they have **no** cards matching the active color AND **no** cards matching the top card's value. This check is done in `handlePlayCard`.

## Card Stacking Rules

When `pendingDraw > 0` (cards are stacked), the following stacking rules apply:

### Draw2 Stacking
- When the top card is `draw2` and `pendingDraw >= 2`:
  - Only `draw2` cards can be played on top
  - Playing `draw2` adds +2 to `pendingDraw` (stacking)
  - `draw2` cannot stack on `wild_draw4`

### Wild Draw4 Stacking
- When the top card is `wild_draw4` and `pendingDraw >= 4`:
  - Only `wild_draw4` cards can be played on top (stacking continues)
  - Playing `wild_draw4` adds +4 to `pendingDraw`
- When `pendingDraw < 4`: `wild_draw4` cannot be played as a stack; the player must have no valid alternatives to play it at all

### Summary Table

| Top Card     | pendingDraw | Can Play            | Effect               |
|--------------|-------------|---------------------|----------------------|
| draw2        | >= 2        | draw2               | pendingDraw += 2      |
| draw2        | 0           | color match or wild | pendingDraw = 2      |
| wild_draw4   | >= 4        | wild_draw4          | pendingDraw += 4      |
| wild_draw4   | 0           | wild only (no alts) | pendingDraw = 4      |
| any          | > 0         | draw2 on draw2       | pendingDraw += 2     |
| any          | > 0         | wild_draw4 on draw4 | pendingDraw += 4     |
| any          | > 0         | draw2 on wild_draw4 | NOT ALLOWED          |

## Room Options (onCreate)

### Spectator Join
Clients can join as spectators without taking a seat:

```typescript
// Client-side
room.join({ spectator: true });
```

Spectators:
- Can watch the game via state sync
- Can send chat messages
- Can send `ping` for keep-alive
- Do not count toward player limit or bot replacement
- See their session ID (truncated) as their display name in chat

### Private Room
Rooms can be made private (hidden from listing):

```typescript
// Server-side (onCreate options)
room = await colyseus.createRoom("uno", { private: true });
```

### Room Password
Rooms can be protected with a password:

```typescript
// Server-side
room = await colyseus.createRoom("uno", { password: "secret" });

// Client-side
room = await colyseus.join("uno", { password: "secret" });
```

- Password must be ≤ 32 characters
- Invalid password throws an error on join

### Difficulty
Bot difficulty can be set on room creation:

```typescript
// Server-side
room = await colyseus.createRoom("uno", { difficulty: "hard" });
```

Available levels:
- `"easy"`: Bots pick random playable cards
- `"medium"` (default): Bots pick strategic cards and colors
- `"hard"`: Bots additionally track discarded cards to inform decisions

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
