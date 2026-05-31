import { describe, it, expect } from "vitest";
import {
  createUnoDeck,
  shuffleDeck,
  canPlay,
  createGame,
  playCard,
  drawCards,
  getPlayableCards,
  handleDraw,
  aiTurn,
  autoPlayGame,
  UnoState,
  UnoColor,
  UnoCard,
} from "../shared/uno.ts";

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Build a minimal game state with 4 empty hands, ready for manual card setup. */
function makeState(overrides: Partial<UnoState> = {}): UnoState {
  return createGame();
}

/** Build a state where only player 0 has a specific hand, all others empty. */
function stateWithHand(hand: UnoCard[], discardCard?: UnoCard, activeColor: UnoColor = "red"): UnoState {
  const state = createGame();
  // Give player 0 the specified hand; others get empty hands
  for (let i = 0; i < 4; i++) {
    state.hands[i] = i === 0 ? hand : [];
  }
  state.discardPile = discardCard ? [discardCard] : state.discardPile;
  state.activeColor = activeColor;
  state.currentPlayer = 0;
  state.pendingDraw = 0;
  state.winner = null;
  state.direction = 1;
  return state;
}

// ── createUnoDeck ────────────────────────────────────────────────────────────

describe("createUnoDeck", () => {
  it("creates 108 cards", () => {
    const deck = createUnoDeck();
    expect(deck.length).toBe(108);
  });

  it("contains 100 color cards (4 colors × 25 each)", () => {
    const deck = createUnoDeck();
    const colorCards = deck.filter((c) => c.type === "color");
    expect(colorCards.length).toBe(100);
  });

  it("contains 8 wild cards (4 wild + 4 wild_draw4)", () => {
    const deck = createUnoDeck();
    const wildCards = deck.filter((c) => c.type === "wild");
    expect(wildCards.length).toBe(8);
    const wildDraw4 = deck.filter((c) => c.type === "wild" && c.wildType === "wild_draw4");
    expect(wildDraw4.length).toBe(4);
  });

  it("assigns unique IDs to all cards", () => {
    const deck = createUnoDeck();
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(108);
  });
});

describe("shuffleDeck", () => {
  it("preserves all cards", () => {
    const original = createUnoDeck();
    const shuffled = shuffleDeck(original);
    expect(shuffled.length).toBe(original.length);
  });

  it("does not modify the original deck", () => {
    const original = createUnoDeck();
    const originalIds = original.map((c) => c.id);
    shuffleDeck(original);
    expect(original.map((c) => c.id)).toEqual(originalIds);
  });

  it("produces different order (statistically)", () => {
    const deck = createUnoDeck();
    const ids = shuffleDeck(deck).map((c) => c.id).join(",");
    let diff = 0;
    for (let i = 0; i < 5; i++) {
      if (shuffleDeck(createUnoDeck()).map((c) => c.id).join(",") !== ids) diff++;
    }
    expect(diff).toBeGreaterThan(0);
  });
});

// ── canPlay ──────────────────────────────────────────────────────────────────

