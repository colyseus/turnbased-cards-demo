import assert from "node:assert/strict";
import test from "node:test";
import { snapshotState } from "../src/stateSnapshot.ts";
import type { UnoState } from "../src/gameTypes.ts";

test("snapshotState preserves zero-valued rematch votes", () => {
  const state = {
    rematchVotes: [0, 2],
    players: new Map(),
    discardPile: [],
    chatMessages: [],
  } as UnoState;

  const snapshot = snapshotState(state);
  assert.deepEqual(snapshot.rematchVotes, [0, 2]);
});
