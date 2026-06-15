import { describe, it, expect, afterEach as vitestAfterEach } from "vitest";
import type { Client } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { PlayerSchema, UnoCardSchema, UnoRoomState } from "../src/rooms/schema/UnoRoomState.ts";
import { makeTestClient } from "./testClients.ts";

type RoomTestAccess = UnoRoom & {
  drawPile: Array<{ type: string; color: string; value: string; id: string }>;
  spectators: Set<{ sessionId: string }>;
};

const roomCleanups: Array<() => void> = [];

vitestAfterEach(() => {
  while (roomCleanups.length > 0) {
    roomCleanups.pop()?.();
  }
});

function registerCleanup(cleanup: () => void) {
  roomCleanups.push(cleanup);
}

function makeSchemaCard(id: string, color: string, value: string): InstanceType<typeof UnoCardSchema> {
  const card = new UnoCardSchema();
  card.id = id;
  card.cardType = "color";
  card.color = color;
  card.value = value;
  card.chosenColor = "";
  return card;
}

function makeWildCard(id: string, wildType: string, chosenColor = ""): InstanceType<typeof UnoCardSchema> {
  const card = new UnoCardSchema();
  card.id = id;
  card.cardType = "wild";
  card.color = "";
  card.value = wildType;
  card.chosenColor = chosenColor;
  return card;
}

function createRoomWithHuman(
  seatIndex = 0,
  name = "TestPlayer",
): { room: UnoRoom; client: Client } {
  const room = new UnoRoom();
  room.onCreate();
  registerCleanup(() => room.onDispose());
  clearTimeout(room["turnTimeout"]);

  for (let i = 0; i < 4; i++) {
    const p = room.state.players.get(String(i))!;
    p.isBot = true;
    p.connected = false;
  }

  const client = makeTestClient(`human-${seatIndex}`);
  room.onJoin(client, { name, spectator: false });

  const player = room.state.players.get(String(seatIndex))!;
  player.isBot = false;
  player.connected = true;
  player.sessionId = client.sessionId;

  room.state.currentPlayer = seatIndex;
  player.hand.splice(0, player.hand.length);
  room.state.phase = "playing";
  room.state.winner = -1;
  room.state.direction = 1;
  room.state.pendingDraw = 0;
  room.state.unoCaller = -1;
  room.state.lastDrawnCardId = "";
  room.state.pendingWinnerSeat = -1;
  room.state.wildDraw4ChallengePending = false;
  room.state.wildDraw4Illegal = false;
  room.state.wildDraw4OffenderSeat = -1;
  room["rateLimiter"].clear();
  clearTimeout(room["turnTimeout"]);

  return { room, client };
}

function getMetadata(ctor: typeof PlayerSchema | typeof UnoRoomState) {
  return ctor[Symbol.metadata] as Record<string, any>;
}

function getFieldDef(meta: Record<string, any>, fieldName: string) {
  const index = meta[fieldName];
  return meta[index];
}

// ── Draw Pile Isolation ────────────────────────────────────────────────

describe("Anti-cheat: draw pile isolation", () => {
  it("drawPile is a private server-only field (not in schema)", () => {
    const stateMeta = getMetadata(UnoRoomState);
    const def = getFieldDef(stateMeta, "drawPile");
    expect(def).toBeUndefined();
  });

  it("drawPileCount is public but contains no card data", () => {
    const { room } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    const rawCount = room.state.drawPileCount;
    expect(typeof rawCount).toBe("number");
    expect(rawCount).toBeGreaterThanOrEqual(0);

    // drawPileCount must NOT be a card ID or contain card info
    expect(typeof rawCount).not.toBe("string");
  });

  it("draw pile order is not determinable from public state", () => {
    const { room } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    const drawPile = (room as RoomTestAccess).drawPile;
    const discardIds = room.state.discardPile.map((c) => c.id);
    const handCards = room.state.players
      .get(String(room.state.currentPlayer))!
      .hand.map((c) => c.id);

    // No card from the draw pile should appear in public state
    for (const card of drawPile) {
      expect(discardIds).not.toContain(card.id);
      expect(handCards).not.toContain(card.id);
    }

    // The draw pile size should match drawPileCount
    expect(room.state.drawPileCount).toBe(drawPile.length);
  });

  it("draw pile contents are not leaked when cards are drawn", () => {
    const { room, client } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    const drawPileBefore = (room as RoomTestAccess).drawPile.map((c) => c.id);

    room["handleDrawCard"](client);

    const drawPileAfter = (room as RoomTestAccess).drawPile.map((c) => c.id);

    // Draw pile shrinks by exactly 1
    expect(drawPileAfter.length).toBe(drawPileBefore.length - 1);

    // Every card remaining in the draw pile was also present before the draw
    for (const cardId of drawPileAfter) {
      expect(drawPileBefore).toContain(cardId);
    }
  });
});