describe("canPlay", () => {
  const topRed5 = { type: "color" as const, color: "red" as UnoColor, value: "5", id: "r5" };
  const topBlueSkip = { type: "color" as const, color: "blue" as UnoColor, value: "skip", id: "bs" };
  const topGreen7 = { type: "color" as const, color: "green" as UnoColor, value: "7", id: "g7" };
  const topRedDraw2 = { type: "color" as const, color: "red" as UnoColor, value: "draw2", id: "rd2" };

  it("wild cards can always be played", () => {
    const wild = { type: "wild" as const, wildType: "wild" as const, chosenColor: null, id: "w" };
    const wildD4 = { type: "wild" as const, wildType: "wild_draw4" as const, chosenColor: null, id: "wd4" };
    expect(canPlay(wild, topRed5, "red")).toBe(true);
    expect(canPlay(wildD4, topBlueSkip, "blue")).toBe(true);
  });

  it("matches by active color", () => {
    const red5 = { type: "color" as const, color: "red" as UnoColor, value: "5", id: "r5" };
    expect(canPlay(red5, topBlueSkip, "red")).toBe(true);
    expect(canPlay(red5, topBlueSkip, "blue")).toBe(false);
  });

  it("matches by value (same-value cards playable regardless of color)", () => {
    const blueSkip = { type: "color" as const, color: "blue" as UnoColor, value: "skip", id: "bs2" };
    const greenSkip = { type: "color" as const, color: "green" as UnoColor, value: "skip", id: "gs2" };
    // A skip can be played on another skip (same value), active color irrelevant
    expect(canPlay(blueSkip, topGreen7, "green")).toBe(false); // skip on 7: no color match, no value match
    expect(canPlay(greenSkip, topBlueSkip, "blue")).toBe(true); // skip on skip: match by value
  });

  it("does not match different colors with different values", () => {
    const red9 = { type: "color" as const, color: "red" as UnoColor, value: "9", id: "r9" };
    const blue7 = { type: "color" as const, color: "blue" as UnoColor, value: "7", id: "b7" };
    expect(canPlay(red9, blue7, "blue")).toBe(false); // red 9 on blue 7 — no color match, no value match
  });

  // ── Draw-2 Stacking ───────────────────────────────────────────────────────

  it("draw2 cards can stack when pendingDraw > 0", () => {
    const redDraw2 = { type: "color" as const, color: "red" as UnoColor, value: "draw2", id: "rd2a" };
    const blueDraw2 = { type: "color" as const, color: "blue" as UnoColor, value: "draw2", id: "bd2" };
    const red5 = { type: "color" as const, color: "red" as UnoColor, value: "5", id: "r5a" };
    // pendingDraw = 2 (from previous draw2), top card is red draw2
    expect(canPlay(blueDraw2, topRedDraw2, "red", 2)).toBe(true); // stacking draw2
    expect(canPlay(red5, topRedDraw2, "red", 2)).toBe(false);    // non-draw2 can't play
  });

  it("non-draw2 color cards cannot play when pendingDraw > 0", () => {
    const red5 = { type: "color" as const, color: "red" as UnoColor, value: "5", id: "r5b" };
    const greenSkip = { type: "color" as const, color: "green" as UnoColor, value: "skip", id: "gs3" };
    expect(canPlay(red5, topRedDraw2, "red", 2)).toBe(false);
    expect(canPlay(greenSkip, topRedDraw2, "red", 2)).toBe(false);
  });

  it("wild draw4 can stack on pending draw4 (pendingDraw >= 4)", () => {
    const wildD4 = { type: "wild" as const, wildType: "wild_draw4" as const, chosenColor: null, id: "wd4s" };
    const topWild = { type: "wild" as const, value: "wild_draw4" as const, id: "tw" };
    // pendingDraw = 4 (from previous draw4), top card is wild draw4
    expect(canPlay(wildD4, topWild, "red", 4)).toBe(true);
    // pendingDraw = 2 (from draw2 only), can't stack draw4
    expect(canPlay(wildD4, topRedDraw2, "red", 2)).toBe(false);
  });

  it("draw2 cannot stack on a pending wild draw4", () => {
    const blueDraw2 = { type: "color" as const, color: "blue" as UnoColor, value: "draw2", id: "bd2_on_d4" };
    const topWild = { type: "wild" as const, wildType: "wild_draw4" as const, chosenColor: "red" as UnoColor, id: "wd4_top" };

    expect(canPlay(blueDraw2, topWild, "red", 4)).toBe(false);
  });

  it("without pendingDraw, draw2 plays normally (match by value)", () => {
    const redDraw2 = { type: "color" as const, color: "red" as UnoColor, value: "draw2", id: "rd2c" };
    // No pendingDraw, draw2 can be played on matching value or color
    expect(canPlay(redDraw2, topRed5, "red", 0)).toBe(true);  // color match
    expect(canPlay(redDraw2, topBlueSkip, "blue", 0)).toBe(false); // no match
  });
});

// ── createGame ───────────────────────────────────────────────────────────────

