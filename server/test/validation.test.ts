import { describe, expect, it } from "vitest";
import { validateMessage, playCardSchema, chatSchema } from "../src/schemas/index.ts";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { makeTestClient } from "./testClients.ts";

describe("validateMessage", () => {
  describe("playCardSchema", () => {
    it("accepts valid payload", () => {
      const result = validateMessage(playCardSchema, { cardId: "abc123", chosenColor: "red" });
      expect(result.ok).toBe(true);
    });

    it("accepts payload without optional chosenColor", () => {
      const result = validateMessage(playCardSchema, { cardId: "abc123" });
      expect(result.ok).toBe(true);
    });

    it("accepts cardId at max length (64)", () => {
      const result = validateMessage(playCardSchema, { cardId: "x".repeat(64) });
      expect(result.ok).toBe(true);
    });

    it("rejects missing cardId", () => {
      const result = validateMessage(playCardSchema, {});
      expect(result.ok).toBe(false);
    });

    it("rejects empty cardId", () => {
      const result = validateMessage(playCardSchema, { cardId: "" });
      expect(result.ok).toBe(false);
    });

    it("rejects cardId too long (65)", () => {
      const result = validateMessage(playCardSchema, { cardId: "x".repeat(65) });
      expect(result.ok).toBe(false);
    });

    it("rejects invalid chosenColor", () => {
      const result = validateMessage(playCardSchema, { cardId: "abc", chosenColor: "purple" });
      expect(result.ok).toBe(false);
    });

    it("rejects unknown extra fields", () => {
      const result = validateMessage(playCardSchema, { cardId: "abc", unknown: true });
      expect(result.ok).toBe(false);
    });

    it("rejects non-object payloads", () => {
      expect(validateMessage(playCardSchema, null).ok).toBe(false);
      expect(validateMessage(playCardSchema, "string").ok).toBe(false);
      expect(validateMessage(playCardSchema, 42).ok).toBe(false);
      expect(validateMessage(playCardSchema, undefined).ok).toBe(false);
    });

    it("rejects array as payload", () => {
      expect(validateMessage(playCardSchema, [1, 2, 3]).ok).toBe(false);
    });
  });

  describe("chatSchema", () => {
    it("accepts valid text", () => {
      const result = validateMessage(chatSchema, { text: "Hello!" });
      expect(result.ok).toBe(true);
    });

    it("accepts text at max length (200)", () => {
      const result = validateMessage(chatSchema, { text: "x".repeat(200) });
      expect(result.ok).toBe(true);
    });

    it("rejects missing text", () => {
      const result = validateMessage(chatSchema, {});
      expect(result.ok).toBe(false);
    });

    it("rejects empty text", () => {
      const result = validateMessage(chatSchema, { text: "" });
      expect(result.ok).toBe(false);
    });

    it("rejects text too long (201)", () => {
      const result = validateMessage(chatSchema, { text: "x".repeat(201) });
      expect(result.ok).toBe(false);
    });

    it("rejects non-string text", () => {
      expect(validateMessage(chatSchema, { text: 123 }).ok).toBe(false);
      expect(validateMessage(chatSchema, { text: null }).ok).toBe(false);
      expect(validateMessage(chatSchema, { text: undefined }).ok).toBe(false);
    });
  });
});

describe("UnoRoom message handlers - validation integration", () => {
  it("handlePlayCard rejects invalid payload via schema", () => {
    const room = new UnoRoom();
    room.onCreate();

    const errors: unknown[] = [];
    const client = makeTestClient("test-session", (_type: string, data: unknown) => {
      errors.push(data);
    });

    const result = validateMessage(playCardSchema, { invalid: true });
    expect(result.ok).toBe(false);

    room.onDispose();
  });

  it("handleChat rejects invalid payload via schema", () => {
    const result = validateMessage(chatSchema, { text: 123 });
    expect(result.ok).toBe(false);
  });

  it("valid payloads pass schema validation", () => {
    expect(validateMessage(playCardSchema, { cardId: "test" }).ok).toBe(true);
    expect(validateMessage(chatSchema, { text: "hello" }).ok).toBe(true);
  });
});
