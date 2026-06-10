import assert from "node:assert/strict";
import test from "node:test";
import { isPlayable } from "../src/gameHelpers.ts";
import type { CardSchema, UnoState } from "../src/gameTypes.ts";

function card(id: string, cardType: CardSchema["cardType"], color: string, value: string): CardSchema {
  return { id, cardType, color, value };
}

function state(overrides: Partial<UnoState>): UnoState {
  return {
    discardPile: [card("top", "color", "red", "5")],
    activeColor: "red",
    pendingDraw: 0,
    hands: [],
    winner: undefined,
    ...overrides,
  };
}

test("wild draw4 remains playable when the hand only has a same-value color card", () => {
  const hand = [
    card("blue-5", "color", "blue", "5"),
    card("wild-d4", "wild", "wild", "wild_draw4"),
  ];

  assert.equal(isPlayable(hand[1], state({}), hand), true);
});

test("wild draw4 is blocked when the hand has a matching color", () => {
  const hand = [
    card("red-7", "color", "red", "7"),
    card("wild-d4", "wild", "wild", "wild_draw4"),
  ];

  assert.equal(isPlayable(hand[1], state({}), hand), false);
});