describe("createGame", () => {
  it("deals 7 cards to each of 4 players", () => {
    const state = createGame();
    expect(state.hands.length).toBe(4);
    for (const hand of state.hands) {
      expect(hand.length).toBe(7);
    }
  });

  it("starts with one non-wild card on discard pile", () => {
    const state = createGame();
    expect(state.discardPile.length).toBe(1);
    expect(state.discardPile[0].type).toBe("color");
  });

  it("sets active color from the first card", () => {
    const state = createGame();
    expect(["red", "blue", "green", "yellow"]).toContain(state.activeColor);
  });

  it("initializes 4-player game with valid starting state", () => {
    const state = createGame();
    // direction is 1 or -1 (flipped if first card is reverse)
    expect(state.direction === 1 || state.direction === -1).toBe(true);
    // currentPlayer depends on first card effect: 0, 1, or 3
    expect([0, 1, 3]).toContain(state.currentPlayer);
    // winner should be null at start
    expect(state.winner).toBe(null);
    // pendingDraw is 0 or 2 (if first card is draw2)
    expect([0, 2]).toContain(state.pendingDraw);
  });
});

// ── playCard ─────────────────────────────────────────────────────────────────

describe("playCard", () => {
  it("removes card from player's hand and adds to discard", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
      { type: "color", color: "blue", value: "3", id: "b3" },
    ]);
    const result = playCard(state, 0, "r5");
    expect(result.hands[0].find((c) => c.id === "r5")).toBeUndefined();
    expect(result.discardPile[result.discardPile.length - 1].id).toBe("r5");
  });

  it("is immutable — original state is unchanged", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
    ]);
    playCard(state, 0, "r5");
    expect(state.hands[0].length).toBe(1);
  });

  it("declares winner when hand becomes empty", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
    ]);
    const result = playCard(state, 0, "r5");
    expect(result.winner).toBe(0);
  });

  it("updates activeColor for color cards", () => {
    const discard = { type: "color", color: "blue", value: "7", id: "b7" };
    const state = stateWithHand(
      [{ type: "color", color: "green", value: "3", id: "g3" }],
      discard,
      "green",
    );
    const result = playCard(state, 0, "g3");
    expect(result.activeColor).toBe("green");
  });

  it("sets chosenColor and activeColor for wild cards", () => {
    const state = stateWithHand([
      { type: "wild", wildType: "wild", chosenColor: null, id: "w" },
    ]);
    const result = playCard(state, 0, "w", "red");
    expect(result.activeColor).toBe("red");
    expect((result.discardPile[result.discardPile.length - 1] as UnoCard & { chosenColor: string }).chosenColor).toBe("red");
  });

  it("rejects invalid chosenColor values for wild cards", () => {
    const state = stateWithHand([
      { type: "wild", wildType: "wild", chosenColor: null, id: "w" },
    ]);

    const result = playCard(state, 0, "w", "purple" as UnoColor);

    expect(result).toBe(state);
  });

  it("pendingDraw increases by 2 on draw2 card", () => {
    const discard = { type: "color", color: "red", value: "7", id: "r7" };
    const state = stateWithHand(
      [{ type: "color", color: "red", value: "draw2", id: "rd2" }],
      discard,
      "red",
    );
    const result = playCard(state, 0, "rd2");
    expect(result.pendingDraw).toBe(2);
  });

  it("pendingDraw increases by 4 on wild_draw4", () => {
    const discard = { type: "color", color: "blue", value: "7", id: "b7" };
    const state = stateWithHand(
      [{ type: "wild", wildType: "wild_draw4", chosenColor: null, id: "wd4" }],
      discard,
      "blue",
    );
    const result = playCard(state, 0, "wd4", "red");
    expect(result.pendingDraw).toBe(4);
  });

  it("skip advances currentPlayer by 2", () => {
    const discard = { type: "color", color: "blue", value: "7", id: "b7" };
    const state = stateWithHand(
      [{ type: "color", color: "blue", value: "skip", id: "bs" }],
      discard,
      "blue",
    );
    const result = playCard(state, 0, "bs");
    expect(result.currentPlayer).toBe(2); // player 1 skipped
  });

  it("reverse flips direction and advances by 1", () => {
    const discard = { type: "color", color: "green", value: "7", id: "g7" };
    const state = stateWithHand(
      [{ type: "color", color: "green", value: "reverse", id: "gr" }],
      discard,
      "green",
    );
    const result = playCard(state, 0, "gr");
    expect(result.direction).toBe(-1);
    expect(result.currentPlayer).toBe(3); // counter-clockwise from 0 is player 3
  });

  it("number card advances currentPlayer by 1", () => {
    const discard = { type: "color", color: "blue", value: "7", id: "b7" };
    const state = stateWithHand(
      [{ type: "color", color: "red", value: "3", id: "r3" }],
      discard,
      "red",
    );
    const result = playCard(state, 0, "r3");
    expect(result.currentPlayer).toBe(1);
  });

  it("returns original state for nonexistent card ID", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
    ]);
    const result = playCard(state, 0, "nonexistent");
    expect(result).toBe(state);
  });

  it("rejects invalid player indexes", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
    ]);

    expect(playCard(state, -1, "r5")).toBe(state);
    expect(playCard(state, 4, "r5")).toBe(state);
  });

  it("rejects plays from a player whose turn it is not", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
    ]);
    state.currentPlayer = 1;

    const result = playCard(state, 0, "r5");

    expect(result).toBe(state);
  });

  it("rejects plays after the game already has a winner", () => {
    const state = stateWithHand([
      { type: "color", color: "red", value: "5", id: "r5" },
    ]);
    state.winner = 2;

    const result = playCard(state, 0, "r5");

    expect(result).toBe(state);
  });

  it("rejects unplayable cards", () => {
    const discard = { type: "color", color: "red", value: "7", id: "r7" } as const;
    const state = stateWithHand(
      [{ type: "color", color: "blue", value: "5", id: "b5" }],
      discard,
      "red",
    );

    const result = playCard(state, 0, "b5");

    expect(result).toBe(state);
  });

  it("rejects wild_draw4 when the player has a normal playable card", () => {
    const discard = { type: "color", color: "red", value: "7", id: "r7" } as const;
    const state = stateWithHand(
      [
        { type: "wild", wildType: "wild_draw4", chosenColor: null, id: "wd4" },
        { type: "color", color: "red", value: "5", id: "r5" },
      ],
      discard,
      "red",
    );

    const result = playCard(state, 0, "wd4", "blue");

    expect(result).toBe(state);
  });
});

