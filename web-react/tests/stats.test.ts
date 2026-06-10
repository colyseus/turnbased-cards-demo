import assert from "node:assert/strict";
import test from "node:test";
import { getStats, updateStats } from "../src/stats.ts";

type StorageRecord = Record<string, string>;

function withMockStorage(initial: StorageRecord, fn: () => void) {
  const store = new Map(Object.entries(initial));
  const mockStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };

  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: mockStorage,
  });

  try {
    fn();
  } finally {
    if (original) {
      Object.defineProperty(globalThis, "localStorage", original);
    } else {
      delete (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage;
    }
  }

  return store;
}

test("getStats normalizes stored counters and malformed history", () => {
  withMockStorage(
    {
      uno_stats: JSON.stringify({
        played: "3",
        wins: "2",
        losses: "1",
        cardsPlayed: "18",
        botKnockouts: "4",
        history: { not: "an array" },
      }),
    },
    () => {
      const stats = getStats();
      assert.equal(stats.played, 3);
      assert.equal(stats.wins, 2);
      assert.equal(stats.losses, 1);
      assert.equal(stats.cardsPlayed, 18);
      assert.equal(stats.botKnockouts, 4);
      assert.deepEqual(stats.history, []);
    },
  );
});

test("getStats parses string boolean history fields correctly", () => {
  withMockStorage(
    {
      uno_stats: JSON.stringify({
        played: 1,
        wins: 0,
        losses: 1,
        cardsPlayed: 4,
        botKnockouts: 0,
        history: [
          {
            id: "match-1",
            timestamp: 123,
            win: "false",
            winnerName: "Bot 2",
            cardsPlayed: 4,
            durationSec: 30,
            opponentNames: ["Bot 1"],
          },
        ],
      }),
    },
    () => {
      const stats = getStats();
      assert.equal(stats.history?.[0]?.win, false);
    },
  );
});

test("updateStats recovers from malformed stored history", () => {
  const store = withMockStorage(
    {
      uno_stats: JSON.stringify({
        played: "1",
        wins: "1",
        losses: "0",
        cardsPlayed: "12",
        botKnockouts: "2",
        history: { legacy: true },
      }),
    },
    () => {
      updateStats(true, 7, 1, "Winner One", 12.4, ["Bot 2"]);
    },
  );

  const saved = JSON.parse(store.get("uno_stats") ?? "{}") as {
    played: number;
    wins: number;
    losses: number;
    cardsPlayed: number;
    botKnockouts: number;
    history: Array<{ opponentNames: string[]; winnerName: string }>;
  };

  assert.equal(saved.played, 2);
  assert.equal(saved.wins, 2);
  assert.equal(saved.losses, 0);
  assert.equal(saved.cardsPlayed, 19);
  assert.equal(saved.botKnockouts, 3);
  assert.equal(saved.history.length, 1);
  assert.deepEqual(saved.history[0].opponentNames, ["Bot 2"]);
  assert.equal(saved.history[0].winnerName, "Winner One");
});
