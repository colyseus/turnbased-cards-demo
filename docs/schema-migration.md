# Schema Migration Strategy

## Overview

The Colyseus room state (`UnoRoomState`, `PlayerSchema`, `UnoCardSchema`) uses `@colyseus/schema` for efficient binary state synchronization. When game features require schema changes, follow this migration strategy to maintain backward compatibility.

## When to Migrate

Schema changes include:
- Adding new fields to `UnoRoomState`, `PlayerSchema`, or `UnoCardSchema`
- Renaming or removing existing fields
- Changing field types

## Versioning Strategy

Each schema version is tied to a release. Use the Colyseus `version` property on room registration:

```typescript
gameServer.define("uno", UnoRoom, { version: "1.0.1" });
```

## Migration Process

### 1. Add new fields (non-breaking)

New fields are automatically initialized to their TypeScript default (typically `0`, `""`, or `null`). Clients on older versions will ignore unknown fields.

```typescript
// Server: add to schema definition
this.state.newField = "default value";
```

### 2. Rename or remove fields (breaking)

**Step 1:** Deploy server with both old and new field names, running sync logic:
```typescript
// In onCreate() or a dedicated migration method:
if (旧字段存在 && !新字段存在) {
  迁移旧字段数据到新字段;
  删除旧字段;
}
```

**Step 2:** After all clients update, remove old field from schema entirely.

### 3. Client Compatibility

The `@colyseus/schema` encoder automatically handles missing fields on the client side by using default values. No client code changes are required for additive changes.

For type safety, regenerate TypeScript types from the schema:

```bash
npx colyseus-typegen schema --output src/schema/
```

## UnoRoomState Schema

```typescript
class UnoRoomState extends Schema {
  @type("string") phase: string = "waiting";
  @type("number") currentPlayer: number = 0;
  @type("number") direction: number = 1;      // 1 or -1
  @type("string") activeColor: string = "red";
  @type("number") winner: number = -1;
  @type("number") pendingDraw: number = 0;
  @type("number") turnDeadline: number = 0;   // Unix ms timestamp
  @type("number") drawPileCount: number = 0;
  @type([UnoCardSchema]) discardPile = new ArraySchema<UnoCardSchema>();
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
```

## PlayerSchema

```typescript
class PlayerSchema extends Schema {
  @type("string") sessionId: string = "";
  @type("number") seatIndex: number = 0;
  @type("string") name: string = "";
  @type("boolean") isBot: boolean = true;
  @type("boolean") connected: boolean = false;
  @type("number") handCount: number = 0;
  @type([UnoCardSchema]) hand = new ArraySchema<UnoCardSchema>();
}
```

## UnoCardSchema

```typescript
class UnoCardSchema extends Schema {
  @type("string") id: string = "";
  @type("string") cardType: string = "";  // "color" or "wild"
  @type("string") color: string = "";    // "" for wild cards
  @type("string") value: string = "";    // e.g. "5", "skip", "wild_draw4"
  @type("string") chosenColor: string = ""; // set when wild is played
}
```

## Testing Schema Changes

1. Start old client + new server: verify graceful degradation
2. Start new client + old server: verify no crashes
3. Run full gameplay test: verify game logic works across versions