// ── drawCards ────────────────────────────────────────────────────────────────

describe("drawCards", () => {
  it("adds drawn cards to player's hand", () => {
    const state = createGame();
    const before = state.hands[0].length;
    const result = drawCards(state, 0, 1);
    expect(result.hands[0].length).toBe(before + 1);
  });

  it("is immutable — original state is unchanged", () => {
    const state = createGame();
    const before = state.hands[0].length;
    drawCards(state, 0, 1);
    expect(state.hands[0].length).toBe(before);
  });

  it("recycles discard into draw pile when draw pile is empty", () => {
    let state = createGame();
    // Ensure there are multiple cards in discard
    state.discardPile.push({ type: "color", color: "red", value: "1", id: "r1_extra" });
    state.drawPile = [];
    const result = drawCards(state, 0, 1);
    expect(result.hands[0].length).toBe(state.hands[0].length + 1);
  });
});

// ── getPlayableCards ─────────────────────────────────────────────────────────

describe("getPlayableCards", () => {
  it("returns empty when player is not current player", () => {
    const state = createGame();
    state.currentPlayer = 0;
    expect(getPlayableCards(state, 1)).toHaveLength(0);
  });

  it("returns empty when game is won", () => {
    let state = createGame();
    state.winner = 0;
    expect(getPlayableCards(state, 0)).toHaveLength(0);
  });

  it("returns empty during pendingDraw when the player has no stackable draw card", () => {
    const discard = { type: "color" as const, color: "red" as UnoColor, value: "draw2", id: "rd2_top" };
    let state = stateWithHand(
      [
        { type: "color", color: "red", value: "5", id: "r5_not_stackable" },
        { type: "color", color: "blue", value: "5", id: "b5_not_stackable" },
      ],
      discard,
      "red",
    );
    state.pendingDraw = 2;

    expect(getPlayableCards(state, 0)).toHaveLength(0);
  });

  it("returns stackable draw cards while pendingDraw is active", () => {
    const discard = { type: "color" as const, color: "red" as UnoColor, value: "draw2", id: "rd2_top" };
    const state = stateWithHand(
      [
        { type: "color", color: "blue", value: "draw2", id: "bd2_stack" },
        { type: "color", color: "red", value: "5", id: "r5_blocked" },
      ],
      discard,
      "red",
    );
    state.pendingDraw = 2;

    const playable = getPlayableCards(state, 0);

    expect(playable.map((card) => card.id)).toEqual(["bd2_stack"]);
  });

  it("returns cards matching active color or top card value", () => {
    let state = createGame();
    state.currentPlayer = 0;
    state.pendingDraw = 0;
    state.winner = null;
    // Add a blue card to hand 0 and set active color to blue
    state.hands[0].push({ type: "color", color: "blue", value: "7", id: "b7_hand" });
    state.activeColor = "blue";
    const playable = getPlayableCards(state, 0);
    expect(playable.some((c) => c.id === "b7_hand")).toBe(true);
  });
});

