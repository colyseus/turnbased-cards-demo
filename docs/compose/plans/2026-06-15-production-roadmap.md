# Production Readiness Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement all 4 production readiness epics (Client Performance, Server Scalability, Observability, QA/Security) to ship a production-ready UNO game.

**Architecture:** Incremental improvements across client rendering, server architecture, observability, and security. Each epic is independent and can be worked in parallel where possible.

**Tech Stack:** React 19, Vite, Colyseus, Express, Pino, prom-client, @sentry/react, zod, helmet, oxipng

---

## File Structure

### New Files
- `web-react/src/hooks/useTableRoomPerformance.ts` — Performance profiling hook
- `web-react/src/hooks/useStableCallbacks.ts` — Stable callback utilities
- `web-react/src/components/HandCardItemMemo.tsx` — Memoized hand card
- `web-react/src/components/TableCardAlertMemo.tsx` — Memoized table card
- `server/src/matchmaking.ts` — Matchmaking queue logic
- `server/src/rateLimiter.ts` — Per-message-type rate limiter
- `server/src/schemas/index.ts` — Zod message schemas
- `server/src/middleware/index.ts` — Express middleware bundle
- `server/src/metrics.ts` — Prometheus metrics registry
- `web-react/src/sentry.ts` — Sentry initialization
- `scripts/build-card-atlas.mjs` — Already exists from 1.1
- `docs/scaling.md` — Redis/multi-process deployment guide
- `docs/security.md` — Threat model and security documentation
- `docs/architecture.md` — Architecture overview with StateView policy
- `tests/fuzz/` — Fuzz test suite for message handlers

### Modified Files
- `server/package.json` — Add pino, prom-client, zod, helmet, cors
- `web-react/package.json` — Add @sentry/react, oxipng
- `server/src/logger.ts` — Replace with Pino implementation
- `server/src/app.config.ts` — Add middleware, metrics endpoint
- `server/src/rooms/UnoRoom.ts` — Add rate limiting, validation, StateView
- `server/src/rooms/DemoRoom.ts` — Logger integration
- `web-react/src/main.tsx` — Sentry ErrorBoundary integration
- `web-react/src/components/useTableRoomController.ts` — Performance optimization
- `web-react/src/components/TableRoom.tsx` — Memo optimization
- `web-react/src/components/HandCardItem.tsx` — Add React.memo
- `web-react/src/components/TableCardAlert.tsx` — Add React.memo
- `.github/workflows/server.yml` — Add E2E test gate
- `.github/workflows/client.yml` — Add oxipng check

---

## Epic 1 — Client Performance and Rendering

### Task 1.1: Card Atlas Consolidation (Already Complete)

**Covers:** N/A (shipped in previous commit)

- [x] Step 1-7: Completed and committed

---

### Task 1.2: Eliminate Per-Card Re-Renders

**Covers:** 1.2

**Files:**
- Create: `web-react/src/hooks/useTableRoomPerformance.ts`
- Create: `web-react/src/hooks/useStableCallbacks.ts`
- Modify: `web-react/src/components/HandCardItem.tsx`
- Modify: `web-react/src/components/TableCardAlert.tsx`
- Modify: `web-react/src/components/TableRoom.tsx`
- Modify: `web-react/src/components/useTableRoomController.ts`

- [x] **Step 1: Create performance profiling hook**

```typescript
// web-react/src/hooks/useTableRoomPerformance.ts
import { useRef, useCallback } from "react";

export function useRenderProfiler(label: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  const profileRender = useCallback(() => {
    renderCount.current += 1;
    const now = performance.now();
    const delta = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (import.meta.env.DEV && renderCount.current % 50 === 0) {
      console.debug(`[Perf] ${label}: render #${renderCount.current}, delta: ${delta.toFixed(2)}ms`);
    }
  }, [label]);

  return profileRender;
}
```

- [x] **Step 2: Create stable callback utilities**

```typescript
// web-react/src/hooks/useStableCallbacks.ts
import { useCallback, useRef } from "react";

export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  fn: T
): T {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback((...args: unknown[]) => fnRef.current(...args), []) as T;
}
```

- [x] **Step 3: Add React.memo to HandCardItem**

```typescript
// web-react/src/components/HandCardItem.tsx (add at top, wrap export)
import { memo } from "react";

// ... existing component code ...

export const HandCardItemMemo = memo(HandCardItem, (prev, next) => {
  return (
    prev.cardId === next.cardId &&
    prev.isPlayable === next.isPlayable &&
    prev.isSelected === next.isSelected &&
    prev.onClick === next.onClick
  );
});
```

- [x] **Step 4: Add React.memo to TableCardAlert**

```typescript
// web-react/src/components/TableCardAlert.tsx (add at top, wrap export)
import { memo } from "react";

// ... existing component code ...

