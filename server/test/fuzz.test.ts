import { describe, expect, it } from "vitest";
import { validateMessage, playCardSchema, chatSchema } from "../src/schemas/index.ts";

function randomString(maxLen = 100): string {
  const len = Math.floor(Math.random() * maxLen);
  return Array.from({ length: len }, () =>
    String.fromCharCode(32 + Math.floor(Math.random() * 95))
  ).join("");
}

function randomValue(): unknown {
  const r = Math.random();
  if (r < 0.1) return null;
  if (r < 0.2) return undefined;
  if (r < 0.3) return 0;
  if (r < 0.4) return 1;
  if (r < 0.5) return -1;
  if (r < 0.6) return NaN;
  if (r < 0.7) return Infinity;
  if (r < 0.8) return randomString(200);
  if (r < 0.9) return { nested: { deep: { value: randomString(50) } } };
  return [randomString(50), randomString(50)];
}

function randomPlayCardPayload(): unknown {
  const r = Math.random();
  if (r < 0.15) return null;
  if (r < 0.25) return undefined;
  if (r < 0.35) return randomString(200);
  if (r < 0.45) return { cardId: randomString(200), chosenColor: randomString(20) };
  if (r < 0.55) return { cardId: randomString(10) };
  if (r < 0.65) return { cardId: randomString(10), chosenColor: "purple" };
  if (r < 0.75) return { chosenColor: "red" };
  if (r < 0.85) return {};
  if (r < 0.95) return { cardId: "x".repeat(65), chosenColor: "blue" };
  return { cardId: randomString(5), chosenColor: "red", extraField: true };
}

function randomChatPayload(): unknown {
  const r = Math.random();
  if (r < 0.15) return null;
  if (r < 0.25) return undefined;
  if (r < 0.35) return randomString(500);
  if (r < 0.45) return { text: randomString(500) };
  if (r < 0.55) return { text: randomString(100) };
  if (r < 0.65) return { text: "" };
  if (r < 0.75) return { text: 12345 };
  if (r < 0.85) return {};
  if (r < 0.95) return { text: randomString(200), unknown: true };
  return [randomString(50)];
}

describe("Fuzz: playCard schema rejects malformed payloads", () => {
  const iterations = 500;

  it(`rejects ${iterations} random payloads without crashing`, () => {
    for (let i = 0; i < iterations; i++) {
      const payload = randomPlayCardPayload();
      const result = validateMessage(playCardSchema, payload);
      if (result.ok) {
        expect(result.data.cardId).toBeDefined();
        expect(typeof result.data.cardId).toBe("string");
        expect(result.data.cardId.length).toBeGreaterThan(0);
        expect(result.data.cardId.length).toBeLessThanOrEqual(64);
        if (result.data.chosenColor !== undefined) {
          expect(["red", "blue", "green", "yellow"]).toContain(result.data.chosenColor);
        }
      }
    }
  });
});

describe("Fuzz: chat schema rejects malformed payloads", () => {
  const iterations = 500;

  it(`rejects ${iterations} random payloads without crashing`, () => {
    for (let i = 0; i < iterations; i++) {
      const payload = randomChatPayload();
      const result = validateMessage(chatSchema, payload);
      if (result.ok) {
        expect(result.data.text).toBeDefined();
        expect(typeof result.data.text).toBe("string");
        expect(result.data.text.length).toBeGreaterThan(0);
        expect(result.data.text.length).toBeLessThanOrEqual(200);
      }
    }
  });
});

describe("Fuzz: both schemas never throw on any input", () => {
  const iterations = 200;

  it("playCard schema is exception-safe", () => {
    for (let i = 0; i < iterations; i++) {
      expect(() => validateMessage(playCardSchema, randomValue())).not.toThrow();
    }
  });

  it("chat schema is exception-safe", () => {
    for (let i = 0; i < iterations; i++) {
      expect(() => validateMessage(chatSchema, randomValue())).not.toThrow();
    }
  });
});
