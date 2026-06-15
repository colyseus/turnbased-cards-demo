import { describe, expect, it } from "vitest";
import { StateView } from "@colyseus/schema";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { PlayerSchema, UnoCardSchema, UnoRoomState } from "../src/rooms/schema/UnoRoomState.ts";
import { makeTestClient } from "./testClients.ts";

function makeSchemaCard(
  id: string,
  color: string,
  value: string,
): InstanceType<typeof UnoCardSchema> {
  const card = new UnoCardSchema();
  card.id = id;
  card.cardType = "color";
  card.color = color;
  card.value = value;
  card.chosenColor = "";
  return card;
}

function getMetadata(ctor: typeof PlayerSchema | typeof UnoRoomState) {
  return ctor[Symbol.metadata] as Record<string, any>;
}

function getFieldDef(meta: Record<string, any>, fieldName: string) {
  const index = meta[fieldName];
  return meta[index];
}

// ── Schema Annotation Tests ────────────────────────────────────────────

describe("PlayerSchema StateView annotations", () => {
  it("marks 'hand' field with view tag -1 (private)", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "hand");
    expect(def).toBeDefined();
    expect(def.tag).toBe(-1);
  });

  it("does NOT mark 'handCount' with a view tag", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "handCount");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("does NOT mark 'sessionId' with a view tag", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "sessionId");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("does NOT mark 'name' with a view tag", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "name");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("does NOT mark 'seatIndex' with a view tag", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "seatIndex");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("does NOT mark 'isBot' with a view tag", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "isBot");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("does NOT mark 'connected' with a view tag", () => {
    const def = getFieldDef(getMetadata(PlayerSchema), "connected");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });
});

// ── StateView Lifecycle Tests ──────────────────────────────────────────

describe("StateView lifecycle in UnoRoom", () => {
  it("creates a StateView for human players on join", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    expect(client.view).toBeDefined();
    expect(client.view).toBeInstanceOf(StateView);

    room.onDispose();
  });

  it("assigns the player's own schema to the client's view", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    const player = room.state.players.get(String(room.state.currentPlayer))!;
    expect(client.view!.has(player)).toBe(true);

    room.onDispose();
  });

  it("cleans up StateView on player leave", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });
    expect(client.view).toBeDefined();

    room.onLeave(client);
    expect(client.view).toBeUndefined();

    room.onDispose();
  });

  it("does NOT create a StateView for spectators", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const spectatorClient = makeTestClient("spectator-0");
    room.onJoin(spectatorClient, { spectator: true });

    expect(spectatorClient.view).toBeUndefined();

    room.onDispose();
  });
});

// ── Push Card to Hand View Tests ───────────────────────────────────────

describe("pushCardToHand StateView integration", () => {
  it("adds new card to the player's hand array", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    const player = room.state.players.get(String(room.state.currentPlayer))!;
    const initialHandSize = player.hand.length;

    room["pushCardToHand"](player, {
      type: "color",
      color: "blue",
      value: "7",
      id: "test_blue_7",
    });

    expect(player.hand.length).toBe(initialHandSize + 1);
    expect(player.hand[player.hand.length - 1].id).toBe("test_blue_7");

    room.onDispose();
  });

  it("registers drawn card in the client's view (view.add called)", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    const player = room.state.players.get(String(room.state.currentPlayer))!;

    room["pushCardToHand"](player, {
      type: "color",
      color: "blue",
      value: "7",
      id: "test_blue_7",
    });

    const addedCard = player.hand[player.hand.length - 1];
    const refId = (addedCard as any)["~refId"];
    expect(client.view!.changes.has(refId)).toBe(true);

    room.onDispose();
  });

  it("registers multiple drawn cards in the client's view", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    const player = room.state.players.get(String(room.state.currentPlayer))!;
    const initialHandSize = player.hand.length;
    const cards = [
      { type: "color" as const, color: "red", value: "3", id: "test_red_3" },
      { type: "wild" as const, wildType: "wild" as const, chosenColor: null, id: "test_wild_1" },
    ];

    for (const card of cards) {
      room["pushCardToHand"](player, card);
    }

    expect(player.hand.length).toBe(initialHandSize + 2);

    for (let i = initialHandSize; i < player.hand.length; i++) {
      const card = player.hand[i];
      const refId = (card as any)["~refId"];
      expect(client.view!.changes.has(refId)).toBe(true);
    }

    room.onDispose();
  });

  it("does NOT add cards to view for bot players (no client)", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const botPlayer = room.state.players.get("0")!;
    const initialHandSize = botPlayer.hand.length;

    room["pushCardToHand"](botPlayer, {
      type: "color",
      color: "green",
      value: "9",
      id: "test_green_9",
    });

    expect(botPlayer.hand.length).toBe(initialHandSize + 1);

    room.onDispose();
  });
});

// ── Field Visibility Classification Tests ──────────────────────────────

describe("PlayerSchema field visibility classification", () => {
  it("has exactly one field with view tag (hand)", () => {
    const meta = getMetadata(PlayerSchema);
    const fieldNames = ["sessionId", "seatIndex", "name", "isBot", "connected", "hand", "handCount"];

    let viewTaggedCount = 0;
    for (const name of fieldNames) {
      const def = getFieldDef(meta, name);
      if (def && def.tag !== undefined) {
        viewTaggedCount++;
      }
    }

    expect(viewTaggedCount).toBe(1);
  });

  it("handCount is independent from hand (safe public proxy)", () => {
    const meta = getMetadata(PlayerSchema);
    const handDef = getFieldDef(meta, "hand");
    const handCountDef = getFieldDef(meta, "handCount");

    expect(handDef.tag).toBe(-1);
    expect(handCountDef.tag).toBeUndefined();
  });
});

// ── Information Leak Audit Tests ───────────────────────────────────────

describe("UnoRoomState field classification", () => {
  it("no global state fields have view tags", () => {
    const stateMeta = getMetadata(UnoRoomState);
    const globalFields = [
      "players", "discardPile", "drawPileCount", "currentPlayer", "direction",
      "activeColor", "pendingDraw", "winner", "phase", "turnDeadline",
      "spectatorCount", "chatMessages", "unoCaller", "lastDrawnCardId",
      "wildDraw4ChallengePending", "wildDraw4Illegal", "wildDraw4OffenderSeat",
      "pendingWinnerSeat", "rematchVotes",
    ];

    for (const name of globalFields) {
      const def = getFieldDef(stateMeta, name);
      expect(def).toBeDefined();
      expect(def.tag).toBeUndefined();
    }
  });

  it("lastDrawnCardId is publicly visible (potential info leak — documented)", () => {
    const def = getFieldDef(getMetadata(UnoRoomState), "lastDrawnCardId");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });

  it("wildDraw4Illegal is publicly visible (potential info leak — documented)", () => {
    const def = getFieldDef(getMetadata(UnoRoomState), "wildDraw4Illegal");
    expect(def).toBeDefined();
    expect(def.tag).toBeUndefined();
  });
});
