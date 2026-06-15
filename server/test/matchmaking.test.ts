import { describe, expect, it, vi, beforeEach } from "vitest";
import { MatchQueue, QueueRoom, type MatchmakeOptions } from "../src/matchmaking.ts";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { makeTestClient } from "./testClients.ts";

describe("MatchQueue", () => {
  let queue: MatchQueue;

  beforeEach(() => {
    queue = new MatchQueue();
  });

  it("starts empty", () => {
    expect(queue.size).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it("enqueues a player", () => {
    const client = makeTestClient("session-1");
    queue.enqueue(client, "session-1", "Alice", { elo: 1000, region: "americas" });

    expect(queue.size).toBe(1);
    expect(queue.isEmpty).toBe(false);
  });

  it("removes a player by sessionId", () => {
    const client = makeTestClient("session-1");
    queue.enqueue(client, "session-1", "Alice");

    const removed = queue.remove("session-1");
    expect(removed).toBe(true);
    expect(queue.size).toBe(0);
  });

  it("returns false when removing non-existent player", () => {
    const removed = queue.remove("nonexistent");
    expect(removed).toBe(false);
  });

  it("groups players by region", () => {
    queue.enqueue(makeTestClient("s1"), "s1", "P1", { region: "americas" });
    queue.enqueue(makeTestClient("s2"), "s2", "P2", { region: "europe" });
    queue.enqueue(makeTestClient("s3"), "s3", "P3", { region: "americas" });

    const americasPlayers = queue.getPlayersByRegion("americas");
    const europePlayers = queue.getPlayersByRegion("europe");

    expect(americasPlayers).toHaveLength(2);
    expect(europePlayers).toHaveLength(1);
  });

  it("groups players by ELO bracket", () => {
    queue.enqueue(makeTestClient("s1"), "s1", "P1", { elo: 500 });   // beginner
    queue.enqueue(makeTestClient("s2"), "s2", "P2", { elo: 1000 });  // intermediate
    queue.enqueue(makeTestClient("s3"), "s3", "P3", { elo: 1800 }); // expert

    const beginners = queue.getPlayersByElo(500);
    const intermediates = queue.getPlayersByElo(1000);
    const experts = queue.getPlayersByElo(1800);

    expect(beginners).toHaveLength(1);
    expect(intermediates).toHaveLength(1);
    expect(experts).toHaveLength(1);
  });

  it("returns wait time for queued player", () => {
    queue.enqueue(makeTestClient("s1"), "s1", "P1");

    const waitTime = queue.getWaitTime("s1");
    expect(waitTime).toBeGreaterThanOrEqual(0);
    expect(waitTime).toBeLessThan(1000);
  });

  it("returns -1 for non-queued player", () => {
    const waitTime = queue.getWaitTime("nonexistent");
    expect(waitTime).toBe(-1);
  });

  it("matches 4 players from same region via auto-match", async () => {
    const factorySpy = vi.fn().mockResolvedValue(undefined);
    const q = new MatchQueue(factorySpy);

    for (let i = 0; i < 4; i++) {
      q.enqueue(makeTestClient(`s${i}`), `s${i}`, `P${i}`, { region: "americas" });
    }

    await vi.waitFor(() => {
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    const matched = factorySpy.mock.calls[0][0];
    expect(matched).toHaveLength(4);
    expect(matched.every((p: { region: string }) => p.region === "americas")).toBe(true);
  });

  it("triggers roomFactory when match is found", async () => {
    const factorySpy = vi.fn().mockResolvedValue(undefined);
    const queueWithFactory = new MatchQueue(factorySpy);

    for (let i = 0; i < 4; i++) {
      const client = makeTestClient(`s${i}`);
      queueWithFactory.enqueue(client, `s${i}`, `P${i}`, { region: "americas" });
    }

    await vi.waitFor(() => {
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    const callArg = factorySpy.mock.calls[0][0];
    expect(callArg).toHaveLength(4);
    expect(callArg.map((p: { sessionId: string }) => p.sessionId)).toEqual(["s0", "s1", "s2", "s3"]);
  });

  it("clears all queues", () => {
    queue.enqueue(makeTestClient("s1"), "s1", "P1", { region: "americas" });
    queue.enqueue(makeTestClient("s2"), "s2", "P2", { region: "europe" });

    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.getPlayersByRegion("americas")).toHaveLength(0);
    expect(queue.getPlayersByRegion("europe")).toHaveLength(0);
  });

  it("removes player from all internal queues", () => {
    queue.enqueue(makeTestClient("s1"), "s1", "P1", { elo: 500, region: "americas" });
    queue.enqueue(makeTestClient("s2"), "s2", "P2", { elo: 500, region: "americas" });

    queue.remove("s1");

    expect(queue.size).toBe(1);
    expect(queue.getPlayersByRegion("americas")).toHaveLength(1);
    expect(queue.getPlayersByElo(500)).toHaveLength(1);
  });

  it("does not match when fewer than NUM_PLAYERS in queue", async () => {
    const factorySpy = vi.fn().mockResolvedValue(undefined);
    const q = new MatchQueue(factorySpy);

    q.enqueue(makeTestClient("s1"), "s1", "P1", { region: "americas" });
    q.enqueue(makeTestClient("s2"), "s2", "P2", { region: "americas" });
    q.enqueue(makeTestClient("s3"), "s3", "P3", { region: "americas" });

    // Wait a tick to ensure async doesn't trigger
    await new Promise((r) => setTimeout(r, 50));

    expect(factorySpy).not.toHaveBeenCalled();
    expect(q.size).toBe(3);
  });

  it("falls back to global when no single region has 4 players", async () => {
    const factorySpy = vi.fn().mockResolvedValue(undefined);
    const q = new MatchQueue(factorySpy);

    q.enqueue(makeTestClient("s1"), "s1", "P1", { region: "americas" });
    q.enqueue(makeTestClient("s2"), "s2", "P2", { region: "europe" });
    q.enqueue(makeTestClient("s3"), "s3", "P3", { region: "asia" });
    q.enqueue(makeTestClient("s4"), "s4", "P4", { region: "oceania" });

    await vi.waitFor(() => {
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    const matched = factorySpy.mock.calls[0][0];
    expect(matched).toHaveLength(4);
  });

  it("falls back to ELO bracket when region queue is too small", async () => {
    const factorySpy = vi.fn().mockResolvedValue(undefined);
    const q = new MatchQueue(factorySpy);

    q.enqueue(makeTestClient("s1"), "s1", "P1", { elo: 500, region: "americas" });
    q.enqueue(makeTestClient("s2"), "s2", "P2", { elo: 600, region: "americas" });
    q.enqueue(makeTestClient("s3"), "s3", "P3", { elo: 550, region: "europe" });
    q.enqueue(makeTestClient("s4"), "s4", "P4", { elo: 580, region: "asia" });

    await vi.waitFor(() => {
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    const matched = factorySpy.mock.calls[0][0];
    expect(matched).toHaveLength(4);
  });
});

describe("QueueRoom", () => {
  it("handles matchmake message and enqueues player", () => {
    const room = new QueueRoom();
    room.onCreate();

    const client = makeTestClient("session-1");
    room.onJoin(client, { name: "Alice", elo: 1200, region: "europe" });

    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const testClient = makeTestClient("session-2", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](testClient, { name: "Bob", elo: 1100, region: "europe" });

    const matchmakeStarted = sentMessages.find((m) => m.type === "matchmaking_started");
    expect(matchmakeStarted).toBeDefined();

    room.onDispose();
  });

  it("rejects duplicate matchmake for same session", () => {
    const room = new QueueRoom();
    room.onCreate();

    const client = makeTestClient("session-1");
    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const testClient = makeTestClient("session-1", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](testClient, { name: "Alice", elo: 1000 });
    room["handleMatchmake"](testClient, { name: "Alice", elo: 1000 });

    const error = sentMessages.find((m) => m.type === "error" && (m.data as { code: string }).code === "ALREADY_QUEUED");
    expect(error).toBeDefined();

    room.onDispose();
  });

  it("handles cancel_matchmake", () => {
    const room = new QueueRoom();
    room.onCreate();

    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const client = makeTestClient("session-1", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](client, { name: "Alice" });
    room["handleCancelMatchmake"](client);

    const cancelled = sentMessages.find((m) => m.type === "matchmaking_cancelled");
    expect(cancelled).toBeDefined();

    room.onDispose();
  });

  it("removes player on leave", () => {
    const room = new QueueRoom();
    room.onCreate();

    const client = makeTestClient("session-1");
    room["handleMatchmake"](client, { name: "Alice" });

    room.onLeave(client);

    expect(room["matchQueue"].size).toBe(0);

    room.onDispose();
  });

  it("clears queue on dispose", () => {
    const room = new QueueRoom();
    room.onCreate();

    room["handleMatchmake"](makeTestClient("s1"), { name: "P1" });
    room["handleMatchmake"](makeTestClient("s2"), { name: "P2" });

    expect(room["matchQueue"].size).toBe(2);

    room.onDispose();

    expect(room["matchQueue"].size).toBe(0);
  });
});

describe("UnoRoom matchmake handler", () => {
  it("sends matchmake_joined when player is already in room", () => {
    const room = new UnoRoom();
    room.onCreate();

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Alice" });

    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const testClient = makeTestClient("human-0", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](testClient, { elo: 1200, region: "europe" });

    const joined = sentMessages.find((m) => m.type === "matchmake_joined");
    expect(joined).toBeDefined();
    expect((joined!.data as { elo: number }).elo).toBe(1200);
    expect((joined!.data as { region: string }).region).toBe("europe");

    room.onDispose();
  });

  it("assigns player to bot seat via matchmake", () => {
    const room = new UnoRoom();
    room.onCreate();

    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const client = makeTestClient("human-1", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](client, { elo: 1500, region: "asia" });

    const joined = sentMessages.find((m) => m.type === "matchmake_joined");
    expect(joined).toBeDefined();
    expect((joined!.data as { seatIndex: number }).seatIndex).toBeGreaterThanOrEqual(0);
    expect((joined!.data as { seatIndex: number }).seatIndex).toBeLessThan(4);

    const player = room.findPlayerBySession("human-1");
    expect(player).not.toBeNull();
    expect(player!.isBot).toBe(false);
    expect(player!.connected).toBe(true);

    room.onDispose();
  });

  it("sends error when no seats available", () => {
    const room = new UnoRoom();
    room.onCreate();

    for (let i = 0; i < 4; i++) {
      try {
        room.onJoin(makeTestClient(`human-${i}`), { name: `Player ${i}` });
      } catch {
        // lock() may throw in test env without presence
      }
    }

    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const extraClient = makeTestClient("human-extra", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](extraClient, { elo: 1000 });

    const error = sentMessages.find((m) => m.type === "error" && (m.data as { code: string }).code === "NO_SEATS");
    expect(error).toBeDefined();

    room.onDispose();
  });

  it("validates elo range", () => {
    const room = new UnoRoom();
    room.onCreate();

    let sentMessages: Array<{ type: string; data: unknown }> = [];
    const client = makeTestClient("human-0", (type: string, data: unknown) => {
      sentMessages.push({ type, data });
    });

    room["handleMatchmake"](client, { elo: -100 });

    const joined = sentMessages.find((m) => m.type === "matchmake_joined");
    expect(joined).toBeDefined();
    expect((joined!.data as { elo: number }).elo).toBe(0);

    room.onDispose();
  });
});