// ── handleDraw ───────────────────────────────────────────────────────────────

describe("handleDraw", () => {
  it("draws 1 card and advances to next player (voluntary)", () => {
    let state = createGame();
    state.currentPlayer = 0;
    state.direction = 1;
    state.pendingDraw = 0;
    const before = state.hands[0].length;
    const result = handleDraw(state);
    expect(result.hands[0].length).toBe(before + 1);
    expect(result.currentPlayer).toBe(1);
  });

  it("draws pendingDraw count when forced", () => {
    let state = createGame();
    state.currentPlayer = 0;
    state.pendingDraw = 3;
    const before = state.hands[0].length;
    const result = handleDraw(state);
    expect(result.hands[0].length).toBe(before + 3);
    expect(result.pendingDraw).toBe(0);
  });

  it("is immutable — original state is unchanged", () => {
    let state = createGame();
    state.currentPlayer = 0;
    const before = state.hands[0].length;
    handleDraw(state);
    expect(state.hands[0].length).toBe(before);
  });
});

// ── aiTurn ───────────────────────────────────────────────────────────────────

describe("aiTurn", () => {
  it("produces a valid game state", () => {
    const state = createGame();
    const result = aiTurn(state);
    expect(result.hands.length).toBe(4);
  });

  it("handles forced draw when pendingDraw > 0", () => {
    const discard = { type: "color" as const, color: "red", value: "draw2", id: "rd2_top" };
    let state = stateWithHand(
      [
        { type: "color", color: "red", value: "5", id: "r5_not_stackable" },
        { type: "color", color: "blue", value: "5", id: "b5_not_stackable" },
      ],
      discard,
      "red",
    );
    state.pendingDraw = 2;
    const before = state.hands[0].length;
    const result = aiTurn(state);
    expect(result.hands[0].length).toBe(before + 2);
    expect(result.pendingDraw).toBe(0);
  });

  it("plays a card or draws when no playable cards", () => {
    // Set up a deterministic state where player 0 has NO playable cards
    const discard = { type: "color" as const, color: "red" as UnoColor, value: "5", id: "r5" };
    const state = stateWithHand(
      [
        { type: "color", color: "blue", value: "3", id: "b3" },
        { type: "color", color: "green", value: "7", id: "g7" },
        { type: "color", color: "yellow", value: "9", id: "y9" },
      ],
      discard,
      "red", // active color is red, but hand has no red or 5 cards
    );
    const before = state.hands[0].length;
    const result = aiTurn(state);
    // Bot has no playable cards, so it draws 1 (hand grows by 1)
    expect(result.hands[0].length).toBe(before + 1);
    // Turn should have advanced to player 1
    expect(result.currentPlayer).toBe(1);
  });

  it("plays a valid card when playable cards exist", () => {
    const discard = { type: "color" as const, color: "red" as UnoColor, value: "7", id: "r7" };
    const state = stateWithHand(
      [{ type: "color", color: "red", value: "3", id: "r3" }],
      discard,
      "red",
    );
    const result = aiTurn(state);
    // Bot should have played the red 3
    const topCard = result.discardPile[result.discardPile.length - 1];
    expect(topCard.id).toBe("r3");
  });

  it("bot does not play a card that cannot be played", () => {
    const discard = { type: "color" as const, color: "red", value: "7", id: "r7" };
    const state = stateWithHand(
      [
        { type: "color", color: "blue", value: "5", id: "b5" },
        { type: "color", color: "green", value: "9", id: "g9" },
      ],
      discard,
      "red",
    );
    const before = state.hands[0].length;
    const result = aiTurn(state);
    // Bot has no playable cards, so should have drawn (hand count increased)
    expect(result.hands[0].length).toBeGreaterThan(before);
  });

  it("respects pendingDraw — draws instead of playing", () => {
    const discard = { type: "color" as const, color: "blue", value: "skip", id: "bs" };
    const state = stateWithHand(
      [{ type: "color", color: "blue", value: "3", id: "b3" }],
      discard,
      "blue",
    );
    state.pendingDraw = 2;
    state.currentPlayer = 0;
    const before = state.hands[0].length;
    const result = aiTurn(state);
    // Bot must draw the pending 2 instead of playing
    expect(result.hands[0].length).toBe(before + 2);
    expect(result.pendingDraw).toBe(0);
    // Card should not have been played
    expect(result.discardPile[result.discardPile.length - 1].id).not.toBe("b3");
  });

  it("stacks a draw2 instead of drawing when pendingDraw is active", () => {
    const discard = { type: "color" as const, color: "red", value: "draw2", id: "rd2_top" };
    const state = stateWithHand(
      [
        { type: "color", color: "blue", value: "draw2", id: "bd2_stack" },
        { type: "color", color: "red", value: "5", id: "r5_blocked" },
      ],
      discard,
      "red",
    );
    state.pendingDraw = 2;

    const result = aiTurn(state);

    expect(result.discardPile[result.discardPile.length - 1].id).toBe("bd2_stack");
    expect(result.pendingDraw).toBe(4);
    expect(result.hands[0].map((card) => card.id)).toEqual(["r5_blocked"]);
  });
});

