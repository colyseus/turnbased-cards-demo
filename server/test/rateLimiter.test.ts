import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../src/rateLimiter.ts";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", () => {
    const limiter = new RateLimiter();
    const result = limiter.check("session1", "play_card");
    expect(result.allowed).toBe(true);
  });

  it("blocks requests within the cooldown window", () => {
    const limiter = new RateLimiter({ play_card: 500 });
    limiter.check("session1", "play_card");

    vi.advanceTimersByTime(100);
    const result = limiter.check("session1", "play_card");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(400);
  });

  it("allows requests after the cooldown window", () => {
    const limiter = new RateLimiter({ play_card: 500 });
    limiter.check("session1", "play_card");

    vi.advanceTimersByTime(500);
    const result = limiter.check("session1", "play_card");
    expect(result.allowed).toBe(true);
  });

  it("tracks different message types independently", () => {
    const limiter = new RateLimiter({ play_card: 500, chat: 1000 });
    limiter.check("session1", "play_card");

    vi.advanceTimersByTime(500);
    // play_card is allowed again
    expect(limiter.check("session1", "play_card").allowed).toBe(true);

    // chat is allowed (different bucket)
    expect(limiter.check("session1", "chat").allowed).toBe(true);
  });

  it("tracks different sessions independently", () => {
    const limiter = new RateLimiter({ play_card: 500 });
    limiter.check("session1", "play_card");

    // session2 is not affected
    const result = limiter.check("session2", "play_card");
    expect(result.allowed).toBe(true);
  });

  it("clears timestamps for a specific session", () => {
    const limiter = new RateLimiter({ play_card: 500 });
    limiter.check("session1", "play_card");

    vi.advanceTimersByTime(100);
    limiter.clear("session1");

    // Should be allowed again after clear
    expect(limiter.check("session1", "play_card").allowed).toBe(true);
  });

  it("clears all timestamps when no session specified", () => {
    const limiter = new RateLimiter({ play_card: 500 });
    limiter.check("session1", "play_card");
    limiter.check("session2", "play_card");

    vi.advanceTimersByTime(100);
    limiter.clear();

    expect(limiter.check("session1", "play_card").allowed).toBe(true);
    expect(limiter.check("session2", "play_card").allowed).toBe(true);
  });

  it("uses default cooldowns when none specified", () => {
    const limiter = new RateLimiter();
    // Default for play_card is ACTION_COOLDOWN_MS (300)
    limiter.check("session1", "play_card");

    vi.advanceTimersByTime(200);
    expect(limiter.check("session1", "play_card").allowed).toBe(false);

    vi.advanceTimersByTime(100);
    expect(limiter.check("session1", "play_card").allowed).toBe(true);
  });

  it("returns correct retryAfterMs for chat", () => {
    const limiter = new RateLimiter();
    limiter.check("session1", "chat");

    vi.advanceTimersByTime(200);
    const result = limiter.check("session1", "chat");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(800);
  });

  it("handles join rate limiting", () => {
    const limiter = new RateLimiter();
    limiter.check("session1", "join");

    vi.advanceTimersByTime(500);
    const result = limiter.check("session1", "join");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(500);
  });

  it("handles uno_call rate limiting", () => {
    const limiter = new RateLimiter();
    limiter.check("session1", "uno_call");

    vi.advanceTimersByTime(200);
    const result = limiter.check("session1", "uno_call");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(300);
  });

  it("allows custom cooldown overrides", () => {
    const limiter = new RateLimiter({ chat: 200 });
    limiter.check("session1", "chat");

    vi.advanceTimersByTime(200);
    expect(limiter.check("session1", "chat").allowed).toBe(true);

    // chat has custom 200ms cooldown
    vi.advanceTimersByTime(100);
    expect(limiter.check("session1", "chat").allowed).toBe(false);
  });
});