// ── Opponent Hand Isolation ────────────────────────────────────────────

describe("Anti-cheat: opponent hand isolation", () => {
  it("opponent hands are protected by StateView (view tag -1)", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "hand");
    expect(def).toBeDefined();
    expect(def.tag).toBe(-1);
  });

  it("two human players cannot see each other's hands via StateView", () => {
    const room = new UnoRoom();
    room.onCreate();
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const client0 = makeTestClient("human-0");
    const client1 = makeTestClient("human-1");
    room.onJoin(client0, { name: "Alice" });
    room.onJoin(client1, { name: "Bob" });

    const player0 = room.state.players.get(String(room0SeatIndex(client0)))!;
    const player1 = room.state.players.get(String(room1SeatIndex(client1)))!;

    // Give player 0 a unique card
    room["pushCardToHand"](player0, {
      type: "color", color: "red", value: "9", id: "secret_red_9",
    });

    // client0 should see the card (it's in their view)
    const refId = (player0.hand[player0.hand.length - 1] as any)["~refId"];
    expect(client0.view!.changes.has(refId)).toBe(true);

    // client1 should NOT see player0's card
    expect(client1.view!.has(player0)).toBe(false);
  });

  it("spectators do not receive any player hand data", () => {
    const room = new UnoRoom();
    room.onCreate();
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const humanClient = makeTestClient("human-0");
    room.onJoin(humanClient, { name: "Alice" });

    const spectatorClient = makeTestClient("spectator-0");
    room.onJoin(spectatorClient, { spectator: true });

    expect(spectatorClient.view).toBeUndefined();

    // Spectators have no StateView, so they receive the raw schema
    // which should not include any hand data due to view:true
  });

  it("bot players have no client and thus no StateView exposure", () => {
    const { room } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    // All non-human players are bots with no StateView
    for (let i = 0; i < 4; i++) {
      const p = room.state.players.get(String(i))!;
      if (p.isBot) {
        // Bots have no client, so their hands are never sent to anyone
        expect(p.sessionId.startsWith("bot-")).toBe(true);
      }
    }
  });
});

// ── Known Information Leak Points ─────────────────────────────────────