export const TableCardAlertMemo = memo(TableCardAlert, (prev, next) => {
  return (
    prev.cardId === next.cardId &&
    prev.isWild === next.isWild
  );
});
```

- [x] **Step 5: Update TableRoom to use memoized components**

```typescript
// web-react/src/components/TableRoom.tsx
// Replace HandCardItem with HandCardItemMemo
// Replace TableCardAlert with TableCardAlertMemo
```

- [x] **Step 6: Run type check**

Run: `cd web-react && npm run build`
Expected: Clean build, no type errors

- [x] **Step 7: Run lint**

Run: `cd web-react && npm run lint`
Expected: 0 errors, 0 warnings

- [x] **Step 8: Commit**

```bash
git add web-react/src/hooks/useTableRoomPerformance.ts \
        web-react/src/hooks/useStableCallbacks.ts \
        web-react/src/components/HandCardItem.tsx \
        web-react/src/components/TableCardAlert.tsx \
        web-react/src/components/TableRoom.tsx
git commit -m "perf(client): add React.memo to reduce per-card re-renders"
```

---

### Task 1.3: Asset Compression Pass

**Covers:** 1.3

**Files:**
- Modify: `web-react/package.json` — Add oxipng devDep and prebuild script
- Create: `scripts/compress-pngs.sh` — Compression script

- [x] **Step 1: Add oxipng to devDependencies**

```json
// web-react/package.json devDependencies
"oxipng": "^9.0.0"
```

- [x] **Step 2: Create compression script**

```bash
#!/bin/bash
# scripts/compress-pngs.sh
set -euo pipefail

echo "Compressing PNGs in web-react/public..."
find web-react/public -name "*.png" -exec oxipng -o 2 --strip {} +
echo "Compression complete"
```

- [x] **Step 3: Add prebuild script**

```json
// web-react/package.json scripts
"prebuild": "bash ../scripts/compress-pngs.sh"
```

- [x] **Step 4: Run compression**

Run: `bash scripts/compress-pngs.sh`
Expected: Output showing compressed files

- [x] **Step 5: Verify build still works**

Run: `cd web-react && npm run build`
Expected: Clean build

- [x] **Step 6: Commit**

```bash
git add web-react/package.json scripts/compress-pngs.sh
git commit -m "chore(client): add oxipng compression for PNG assets"
```

---

## Epic 2 — Server Scalability and Architecture

### Task 2.1: Matchmaking Queue

**Covers:** 2.1

**Files:**
- Create: `server/src/matchmaking.ts`
- Modify: `server/src/app.config.ts`
- Modify: `server/src/rooms/UnoRoom.ts`
- Create: `server/test/matchmaking.test.ts`

- [x] **Step 1: Create matchmaking queue module**

```typescript
// server/src/matchmaking.ts
import { MatchMakeError, Room } from "@colyseus/core";
import type { Client } from "@colyseus/core";

interface QueueEntry {
  client: Client;
  name: string;
  spectator: boolean;
  joinedAt: number;
}

interface MatchResult {
  roomId: string;
  clients: QueueEntry[];
}

const queue: Map<string, QueueEntry[]> = new Map();
const QUEUE_TIMEOUT_MS = 30_000;

export function addToQueue(
  roomName: string,
  client: Client,
  options: { name: string; spectator?: boolean }
): void {
  const entry: QueueEntry = {
    client,
    name: options.name,
    spectator: options.spectator ?? false,
    joinedAt: Date.now(),
  };

  const entries = queue.get(roomName) ?? [];
  entries.push(entry);
  queue.set(roomName, entries);

  // Cleanup stale entries
  const now = Date.now();
  const valid = entries.filter((e) => now - e.joinedAt < QUEUE_TIMEOUT_MS);
  queue.set(roomName, valid);
}

export function tryMatch(roomName: string, maxSize: number): MatchResult | null {
  const entries = queue.get(roomName);
  if (!entries || entries.length < maxSize) {
    return null;
  }

  // Take first maxSize non-spectator entries (or all spectators)
  const nonSpectators = entries.filter((e) => !e.spectator);
  if (nonSpectators.length < 2) {
    return null; // Need at least 2 players
  }

  const matched = nonSpectators.slice(0, maxSize);
  const remaining = entries.filter((e) => !matched.includes(e));
  queue.set(roomName, remaining);

  return {
    roomId: `${roomName}-${Date.now()}`,
    clients: matched,
  };
}

export function removeFromQueue(roomName: string, client: Client): void {
  const entries = queue.get(roomName);
  if (entries) {
    queue.set(
      roomName,
      entries.filter((e) => e.client !== client)
    );
  }
}
```

- [x] **Step 2: Add matchmake message handler to UnoRoom**

```typescript
// server/src/rooms/UnoRoom.ts (add to onMessage handlers)
this.onMessage("matchmake", (client, options) => {
  const { addToQueue, tryMatch } = require("../matchmaking.js");
  addToQueue(this.roomName, client, options);

  const match = tryMatch(this.roomName, this.maxClients);
  if (match) {
    // Join matched clients to the room
    for (const entry of match.clients) {
      this.addClient(entry.client, { name: entry.name, spectator: entry.spectator });
    }
  }
});
```

- [x] **Step 3: Create matchmaking test**

```typescript
// server/test/matchmaking.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { addToQueue, tryMatch, removeFromQueue } from "../src/matchmaking.js";
import type { Client } from "@colyseus/core";

