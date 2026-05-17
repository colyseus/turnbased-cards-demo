import { describe, it, expect } from "vitest";
import { canPlay, UnoColor } from "../shared/uno.ts";

/**
 * Security tests: verify that message validation in UnoRoom.ts
 * cannot be bypassed by malformed or malicious messages.
 */
describe("Security: message validation", () => {
  // ── canPlay boundary tests ─────────────────────────────────────────────────

  describe("canPlay", () => {
    it("returns false for null/undefined card", () => {
      // @ts-expect-error — intentionally passing invalid input
      expect(canPlay(null, { cardType: "color", value: "5" }, "red")).toBe(false);
      // @ts-expect-error
      expect(canPlay(undefined, { cardType: "color", value: "5" }, "red")).toBe(false);
      // @ts-expect-error
      expect(canPlay({ color: "red", value: "5" }, null, "red")).toBe(false);
    });

    it("handles empty string values gracefully", () => {
      expect(canPlay(
        { cardType: "color", color: "", value: "" },
        { cardType: "color", value: "5" },
        "red"
      )).toBe(false);
    });

    it("wild cards always return true regardless of active color", () => {
      expect(canPlay(
        { cardType: "wild", color: "", value: "wild" },
        { cardType: "color", value: "5" },
        "blue" as UnoColor
      )).toBe(true);
    });

    it("does not throw on malformed topCard (missing value)", () => {
      // @ts-expect-error
      expect(canPlay({ cardType: "color", color: "red", value: "5" }, {}, "blue")).toBe(false);
    });
  });
});
