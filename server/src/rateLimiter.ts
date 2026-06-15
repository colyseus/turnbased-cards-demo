import { ACTION_COOLDOWN_MS } from "../shared/constants.ts";

export type RateLimitMessageType = "play_card" | "draw_card" | "challenge_wild_draw4" | "chat" | "uno_call" | "join";

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

const DEFAULT_COOLDOWNS: Record<RateLimitMessageType, number> = {
  play_card: ACTION_COOLDOWN_MS,
  draw_card: ACTION_COOLDOWN_MS,
  challenge_wild_draw4: ACTION_COOLDOWN_MS,
  chat: 1000,
  uno_call: 500,
  join: 1000,
};

export class RateLimiter {
  private lastTimestamps = new Map<string, number>();
  private cooldowns: Record<RateLimitMessageType, number>;

  constructor(cooldowns?: Partial<Record<RateLimitMessageType, number>>) {
    this.cooldowns = { ...DEFAULT_COOLDOWNS, ...cooldowns };
  }

  check(sessionId: string, messageType: RateLimitMessageType): RateLimitResult {
    const now = Date.now();
    const key = `${sessionId}:${messageType}`;
    const last = this.lastTimestamps.get(key) ?? 0;
    const cooldown = this.cooldowns[messageType];

    if (now - last < cooldown) {
      return { allowed: false, retryAfterMs: cooldown - (now - last) };
    }

    this.lastTimestamps.set(key, now);
    return { allowed: true };
  }

  clear(sessionId?: string) {
    if (sessionId) {
      for (const key of this.lastTimestamps.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
          this.lastTimestamps.delete(key);
        }
      }
    } else {
      this.lastTimestamps.clear();
    }
  }
}