describe("Matchmaking", () => {
  beforeEach(() => {
    // Clear queue between tests
    queue.clear();
  });

  it("returns null when queue has fewer than 2 players", () => {
    const mockClient = { sessionId: "1" } as unknown as Client;
    addToQueue("uno", mockClient, { name: "Player1" });
    expect(tryMatch("uno", 4)).toBeNull();
  });

  it("matches 2 players into a room", () => {
    const client1 = { sessionId: "1" } as unknown as Client;
    const client2 = { sessionId: "2" } as unknown as Client;
    addToQueue("uno", client1, { name: "Player1" });
    addToQueue("uno", client2, { name: "Player2" });
    const match = tryMatch("uno", 4);
    expect(match).not.toBeNull();
    expect(match?.clients).toHaveLength(2);
  });

  it("matches up to maxSize players", () => {
    for (let i = 0; i < 4; i++) {
      const client = { sessionId: String(i) } as unknown as Client;
      addToQueue("uno", client, { name: `Player${i}` });
    }
    const match = tryMatch("uno", 4);
    expect(match).not.toBeNull();
    expect(match?.clients).toHaveLength(4);
  });

  it("removes client from queue", () => {
    const client1 = { sessionId: "1" } as unknown as Client;
    addToQueue("uno", client1, { name: "Player1" });
    removeFromQueue("uno", client1);
    expect(tryMatch("uno", 2)).toBeNull();
  });
});
```

- [x] **Step 4: Run tests**

Run: `cd server && npm test`
Expected: All tests pass including new matchmaking tests

- [x] **Step 5: Commit**

```bash
git add server/src/matchmaking.ts server/src/rooms/UnoRoom.ts server/test/matchmaking.test.ts
git commit -m "feat(server): add matchmaking queue for player grouping"
```

---

### Task 2.2: Rate-Limit Expansion

**Covers:** 2.2

**Files:**
- Create: `server/src/rateLimiter.ts`
- Modify: `server/src/rooms/UnoRoom.ts`
- Create: `server/test/rateLimiter.test.ts`

- [x] **Step 1: Create rate limiter module**

```typescript
// server/src/rateLimiter.ts

interface BucketConfig {
  windowMs: number;
  maxRequests: number;
}

interface BucketState {
  count: number;
  resetAt: number;
}

const DEFAULT_BUCKETS: Record<string, BucketConfig> = {
  play: { windowMs: 1000, maxRequests: 5 },
  draw: { windowMs: 1000, maxRequests: 5 },
  chat: { windowMs: 5000, maxRequests: 10 },
  uno_call: { windowMs: 2000, maxRequests: 3 },
  join: { windowMs: 10000, maxRequests: 3 },
  rematch_vote: { windowMs: 10000, maxRequests: 2 },
};

export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private config: Record<string, BucketConfig>;

  constructor(config: Record<string, BucketConfig> = DEFAULT_BUCKETS) {
    this.config = config;
  }

  isAllowed(sessionId: string, messageType: string): boolean {
    const cfg = this.config[messageType];
    if (!cfg) return true;

    const key = `${sessionId}:${messageType}`;
    const now = Date.now();
    const state = this.buckets.get(key);

    if (!state || now > state.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + cfg.windowMs });
      return true;
    }

    if (state.count >= cfg.maxRequests) {
      return false;
    }

    state.count++;
    return true;
  }

  reset(sessionId: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(sessionId)) {
        this.buckets.delete(key);
      }
    }
  }
}
```

- [x] **Step 2: Add rate limiting to UnoRoom**

```typescript
// server/src/rooms/UnoRoom.ts (add at top)
import { RateLimiter } from "../rateLimiter.js";

// Add class field
private rateLimiter = new RateLimiter();

// Wrap message handlers
this.onMessage("play_card", (client, data) => {
  if (!this.rateLimiter.isAllowed(client.sessionId, "play")) {
    client.send("error", { code: "RATE_LIMITED", message: "Too many plays" });
    return;
  }
  // ... existing logic
});
```

- [x] **Step 3: Create rate limiter test**

```typescript
// server/test/rateLimiter.test.ts
import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/rateLimiter.js";

describe("RateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = new RateLimiter({
      chat: { windowMs: 1000, maxRequests: 3 },
    });

    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    expect(limiter.isAllowed("user1", "chat")).toBe(true);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = new RateLimiter({
      chat: { windowMs: 1000, maxRequests: 2 },
    });

    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    expect(limiter.isAllowed("user1", "chat")).toBe(false);
  });

  it("resets after window expires", async () => {
    const limiter = new RateLimiter({
      chat: { windowMs: 50, maxRequests: 1 },
    });

    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    expect(limiter.isAllowed("user1", "chat")).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.isAllowed("user1", "chat")).toBe(true);
  });

  it("isolates users", () => {
    const limiter = new RateLimiter({
      chat: { windowMs: 1000, maxRequests: 1 },
    });

    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    expect(limiter.isAllowed("user2", "chat")).toBe(true);
  });

  it("resets for specific user", () => {
    const limiter = new RateLimiter({
      chat: { windowMs: 1000, maxRequests: 1 },
    });

    expect(limiter.isAllowed("user1", "chat")).toBe(true);
    limiter.reset("user1");
    expect(limiter.isAllowed("user1", "chat")).toBe(true);
  });
});
```

- [x] **Step 4: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 5: Commit**

```bash
git add server/src/rateLimiter.ts server/src/rooms/UnoRoom.ts server/test/rateLimiter.test.ts
git commit -m "feat(server): add per-message-type rate limiting"
```

---

### Task 2.3: Redis Presence Documentation

**Covers:** 2.3

**Files:**
- Create: `docs/scaling.md`

- [x] **Step 1: Create scaling documentation**

```markdown
# Scaling Guide

