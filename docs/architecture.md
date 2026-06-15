# Architecture — StateView Policy & Information Hiding

## Overview

This document audits the `@colyseus/schema` class `UnoRoomState` for `StateView` opportunities. The goal is to ensure per-player-private data (hands, vote values) is hidden from other clients while global public data remains visible.

## Schema Field Classification

### `PlayerSchema` — Per-Player Fields

| Field | Type | Visibility | Rationale |
|-------|------|------------|-----------|
| `sessionId` | string | Public | Identity; required for client-to-server routing |
| `seatIndex` | number | Public | Position; all clients need turn order info |
| `name` | string | Public | Display name; shown in UI for all players |
| `isBot` | boolean | Public | Determines UI behavior (chat, controls) |
| `connected` | boolean | Public | Shown in lobby/status UI |
| `hand` | Array\<UnoCardSchema\> | **Private** (`view: true`) | Card details must not leak to opponents |
| `handCount` | number | Public | Safe proxy for hand size; no card details |

**StateView annotation:** `hand` has `view: true` (tag = -1). This means:
- Without a `StateView`, clients receive all fields
- With a `StateView`, only fields added via `client.view.add()` are visible
- `hand` is filtered out for clients who have NOT added this player's schema to their view

### `UnoRoomState` — Global Fields

| Field | Type | Visibility | Rationale |
|-------|------|------------|-----------|
| `players` | Map\<PlayerSchema\> | Public | Player list needed by all clients |
| `discardPile` | Array\<UnoCardSchema\> | Public | Played cards visible to all |
| `drawPileCount` | number | Public | Remaining deck size; no card details |
| `currentPlayer` | number | Public | Turn indicator |
| `direction` | number | Public | Play direction (1 or -1) |
| `activeColor` | string | Public | Current playable color |
| `pendingDraw` | number | Public | Stack draw count |
| `winner` | number | Public | Game outcome |
| `phase` | string | Public | Game phase |
| `turnDeadline` | number | Public | Turn timer synchronization |
| `spectatorCount` | number | Public | Lobby information |
| `chatMessages` | Array\<ChatMessageSchema\> | Public | Chat visible to all |
| `unoCaller` | number | Public | UNO call deadline indicator |
| `lastDrawnCardId` | string | Public | Card restriction enforcement |
| `wildDraw4ChallengePending` | boolean | Public | Challenge state indicator |
| `wildDraw4Illegal` | boolean | Public | Challenge legality flag |
| `wildDraw4OffenderSeat` | number | Public | Challenge target identification |
| `pendingWinnerSeat` | number | Public | Pending win state |
| `rematchVotes` | Array\<number\> | Public | Rematch vote tracking |

**No fields in `UnoRoomState` have `view: true`.** All global state is visible to all connected clients.

## StateView Lifecycle

### On Join (`UnoRoom.onJoin`)
```typescript
client.view = new StateView();
client.view.add(botPlayer);  // adds the player's own PlayerSchema
```
- Creates a new `StateView` for each joining client
- Adds only the client's own `PlayerSchema` to the view
- This makes `hand` visible to the client for their own seat only
- Other players' `hand` fields remain hidden

### On Card Draw (`UnoRoom.pushCardToHand`)
```typescript
player.hand.push(schemaCard);
client.view.add(schemaCard);  // each new card added individually
```
- New cards pushed to the hand must be individually added to the client's view
- Without this, newly drawn cards would be invisible to the drawing client
- This is a requirement of Colyseus schema v4: array items added after `view.add()` are not automatically visible

### On Leave (`UnoRoom.onLeave`)
```typescript
client.view = undefined;
```
- Cleans up the `StateView` reference to prevent memory leaks
- Client no longer receives any filtered state updates

## Spectators

Spectators do NOT receive a `StateView`:
- No `client.view = new StateView()` is called for spectator joins
- Spectators see the global `UnoRoomState` fields but NOT any player's `hand`
- This is correct: spectators should not see anyone's private hand

## Information Hiding Audit

### Correctly Hidden

1. **Card hand contents** (`PlayerSchema.hand`): Only the owning client sees their cards. Other clients see `handCount` (card count) but not the actual cards.

2. **Card identity in hand**: The `UnoCardSchema` within `hand` (id, cardType, color, value) is only visible to the owning client via StateView.

3. **Server-side draw pile**: The `drawPile` array (actual card instances) is kept as a server-only field (`private drawPile: UnoCard[]`), never exposed in the schema.

### Potential Information Leaks (Documented)

1. **`lastDrawnCardId`** — Card IDs follow the format `{color}_{value}_{uid}` (e.g., `red_5_123`). This field is visible to ALL clients, meaning opponents can observe:
   - That a card was drawn (timing)
   - The card's color and value (encoded in the ID)
   - **Impact**: When a player draws a card, all clients see exactly what card was drawn before it's played or discarded
   - **Mitigation**: Consider hashing card IDs or using opaque identifiers

2. **`wildDraw4Illegal`** — Visible to all clients before challenge resolution. Reveals whether the player had a matching color card when playing Wild Draw 4.
   - **Impact**: All clients know the offender's hand contained a matching color card
   - **Mitigation**: Consider hiding this field until challenge resolution

3. **`pendingWinnerSeat`** — Visible to all clients. Reveals which seat will win if certain challenge outcomes occur.

### Correctly Public (Safe to Expose)

- `handCount`: Only reveals card count, not card identity
- `drawPileCount`: Only reveals remaining deck size
- `unoCaller`: Indicates who needs to call UNO (game mechanic, not private)
- `rematchVotes`: Seat indices voting for rematch (no private card data)

## StateView Annotation Testing

The `view: true` annotation is stored in the schema's `Symbol.metadata`:

```typescript
const meta = PlayerSchema[Symbol.metadata];
// Field 5 (hand) has: { "type": {"view": true}, "index": 5, "name": "hand", "tag": -1 }
// Other fields have no "tag" property
```

- `tag: -1` (DEFAULT_VIEW_TAG) indicates the field is StateView-filtered
- Fields without a `tag` property are visible to all clients
- This metadata is used by the `Encoder` to filter fields during state synchronization

## Testing Strategy

See `server/test/stateView.test.ts` for:
1. Schema annotation verification (`hand` has `view: true`, others don't)
2. StateView lifecycle (created on join, cleaned on leave)
3. Card push-to-hand view registration
4. Spectator view absence
5. Field visibility classification validation