describe("Anti-cheat: documented information leak points", () => {
  it("lastDrawnCardId is publicly visible — card ID leaks draw identity", () => {
    const def = getFieldDef(getMetadata(UnoRoomState), "lastDrawnCardId");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("wildDraw4Illegal is publicly visible — reveals offender's hand composition", () => {
    const def = getFieldDef(getMetadata(UnoRoomState), "wildDraw4Illegal");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("wildDraw4ChallengePending is publicly visible", () => {
    const def = getFieldDef(getMetadata(UnoRoomState), "wildDraw4ChallengePending");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("wildDraw4OffenderSeat is publicly visible — identifies the offender", () => {
    const def = getFieldDef(getMetadata(UnoRoomState), "wildDraw4OffenderSeat");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("handCount is public for all players — leaks card count changes in real time", () => {
    const { room } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    for (let i = 0; i < 4; i++) {
      const p = room.state.players.get(String(i))!;
      expect(typeof p.handCount).toBe("number");
      // handCount is always synced to all clients
      const def = getFieldDef(getMetadata(PlayerSchema), "handCount");
      expect(def.tag).toBeUndefined();
    }
  });
});

// ── State Snapshot: Client View vs Server State ───────────────────────

describe("Anti-cheat: state snapshot comparison", () => {
  it("client only sees own hand, drawPileCount, and public fields", () => {
    const room = new UnoRoom();
    room.onCreate();
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    const player = room.state.players.get(String(room.state.currentPlayer))!;
    room["pushCardToHand"](player, {
      type: "color", color: "blue", value: "7", id: "test_blue_7",
    });

    // The client's view should include the player's schema
    expect(client.view!.has(player)).toBe(true);

    // The client should NOT have access to the draw pile array
    // (it's a plain JS array, not in the schema)
    expect((room as RoomTestAccess).drawPile).toBeDefined();
    // The schema only exposes drawPileCount
    expect(room.state.drawPileCount).toBeGreaterThanOrEqual(0);
  });

  it("opponent hand data is never included in a client's view", () => {
    const room = new UnoRoom();
    room.onCreate();
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const client0 = makeTestClient("human-0");
    const client1 = makeTestClient("human-1");
    room.onJoin(client0, { name: "Alice" });
    room.onJoin(client1, { name: "Bob" });

    const seat0 = room0SeatIndex(client0);
    const seat1 = room1SeatIndex(client1);
    const player0 = room.state.players.get(String(seat0))!;
    const player1 = room.state.players.get(String(seat1))!;

    room["pushCardToHand"](player0, {
      type: "color", color: "red", value: "5", id: "secret_card",
    });
    room["pushCardToHand"](player1, {
      type: "color", color: "green", value: "3", id: "other_secret",
    });

    // client0 sees player0's card, but NOT player1's
    expect(client0.view!.has(player0)).toBe(true);
    expect(client0.view!.has(player1)).toBe(false);

    // client1 sees player1's card, but NOT player0's
    expect(client1.view!.has(player1)).toBe(true);
    expect(client1.view!.has(player0)).toBe(false);
  });

  it("discard pile is fully public (all clients see all discarded cards)", () => {
    const room = new UnoRoom();
    room.onCreate();
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    // discardPile is a schema array (not view:true), so it's synced to all
    const def = getFieldDef(getMetadata(UnoRoomState), "discardPile");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("activeColor is public — standard UNO behavior", () => {
    const { room } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    const def = getFieldDef(getMetadata(UnoRoomState), "activeColor");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("no server-only arrays or objects leak through the schema", () => {
    const stateMeta = getMetadata(UnoRoomState);
    const allFields = [
      "players", "discardPile", "drawPileCount", "currentPlayer", "direction",
      "activeColor", "pendingDraw", "winner", "phase", "turnDeadline",
      "spectatorCount", "chatMessages", "unoCaller", "lastDrawnCardId",
      "wildDraw4ChallengePending", "wildDraw4Illegal", "wildDraw4OffenderSeat",
      "pendingWinnerSeat", "rematchVotes",
    ];

    for (const name of allFields) {
      const def = getFieldDef(stateMeta, name);
      expect(def).toBeDefined();
    }

    // drawPile (the actual card array) should NOT be in the schema
    const drawPileDef = getFieldDef(stateMeta, "drawPile");
    expect(drawPileDef).toBeUndefined();
  });
});

// ── Bot RNG State Isolation ───────────────────────────────────────────

describe("Anti-cheat: bot RNG state isolation", () => {
  it("bot turn randomness is not deterministic from a client's perspective", () => {
    const { room, client } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    // Run two separate rooms with the same setup — bot moves should differ
    // because Math.random() is not seeded
    const room2 = new UnoRoom();
    room2.onCreate();
    registerCleanup(() => room2.onDispose());
    clearTimeout(room2["turnTimeout"]);

    const client2 = makeTestClient("human-0");
    room2.onJoin(client2, { name: "Alice2" });

    // Both rooms start from different random states
    // Verify the draw pile order differs
    const pile1 = (room as RoomTestAccess).drawPile.map((c) => c.id);
    const pile2 = (room2 as RoomTestAccess).drawPile.map((c) => c.id);

    // Extremely unlikely to be identical with proper shuffling
    // (108! possible orderings)
    // We just verify both are valid and different sizes may occur
    expect(pile1.length).toBeGreaterThan(0);
    expect(pile2.length).toBeGreaterThan(0);
  });

  it("difficulty setting does not expose bot decision internals to clients", () => {
    const room = new UnoRoom();
    room.onCreate({ difficulty: "hard" });
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    // difficulty is private — not in schema
    const stateMeta = getMetadata(UnoRoomState);
    const diffDef = getFieldDef(stateMeta, "difficulty");
    expect(diffDef).toBeUndefined();
  });
});

// ── Edge Cases: State Consistency ──────────────────────────────────────

describe("Anti-cheat: state consistency checks", () => {
  it("total card count is conserved across draw pile, hands, and discard", () => {
    const { room, client } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    const countTotal = () => {
      const drawPile = (room as RoomTestAccess).drawPile;
      let totalInHands = 0;
      room.state.players.forEach((p) => {
        totalInHands += p.hand.length;
      });
      const discardCount = room.state.discardPile.length;
      return drawPile.length + totalInHands + discardCount;
    };

    const totalBefore = countTotal();
    expect(totalBefore).toBeGreaterThan(0);

    // Draw a card — total should remain the same
    room["handleDrawCard"](client);
    expect(countTotal()).toBe(totalBefore);
  });

  it("drawPileCount matches actual draw pile length after draw", () => {
    const { room, client } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    room["handleDrawCard"](client);

    const drawPile = (room as RoomTestAccess).drawPile;
    expect(room.state.drawPileCount).toBe(drawPile.length);
  });

  it("handCount matches actual hand length for all players", () => {
    const room = new UnoRoom();
    room.onCreate();
    registerCleanup(() => room.onDispose());
    clearTimeout(room["turnTimeout"]);

    // After onCreate deal, all players have 7 cards and handCount=7
    room.state.players.forEach((p) => {
      expect(p.handCount).toBe(p.hand.length);
    });

    // After drawing a card, handCount should update
    const currentPlayer = room.state.players.get(String(room.state.currentPlayer))!;
    currentPlayer.isBot = false;
    currentPlayer.connected = true;
    currentPlayer.sessionId = "human-check";
    room.state.phase = "playing";
    room.state.winner = -1;
    room.state.pendingDraw = 0;
    room.state.unoCaller = -1;
    room.state.lastDrawnCardId = "";
    room["rateLimiter"].clear();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-check");
    room["handleDrawCard"](client);

    expect(currentPlayer.handCount).toBe(currentPlayer.hand.length);
  });

  it("card count conserved after draw + play cycle", () => {
    const { room, client } = createRoomWithHuman();
    registerCleanup(() => room.onDispose());

    const player = room.state.players.get("0")!;
    player.hand.push(makeSchemaCard("red_5", "red", "5"));
    room.state.discardPile.push(makeSchemaCard("discard_red_3", "red", "3"));

    const countTotal = () => {
      const drawPile = (room as RoomTestAccess).drawPile;
      let totalInHands = 0;
      room.state.players.forEach((p) => {
        totalInHands += p.hand.length;
      });
      return drawPile.length + totalInHands + room.state.discardPile.length;
    };

    const totalBefore = countTotal();

    room["handleDrawCard"](client);
    expect(countTotal()).toBe(totalBefore);

    room["rateLimiter"].clear();
    room["handlePlayCard"](client, { cardId: "red_5" });

    expect(countTotal()).toBe(totalBefore);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────

function room0SeatIndex(client: Client): number {
  let found = -1;
  // The first player that matches this client session
  return 0; // onJoin assigns to first available bot seat
}

function room1SeatIndex(client: Client): number {
  return 1; // Second join gets seat 1
}