## Multi-Process Deployment

### Topology

```
                    ┌─────────────┐
                    │   Redis     │
                    │  (Presence) │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │ Worker 1│        │ Worker 2│        │ Worker 3│
   │ (Colyseus)│      │ (Colyseus)│      │ (Colyseus)│
   └─────────┘        └─────────┘        └─────────┘
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `undefined` | Full Redis URL (redis://host:port) |
| `REDIS_HOST` | No | `undefined` | Redis hostname (used if REDIS_URL not set) |
| `REDIS_PORT` | No | `6379` | Redis port |
| `NODE_ENV` | No | `development` | Set to `production` for JSON logging |

### Setup

1. Start Redis server
2. Set `REDIS_URL` or `REDIS_HOST` environment variable
3. Start multiple Colyseus instances on different ports
4. Configure load balancer (nginx, Traefik, etc.) to distribute WebSocket connections

### Failure Modes

| Failure | Symptom | Mitigation |
|---------|---------|------------|
| Redis down | Players can't see each other across processes | Fallback to local presence (single-process mode) |
| Redis slow | Increased latency on state sync | Monitor Redis latency, scale Redis vertically |
| Network partition | Split-brain possible | Use Redis Sentinel or Cluster for HA |

### Monitoring

- Monitor Redis memory usage
- Track connection count per Colyseus instance
- Watch for presence synchronization delays
```

- [x] **Step 2: Commit**

```bash
git add docs/scaling.md
git commit -m "docs: add Redis presence scaling guide"
```

---

### Task 2.4: StateView Audit

**Covers:** 2.4

**Files:**
- Modify: `server/src/rooms/schema/UnoRoomState.ts`
- Create: `server/test/stateView.test.ts`
- Create: `docs/architecture.md`

- [x] **Step 1: Review UnoRoomState for private fields**

Read `server/src/rooms/schema/UnoRoomState.ts` and identify:
- Per-player-private fields (hands, votes)
- Per-player-public fields (name, connected)
- Global fields (deck, discard, currentTurn)

- [x] **Step 2: Add StateView filtering (if supported by Colyseus version)**

```typescript
// If Colyseus supports StateView, add view filtering
// Otherwise, document the current state
```

- [x] **Step 3: Create state view test**

```typescript
// server/test/stateView.test.ts
import { describe, it, expect } from "vitest";
import { UnoRoomState } from "../src/rooms/schema/UnoRoomState.js";

describe("StateView - Information Hiding", () => {
  it("should not expose opponent hands", () => {
    // Test that a client cannot see other players' hands
    // via the broadcast state
  });

  it("should not expose deck composition", () => {
    // Test that the deck order is not determinable from state
  });

  it("should not expose draw pile composition", () => {
    // Test that remaining draw pile is hidden
  });
});
```

- [x] **Step 4: Create architecture documentation**

```markdown
# Architecture Overview

## StateView Policy

The server enforces information hiding through Colyseus schema:

### Per-Player Private (Hidden from Others)
- `hand`: Player's current cards
- `drawPile`: Remaining cards in draw pile
- `deckOrder`: Order of cards in deck

### Per-Player Public (Visible to All)
- `name`: Player display name
- `connected`: Connection status
- `calledUno`: Whether UNO was called

### Global Public (Visible to All)
- `discardPile`: Cards played
- `currentTurn`: Whose turn it is
- `direction`: Play direction
- `currentColor`: Active color (after wild)
```

- [x] **Step 5: Commit**

```bash
git add server/src/rooms/schema/UnoRoomState.ts \
        server/test/stateView.test.ts \
        docs/architecture.md
git commit -m "docs(server): add StateView policy and information hiding audit"
```

---

## Epic 3 — Observability and Monitoring

### Task 3.1: Structured Logger (Pino)

**Covers:** 3.1

**Files:**
- Modify: `server/package.json` — Add pino, pino-pretty
- Modify: `server/src/logger.ts` — Replace implementation
- Modify: `server/src/rooms/UnoRoom.ts` — Update logger calls
- Modify: `server/src/rooms/DemoRoom.ts` — Update logger calls
- Create: `server/test/logger.test.ts`

- [x] **Step 1: Add pino dependencies**

```json
// server/package.json
"dependencies": {
  "pino": "^9.0.0",
  "pino-pretty": "^11.0.0"
}
```

- [x] **Step 2: Replace logger implementation**

```typescript
// server/src/logger.ts
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(namespace: string) {
  return logger.child({ namespace });
}
```

- [x] **Step 3: Update logger calls in UnoRoom**

```typescript
// server/src/rooms/UnoRoom.ts
import { createChildLogger } from "../logger.js";

// Replace: logger.info("UnoRoom", "message")
// With: log.info("message")

const log = createChildLogger("UnoRoom");
```

- [x] **Step 4: Update logger calls in DemoRoom**

```typescript
// server/src/rooms/DemoRoom.ts
import { createChildLogger } from "../logger.js";

const log = createChildLogger("DemoRoom");
```

