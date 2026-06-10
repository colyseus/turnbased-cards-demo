import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActionCallout,
  buildGuidanceState,
  buildMeSummary,
  buildRosterEntries,
  getActivePlayerThemeColor,
  getSpotlightPos,
  sortHand,
} from "../src/components/tableRoomControllerLogic.ts";
import type { CardSchema, PlayerSchema } from "../src/gameTypes.ts";

function card(id: string, cardType: CardSchema["cardType"], color: string, value: string): CardSchema {
  return { id, cardType, color, value };
}

function player(overrides: Partial<PlayerSchema> & Pick<PlayerSchema, "sessionId" | "seatIndex" | "name">): PlayerSchema {
  return {
    isBot: false,
    connected: true,
    handCount: 0,
    ...overrides,
  };
}

test("sortHand keeps wild cards last when sorting by color", () => {
  const hand = [
    card("w4", "wild", "wild", "wild_draw4"),
    card("g9", "color", "green", "9"),
    card("r2", "color", "red", "2"),
    card("y1", "color", "yellow", "1"),
  ];

  const sorted = sortHand(hand, "color");
  assert.deepEqual(sorted.map((c) => c.id), ["g9", "r2", "y1", "w4"]);
});

test("sortHand orders by rank first when sorting by value", () => {
  const hand = [
    card("g9", "color", "green", "9"),
    card("r2", "color", "red", "2"),
    card("y2", "color", "yellow", "2"),
    card("b1", "color", "blue", "1"),
  ];

  const sorted = sortHand(hand, "value");
  assert.deepEqual(sorted.map((c) => c.id), ["b1", "r2", "y2", "g9"]);
});

test("buildRosterEntries excludes the local player and marks the active seat", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me", handCount: 5 }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2", handCount: 3, isBot: true }),
    player({ sessionId: "op-2", seatIndex: 2, name: "[av-owl-rose]Rook", handCount: 7 }),
  ];

  const roster = buildRosterEntries(players, "me", 2);
  assert.equal(roster.length, 2);
  assert.deepEqual(
    roster.map((entry) => ({ id: entry.sessionId, active: entry.active, count: entry.cardCount })),
    [
      { id: "op-1", active: false, count: 3 },
      { id: "op-2", active: true, count: 7 },
    ],
  );
});

test("getSpotlightPos matches the active turn location", () => {
  const players = [
    player({ sessionId: "me", seatIndex: 0, name: "Me" }),
    player({ sessionId: "op-1", seatIndex: 1, name: "Bot 2" }),
    player({ sessionId: "op-2", seatIndex: 2, name: "Bot 3" }),
    player({ sessionId: "op-3", seatIndex: 3, name: "Bot 4" }),
  ];

  assert.equal(
    getSpotlightPos({
      isMyTurn: true,
      players,
      meSessionId: "me",
      currentPlayerSeat: 0,
    }),
    "bottom",
  );
  assert.equal(
    getSpotlightPos({
      isMyTurn: false,
      players,
      meSessionId: "me",
      currentPlayerSeat: 1,
    }),
    "left",
  );
  assert.equal(
    getSpotlightPos({
      isMyTurn: false,
      players,
      meSessionId: "me",
      currentPlayerSeat: 2,
    }),
    "top",
  );
});

test("buildGuidanceState covers turn, penalty, and invalid-selection states", () => {
  assert.equal(
    buildGuidanceState({
      mustCallUno: true,
      isMyTurn: true,
      pendingDraw: 0,
      hasPlayableCards: true,
      selectedCard: null,
      isSelectedPlayable: true,
    }).guidanceStatus,
    "warning",
  );

  const penalty = buildGuidanceState({
    mustCallUno: false,
    isMyTurn: true,
    pendingDraw: 4,
    hasPlayableCards: false,
    selectedCard: null,
    isSelectedPlayable: true,
  });
  assert.match(penalty.guidanceText, /Draw penalty: \+4/);

  const invalid = buildGuidanceState({
    mustCallUno: false,
    isMyTurn: true,
    pendingDraw: 0,
    hasPlayableCards: true,
    selectedCard: card("r2", "color", "red", "2"),
    isSelectedPlayable: false,
  });
  assert.equal(invalid.guidanceStatus, "error");
  assert.match(invalid.guidanceText, /Invalid selection!/);

  const noPlayable = buildGuidanceState({
    mustCallUno: false,
    isMyTurn: true,
    pendingDraw: 0,
    hasPlayableCards: false,
    selectedCard: null,
    isSelectedPlayable: true,
  });
  assert.equal(noPlayable.guidanceStatus, "warning");
  assert.match(noPlayable.guidanceText, /No playable cards in hand!/);
});

test("buildActionCallout mirrors UNO and draw-penalty prompts", () => {
  assert.deepEqual(
    buildActionCallout({
      mustCallUno: true,
      isMyTurn: true,
      pendingDraw: 0,
      hasPlayableCards: true,
    }),
    {
      kind: "uno",
      title: "UNO call required",
      text: "Tap UNO before you play again to avoid the 2-card penalty.",
    },
  );

  assert.equal(
    buildActionCallout({
      mustCallUno: false,
      isMyTurn: false,
      pendingDraw: 2,
      hasPlayableCards: true,
    }),
    null,
  );

  assert.match(
    buildActionCallout({
      mustCallUno: false,
      isMyTurn: true,
      pendingDraw: 2,
      hasPlayableCards: false,
    })?.text ?? "",
    /No stacking card available/,
  );
});

test("me summary and theme helpers stay stable", () => {
  const me = player({ sessionId: "me", seatIndex: 4, name: "[av-panda-rose]Nova", handCount: 8 });
  assert.deepEqual(buildMeSummary(me, 3), {
    displayName: "Nova",
    symbol: "panda",
    theme: "rose",
    seatIndex: 4,
    spectatorCount: 3,
  });
  assert.equal(getActivePlayerThemeColor(me), "hsl(358, 75%, 55%)");
  assert.equal(getActivePlayerThemeColor(null), "rgba(255, 255, 255, 0.1)");
});