describe("autoPlayGame", () => {
  function totalCards(state: UnoState) {
    return (
      state.drawPile.length +
      state.discardPile.length +
      state.hands.reduce((sum, hand) => sum + hand.length, 0)
    );
  }

  it("plays a complete game to a winner", () => {
    const result = autoPlayGame(createGame(), { maxTurns: 1000 });

    expect(result.completed).toBe(true);
    expect(result.reason).toBe("winner");
    expect(result.winner).toBeGreaterThanOrEqual(0);
    expect(result.winner).toBeLessThan(4);
    expect(result.turnsPlayed).toBeGreaterThan(0);
    expect(result.state.hands[result.winner!]).toHaveLength(0);
  });

  it("reports turn-limit exhaustion without pretending the game completed", () => {
    const result = autoPlayGame(createGame(), { maxTurns: 0 });

    expect(result.completed).toBe(false);
    expect(result.reason).toBe("turn_limit");
    expect(result.winner).toBeNull();
    expect(result.turnsPlayed).toBe(0);
  });

  it("preserves game invariants through a completed autoplay game", () => {
    const initial = createGame();
    const initialTotal = totalCards(initial);

    const result = autoPlayGame(initial, {
      maxTurns: 1000,
      onTurn: (state) => {
        expect(state.currentPlayer).toBeGreaterThanOrEqual(0);
        expect(state.currentPlayer).toBeLessThan(4);
        expect([1, -1]).toContain(state.direction);
        expect(["red", "blue", "green", "yellow"]).toContain(state.activeColor);
        expect(state.pendingDraw).toBeGreaterThanOrEqual(0);
        expect(state.discardPile.length).toBeGreaterThan(0);
        expect(totalCards(state)).toBe(initialTotal);
      },
    });

    expect(result.completed).toBe(true);
    expect(result.winner).not.toBeNull();
    expect(result.state.hands.filter((hand) => hand.length === 0)).toHaveLength(1);
    expect(result.state.hands[result.winner!]).toHaveLength(0);
    expect(totalCards(result.state)).toBe(initialTotal);
  });

  it("repeatedly completes autoplay games within a practical turn limit", () => {
    let maxTurns = 0;

    for (let i = 0; i < 50; i++) {
      const result = autoPlayGame(createGame(), { maxTurns: 3000 });
      maxTurns = Math.max(maxTurns, result.turnsPlayed);

      expect(result.completed).toBe(true);
      expect(result.reason).toBe("winner");
      expect(result.winner).not.toBeNull();
      expect(result.state.hands[result.winner!]).toHaveLength(0);
    }

    expect(maxTurns).toBeLessThan(3000);
  });
});