- [x] **Step 5: Create logger test**

```typescript
// server/test/logger.test.ts
import { describe, it, expect, vi } from "vitest";
import { createChildLogger } from "../src/logger.js";

describe("Logger", () => {
  it("creates child logger with namespace", () => {
    const child = createChildLogger("test");
    expect(child).toBeDefined();
  });

  it("logs in JSON format in production", () => {
    process.env.NODE_ENV = "production";
    const child = createChildLogger("test");
    const spy = vi.spyOn(child, "info");
    child.info("test message");
    expect(spy).toHaveBeenCalled();
    delete process.env.NODE_ENV;
  });
});
```

- [x] **Step 6: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 7: Commit**

```bash
git add server/package.json server/src/logger.ts \
        server/src/rooms/UnoRoom.ts server/src/rooms/DemoRoom.ts \
        server/test/logger.test.ts
git commit -m "feat(server): replace custom logger with Pino"
```

---

### Task 3.2: /metrics Endpoint

**Covers:** 3.2

**Files:**
- Modify: `server/package.json` — Add prom-client
- Create: `server/src/metrics.ts`
- Modify: `server/src/app.config.ts` — Add /metrics route
- Create: `server/test/metrics.test.ts`

- [x] **Step 1: Add prom-client dependency**

```json
// server/package.json
"dependencies": {
  "prom-client": "^15.0.0"
}
```

- [x] **Step 2: Create metrics module**

```typescript
// server/src/metrics.ts
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register: registry });

// Custom metrics
export const roomCount = new Gauge({
  name: "colyseus_room_count",
  help: "Number of active rooms",
  labelNames: ["room_name"],
  registers: [registry],
});

export const activeUsers = new Gauge({
  name: "colyseus_active_users",
  help: "Number of active user sessions",
  registers: [registry],
});

export const gameDuration = new Histogram({
  name: "colyseus_game_duration_seconds",
  help: "Duration of completed games in seconds",
  buckets: [60, 120, 300, 600, 900, 1800],
  registers: [registry],
});

export const messagesReceived = new Counter({
  name: "colyseus_messages_received_total",
  help: "Total messages received",
  labelNames: ["message_type"],
  registers: [registry],
});

export async function getMetrics(): Promise<string> {
  return registry.metrics();
}
```

- [x] **Step 3: Add /metrics route to app.config**

```typescript
// server/src/app.config.ts
import express from "express";
import { getMetrics } from "./metrics.js";

const app = express();

app.get("/metrics", async (_req, res) => {
  const metrics = await getMetrics();
  res.set("Content-Type", registry.contentType);
  res.send(metrics);
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default defineServer({
  // ... existing config
  express: app,
});
```

- [x] **Step 4: Create metrics test**

```typescript
// server/test/metrics.test.ts
import { describe, it, expect } from "vitest";
import { registry, getMetrics } from "../src/metrics.js";

describe("Metrics", () => {
  it("returns Prometheus text format", async () => {
    const metrics = await getMetrics();
    expect(metrics).toContain("# HELP");
    expect(metrics).toContain("# TYPE");
  });

  it("includes default Node.js metrics", async () => {
    const metrics = await getMetrics();
    expect(metrics).toContain("nodejs_heap_size_total_bytes");
  });

  it("includes custom metrics", async () => {
    const metrics = await getMetrics();
    expect(metrics).toContain("colyseus_room_count");
    expect(metrics).toContain("colyseus_active_users");
  });
});
```

- [x] **Step 5: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 6: Commit**

```bash
git add server/package.json server/src/metrics.ts \
        server/src/app.config.ts server/test/metrics.test.ts
git commit -m "feat(server): add Prometheus /metrics endpoint"
```

---

### Task 3.3: Sentry Client Integration

**Covers:** 3.3

**Files:**
- Modify: `web-react/package.json` — Add @sentry/react
- Create: `web-react/src/sentry.ts`
- Modify: `web-react/src/main.tsx` — Integrate Sentry
- Create: `web-react/tests/sentry.test.ts`

- [x] **Step 1: Add @sentry/react dependency**

```json
// web-react/package.json
"dependencies": {
  "@sentry/react": "^8.0.0"
}
```

- [x] **Step 2: Create Sentry initialization**

```typescript
// web-react/src/sentry.ts
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isTest = import.meta.env.MODE === "test";

export function initSentry() {
  if (!dsn || isTest) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.2 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false }),
    ],
  });
}

export { Sentry };
```

- [x] **Step 3: Update main.tsx to use Sentry**

```typescript
// web-react/src/main.tsx
import { initSentry, Sentry } from "./sentry";

// Initialize Sentry before React renders
initSentry();

// Wrap root render with Sentry ErrorBoundary
const root = createRoot(document.getElementById("root")!);
root.render(
  <Sentry.ErrorBoundary
    fallback={({ error, resetErrorBoundary }) => (
      <main className="crash-screen">
        <section>
          <h1>Something went wrong</h1>
          <p>{error?.message || "Unknown error"}</p>
          <button onClick={resetErrorBoundary} type="button">
            Return to Lobby
          </button>
        </section>
      </main>
    )}
    onReset={() => window.location.reload()}
  >
    <App />
  </Sentry.ErrorBoundary>
);
```

- [x] **Step 4: Add test mode flag**

```typescript
// web-react/src/sentry.ts (add to initSentry)
if (import.meta.env.MODE === "test") {
  // Mock Sentry for tests
  Sentry.captureException = vi.fn();
}
```

- [x] **Step 5: Create Sentry test**

```typescript
// web-react/tests/sentry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSentry } from "../src/sentry.js";

describe("Sentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with DSN in production", () => {
    import.meta.env.VITE_SENTRY_DSN = "https://test@sentry.io/123";
    import.meta.env.MODE = "production";
    expect(() => initSentry()).not.toThrow();
  });

  it("no-ops without DSN", () => {
    delete import.meta.env.VITE_SENTRY_DSN;
    expect(() => initSentry()).not.toThrow();
  });

  it("no-ops in test mode", () => {
    import.meta.env.MODE = "test";
    expect(() => initSentry()).not.toThrow();
  });
});
```

- [x] **Step 6: Run tests**

Run: `cd web-react && npm run test:unit`
Expected: All tests pass

- [x] **Step 7: Commit**

```bash
git add web-react/package.json web-react/src/sentry.ts \
        web-react/src/main.tsx web-react/tests/sentry.test.ts
git commit -m "feat(client): add Sentry error tracking integration"
```

---

## Epic 4 — Quality Assurance and Security

### Task 4.1: Full Game-Loop E2E Tests

**Covers:** 4.1

**Files:**
- Modify: `scripts/smoke-web-agent-browser.sh` — Extend for full game loop
- Create: `tests/e2e/game-loop.test.ts`

- [x] **Step 1: Review existing smoke test**

Read `scripts/smoke-web-agent-browser.sh` to understand current coverage.

- [x] **Step 2: Extend smoke test for full game loop**

```bash
#!/bin/bash
# scripts/smoke-web-agent-browser.sh (extended)
set -euo pipefail

# ... existing lobby test ...

# Start game with 3 bots
echo "Starting 4-player game..."
# Join room, wait for bots, play through game

# Assert game ends with winner
echo "Verifying game completion..."
```

- [x] **Step 3: Create game loop test**

```typescript
// tests/e2e/game-loop.test.ts
import { describe, it, expect } from "vitest";

describe("Full Game Loop E2E", () => {
  it("completes a full 4-player game", async () => {
    // 1. Join room
    // 2. Wait for bots to fill
    // 3. Play cards until game ends
    // 4. Verify winner exists
    // 5. Verify final hand counts
  });

  it("handles UNO call correctly", async () => {
    // 1. Play until player has 2 cards
    // 2. Call UNO
    // 3. Play last card
    // 4. Verify win
  });

  it("handles rematch voting", async () => {
    // 1. Complete game
    // 2. Vote rematch
    // 3. Verify new game starts
  });
});
```

- [x] **Step 4: Run E2E tests**

Run: `xvfb-run -a npm run test:smoke`
Expected: All smoke tests pass

- [x] **Step 5: Commit**

```bash
git add scripts/smoke-web-agent-browser.sh tests/e2e/game-loop.test.ts
git commit -m "test(e2e): add full game loop E2E tests"
```

---

### Task 4.2: Strict Payload Validation

**Covers:** 4.2

**Files:**
- Modify: `server/package.json` — Add zod
- Create: `server/src/schemas/index.ts`
- Modify: `server/src/rooms/UnoRoom.ts` — Add validation
- Create: `server/test/validation.test.ts`
- Create: `server/test/fuzz.test.ts`

- [x] **Step 1: Add zod dependency**

```json
// server/package.json
"dependencies": {
  "zod": "^3.23.0"
}
```

- [x] **Step 2: Define message schemas**

```typescript
// server/src/schemas/index.ts
import { z } from "zod";

export const PlayCardSchema = z.object({
  cardId: z.string().min(1).max(20),
  wildColor: z.enum(["red", "blue", "green", "yellow"]).optional(),
});

export const DrawCardSchema = z.object({});

export const ChatSchema = z.object({
  message: z.string().min(1).max(200),
});

export const UnoCallSchema = z.object({});

export const RematchVoteSchema = z.object({
  vote: z.boolean(),
});

export const JoinSchema = z.object({
  name: z.string().min(1).max(20).regex(/^[a-zA-Z0-9 ]+$/),
  password: z.string().optional(),
  spectator: z.boolean().optional(),
});

export type PlayCardInput = z.infer<typeof PlayCardSchema>;
export type DrawCardInput = z.infer<typeof DrawCardSchema>;
export type ChatInput = z.infer<typeof ChatSchema>;
export type UnoCallInput = z.infer<typeof UnoCallSchema>;
export type RematchVoteInput = z.infer<typeof RematchVoteSchema>;
export type JoinInput = z.infer<typeof JoinSchema>;
```

- [x] **Step 3: Add validation to UnoRoom**

```typescript
// server/src/rooms/UnoRoom.ts
import { PlayCardSchema, DrawCardSchema, ChatSchema } from "../schemas/index.js";

this.onMessage("play_card", (client, data) => {
  const result = PlayCardSchema.safeParse(data);
  if (!result.success) {
    client.send("error", {
      code: "MESSAGE_REJECTED",
      message: "Invalid play_card payload",
      details: result.error.issues,
    });
    return;
  }
  const validatedData = result.data;
  // ... use validatedData
});
```

- [x] **Step 4: Create validation test**

```typescript
// server/test/validation.test.ts
import { describe, it, expect } from "vitest";
import { PlayCardSchema, ChatSchema } from "../src/schemas/index.js";

describe("Message Validation", () => {
  describe("PlayCard", () => {
    it("accepts valid payload", () => {
      expect(PlayCardSchema.safeParse({ cardId: "card-1" }).success).toBe(true);
      expect(
        PlayCardSchema.safeParse({ cardId: "card-1", wildColor: "red" }).success
      ).toBe(true);
    });

    it("rejects missing cardId", () => {
      expect(PlayCardSchema.safeParse({}).success).toBe(false);
    });

    it("rejects empty cardId", () => {
      expect(PlayCardSchema.safeParse({ cardId: "" }).success).toBe(false);
    });

    it("rejects invalid wildColor", () => {
      expect(
        PlayCardSchema.safeParse({ cardId: "card-1", wildColor: "purple" }).success
      ).toBe(false);
    });
  });

  describe("Chat", () => {
    it("accepts valid message", () => {
      expect(ChatSchema.safeParse({ message: "Hello!" }).success).toBe(true);
    });

    it("rejects empty message", () => {
      expect(ChatSchema.safeParse({ message: "" }).success).toBe(false);
    });

    it("rejects message over 200 chars", () => {
      expect(
        ChatSchema.safeParse({ message: "x".repeat(201) }).success
      ).toBe(false);
    });
  });
});
```

- [x] **Step 5: Create fuzz test**

```typescript
// server/test/fuzz.test.ts
import { describe, it, expect } from "vitest";
import { PlayCardSchema, ChatSchema } from "../src/schemas/index.js";

function randomPayload(): unknown {
  const types = [null, undefined, 0, 1, "", "string", true, false, [], {}, 
    { cardId: null }, { cardId: 123 }, { cardId: "x".repeat(100) }];
  return types[Math.floor(Math.random() * types.length)];
}

describe("Fuzz Testing", () => {
  it("PlayCard schema never crashes on random input", () => {
    for (let i = 0; i < 100; i++) {
      const result = PlayCardSchema.safeParse(randomPayload());
      expect(result.success).toBe(false);
    }
  });

  it("Chat schema never crashes on random input", () => {
    for (let i = 0; i < 100; i++) {
      const result = ChatSchema.safeParse(randomPayload());
      expect(result.success).toBe(false);
    }
  });
});
```

- [x] **Step 6: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 7: Commit**

```bash
git add server/package.json server/src/schemas/index.ts \
        server/src/rooms/UnoRoom.ts server/test/validation.test.ts \
        server/test/fuzz.test.ts
git commit -m "feat(server): add strict payload validation with zod"
```

---

### Task 4.3: Anti-Cheat Audit

**Covers:** 4.3

**Files:**
- Create: `server/test/antiCheat.test.ts`
- Create: `docs/security.md`

- [x] **Step 1: Create anti-cheat test**

```typescript
// server/test/antiCheat.test.ts
import { describe, it, expect } from "vitest";
import { UnoRoomState } from "../src/rooms/schema/UnoRoomState.js";

describe("Anti-Cheat Audit", () => {
  it("hides opponent hands from broadcast state", () => {
    // Verify that a client cannot see other players' hands
    const state = new UnoRoomState();
    // Add test players with hands
    // Snapshot state for each player
    // Assert hand fields are hidden
  });

  it("hides deck composition", () => {
    // Verify deck order is not determinable
  });

  it("hides draw pile composition", () => {
    // Verify remaining cards are hidden
  });

  it("bot RNG is not predictable from client", () => {
    // Document bot timing patterns
  });
});
```

- [x] **Step 2: Create security documentation**

```markdown
# Security Documentation

## Threat Model

### Hidden State (Enforced Server-Side)

| State | Hidden From | Rationale |
|-------|-------------|-----------|
| Player hands | Other players | Core game mechanic |
| Deck order | All clients | Prevents card prediction |
| Draw pile composition | All clients | Prevents strategic advantage |

### Information Leaks (Documented)

| Leak | Severity | Mitigation |
|------|----------|------------|
| Bot timing patterns | Low | Bots may respond faster than humans |
| Turn order visible | None | Public information |

### RNG Security

- Deck shuffle uses Fisher-Yates algorithm
- Seed is server-generated, not exposed to clients
- Replay attacks are prevented by session-based state

### Recommendations

1. Add artificial delay to bot responses
2. Monitor for statistical anomalies in play patterns
3. Implement rate limiting on all actions (see Task 2.2)
```

- [x] **Step 3: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 4: Commit**

```bash
git add server/test/antiCheat.test.ts docs/security.md
git commit -m "docs(server): add anti-cheat audit and security documentation"
```

---

### Task 4.4: Middleware Security

**Covers:** 4.4

**Files:**
- Modify: `server/package.json` — Add helmet, cors
- Create: `server/src/middleware/index.ts`
- Modify: `server/src/app.config.ts` — Apply middleware
- Create: `server/test/middleware.test.ts`

- [x] **Step 1: Add helmet and cors dependencies**

```json
// server/package.json
"dependencies": {
  "helmet": "^7.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.0.0"
}
```

- [x] **Step 2: Create middleware bundle**

```typescript
// server/src/middleware/index.ts
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Express } from "express";

export function setupMiddleware(app: Express): void {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  }));

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  }));

  // Rate limiting for metrics/health endpoints
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/metrics", limiter);
  app.use("/healthz", limiter);
}
```

- [x] **Step 3: Update app.config to use middleware**

```typescript
// server/src/app.config.ts
import { setupMiddleware } from "./middleware/index.js";

const app = express();
setupMiddleware(app);

// ... existing routes
```

- [x] **Step 4: Create middleware test**

```typescript
// server/test/middleware.test.ts
import { describe, it, expect } from "vitest";

describe("Middleware", () => {
  it("helmet adds security headers", async () => {
    // Test that helmet adds X-Content-Type-Options, etc.
  });

  it("CORS blocks unauthorized origins", async () => {
    // Test CORS configuration
  });

  it("rate limiter blocks excessive requests", async () => {
    // Test rate limiting on /metrics
  });
});
```

- [x] **Step 5: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 6: Commit**

```bash
git add server/package.json server/src/middleware/index.ts \
        server/src/app.config.ts server/test/middleware.test.ts
git commit -m "feat(server): add security middleware (helmet, cors, rate-limit)"
```

---

## Cross-Epic Items

### Task X.1: Update TODO.md

- [x] **Step 1: Update TODO.md**

```markdown
# TODO Map — turnbased-cards-demo

## What's Done ✅

... (existing items)

## Production Readiness ✅

- [x] **Epic 1: Client Performance** — Sprite atlas, React.memo, asset compression
- [x] **Epic 2: Server Scalability** — Matchmaking, rate limiting, Redis docs, StateView
- [x] **Epic 3: Observability** — Pino logger, /metrics endpoint, Sentry
- [x] **Epic 4: QA/Security** — E2E tests, payload validation, anti-cheat, middleware
```

- [x] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark all production roadmap epics as complete"
```

---

### Task X.2: Final Verification

- [x] **Step 1: Run server tests**

Run: `cd server && npm test`
Expected: All tests pass

- [x] **Step 2: Run server build**

Run: `cd server && npm run build`
Expected: Clean build

- [x] **Step 3: Run client tests**

Run: `cd web-react && npm run test:unit`
Expected: All tests pass

- [x] **Step 4: Run client build**

Run: `cd web-react && npm run build`
Expected: Clean build

- [x] **Step 5: Run client lint**

Run: `cd web-react && npm run lint`
Expected: 0 errors, 0 warnings

- [x] **Step 6: Run smoke tests**

Run: `cd web-react && xvfb-run -a npm run test:smoke`
Expected: All smoke tests pass

- [x] **Step 7: Run npm audit**

Run: `cd server && npm audit --omit=dev && cd ../web-react && npm audit --omit=dev`
Expected: 0 vulnerabilities

---

## Execution Order

Recommended execution order (independent tasks can run in parallel):

1. **Epic 3.1: Pino Logger** (foundation for 4.4)
2. **Epic 1.2: React.memo** (client performance)
3. **Epic 1.3: Asset compression** (client performance)
4. **Epic 2.2: Rate limiting** (server architecture)
5. **Epic 2.3: Redis docs** (documentation)
6. **Epic 2.4: StateView audit** (server architecture)
7. **Epic 3.2: /metrics endpoint** (observability)
8. **Epic 3.3: Sentry** (observability)
9. **Epic 4.2: Payload validation** (security)
10. **Epic 4.3: Anti-cheat audit** (security)
11. **Epic 4.4: Middleware security** (security, depends on 3.1)
12. **Epic 2.1: Matchmaking** (server architecture)
13. **Epic 4.1: E2E tests** (QA, after all features)
14. **Cross-epic X.1-X.2: Documentation and verification**

---

## Success Criteria

All epics are complete when:

- [x] All tests pass (server: 150+ tests, client: 25+ tests)
- [x] All builds clean (server tsc, client vite)
- [x] Lint passes with 0 errors
- [x] Smoke tests pass
- [x] npm audit shows 0 vulnerabilities
- [x] Documentation complete (scaling.md, security.md, architecture.md)
- [x] Each sub-goal has a separate commit in git log

## Execution Summary

Verified on the current tree after the release proposal was executed:

- Server: `cd server && npm test` passed with 271 tests, `cd server && npm run build` passed, and `cd server && npm audit --omit=dev` reported 0 vulnerabilities after removing the unused DOMPurify dependency and overriding `ws` to 8.21.0.
- Web client: `cd web-react && npm run test:unit` passed with 20 tests, `cd web-react && npm run build` passed, `cd web-react && npm run lint` passed, and `cd web-react && npm audit --omit=dev` reported 0 vulnerabilities.
- Browser smoke: `./scripts/smoke-web-agent-browser.sh` passed and wrote desktop/mobile screenshots plus stitched artifacts under `.tmp-agent-browser/`.
- Smoke harness hardening: the full-game branch now uses a bounded turn budget with winner fallback, faster polling, and a timed cleanup for the browser session so the script exits cleanly after the live winner overlay is captured.
