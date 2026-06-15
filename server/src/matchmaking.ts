import { Client, Room } from "@colyseus/core";
import { NUM_PLAYERS } from "../../shared/constants.ts";
import { logger } from "./logger.ts";

const log = logger.child({ ns: "Matchmaking" });

export interface MatchmakeOptions {
  elo?: number;
  region?: string;
}

export interface QueuedPlayer {
  client: Client;
  sessionId: string;
  name: string;
  elo: number;
  region: string;
  joinedAt: number;
}

export interface MatchGroup {
  players: QueuedPlayer[];
  region?: string;
}

const REGION_BRACKETS = ["americas", "europe", "asia", "oceania"] as const;

function getRegionBracket(region: string): string {
  const lower = region.toLowerCase();
  if (REGION_BRACKETS.includes(lower as typeof REGION_BRACKETS[number])) return lower;
  return "global";
}

function eloBracket(elo: number): string {
  if (elo < 800) return "beginner";
  if (elo < 1200) return "intermediate";
  if (elo < 1600) return "advanced";
  return "expert";
}

export class MatchQueue {
  private waiting: QueuedPlayer[] = [];
  private regionQueues: Map<string, QueuedPlayer[]> = new Map();
  private eloQueues: Map<string, QueuedPlayer[]> = new Map();
  private roomFactory?: (players: QueuedPlayer[]) => Promise<void>;

  constructor(roomFactory?: (players: QueuedPlayer[]) => Promise<void>) {
    this.roomFactory = roomFactory;
  }

  get size(): number {
    return this.waiting.length;
  }

  get isEmpty(): boolean {
    return this.waiting.length === 0;
  }

  enqueue(client: Client, sessionId: string, name: string, options: MatchmakeOptions = {}): void {
    const player: QueuedPlayer = {
      client,
      sessionId,
      name,
      elo: options.elo ?? 1000,
      region: options.region ?? "global",
      joinedAt: Date.now(),
    };

    this.waiting.push(player);

    const regionBracket = getRegionBracket(player.region);
    if (!this.regionQueues.has(regionBracket)) {
      this.regionQueues.set(regionBracket, []);
    }
    this.regionQueues.get(regionBracket)!.push(player);

    const bracket = eloBracket(player.elo);
    if (!this.eloQueues.has(bracket)) {
      this.eloQueues.set(bracket, []);
    }
    this.eloQueues.get(bracket)!.push(player);

    log.info({ sessionId, elo: player.elo, region: player.region }, "Player enqueued");

    this.tryMatch();
  }

  remove(sessionId: string): boolean {
    const index = this.waiting.findIndex((p) => p.sessionId === sessionId);
    if (index === -1) return false;

    const removed = this.waiting.splice(index, 1)[0];

    const regionBracket = getRegionBracket(removed.region);
    const regionQueue = this.regionQueues.get(regionBracket);
    if (regionQueue) {
      const ri = regionQueue.findIndex((p) => p.sessionId === sessionId);
      if (ri !== -1) regionQueue.splice(ri, 1);
    }

    const bracket = eloBracket(removed.elo);
    const eloQueue = this.eloQueues.get(bracket);
    if (eloQueue) {
      const ei = eloQueue.findIndex((p) => p.sessionId === sessionId);
      if (ei !== -1) eloQueue.splice(ei, 1);
    }

    log.info({ sessionId }, "Player removed from queue");
    return true;
  }

  findMatch(player: QueuedPlayer): QueuedPlayer[] {
    const regionBracket = getRegionBracket(player.region);
    const bracket = eloBracket(player.elo);

    const regionCandidates = this.regionQueues.get(regionBracket) ?? [];
    if (regionCandidates.length >= NUM_PLAYERS) {
      return regionCandidates.slice(0, NUM_PLAYERS);
    }

    const eloCandidates = this.eloQueues.get(bracket) ?? [];
    if (eloCandidates.length >= NUM_PLAYERS) {
      return eloCandidates.slice(0, NUM_PLAYERS);
    }

    if (this.waiting.length >= NUM_PLAYERS) {
      return this.waiting.slice(0, NUM_PLAYERS);
    }

    return [];
  }

  private tryMatch(): void {
    if (this.waiting.length < NUM_PLAYERS) return;

    const matchGroup = this.findMatch(this.waiting[0]);
    if (matchGroup.length < NUM_PLAYERS) return;

    const matchedSessionIds = new Set(matchGroup.map((p) => p.sessionId));
    for (const player of matchGroup) {
      this.remove(player.sessionId);
    }

    log.info({ players: matchedSessionIds }, "Match found");

    if (this.roomFactory) {
      this.roomFactory(matchGroup).catch((err) => {
        log.error({ err }, "Failed to create room for match group");
      });
    }
  }

  clear(): void {
    this.waiting = [];
    this.regionQueues.clear();
    this.eloQueues.clear();
  }

  getPlayersByRegion(region: string): QueuedPlayer[] {
    const bracket = getRegionBracket(region);
    return this.regionQueues.get(bracket) ?? [];
  }

  getPlayersByElo(elo: number): QueuedPlayer[] {
    const bracket = eloBracket(elo);
    return this.eloQueues.get(bracket) ?? [];
  }

  isQueued(sessionId: string): boolean {
    return this.waiting.some((p) => p.sessionId === sessionId);
  }

  getWaitTime(sessionId: string): number {
    const player = this.waiting.find((p) => p.sessionId === sessionId);
    if (!player) return -1;
    return Date.now() - player.joinedAt;
  }
}

export class QueueRoom extends Room {
  private matchQueue: MatchQueue = new MatchQueue();

  onCreate() {
    this.maxClients = 1000;

    this.matchQueue = new MatchQueue(async (players) => {
      for (const player of players) {
        player.client.send("match_found", {
          sessionId: player.sessionId,
          name: player.name,
          elo: player.elo,
          region: player.region,
        });
      }
    });

    this.onMessage("matchmake", (client: Client, message: unknown) => {
      this.handleMatchmake(client, message);
    });

    this.onMessage("cancel_matchmake", (client: Client) => {
      this.handleCancelMatchmake(client);
    });

    this.onMessage("ping", (client: Client) => {
      client.send("pong");
    });
  }

  onJoin(client: Client, options: { name?: string; elo?: number; region?: string }) {
    const name = typeof options?.name === "string" && options.name.trim().length >= 2
      ? options.name.trim().slice(0, 16)
      : "Player";
    const elo = typeof options?.elo === "number" ? Math.max(0, Math.min(3000, options.elo)) : 1000;
    const region = typeof options?.region === "string" ? options.region : "global";

    client.send("queue_info", {
      position: this.matchQueue.size,
      queueSize: this.matchQueue.size,
    });
  }

  onLeave(client: Client) {
    this.matchQueue.remove(client.sessionId);
  }

  onDispose() {
    this.matchQueue.clear();
  }

  private handleMatchmake(client: Client, message: unknown) {
    const data = message as { name?: string; elo?: number; region?: string } | undefined;

    const name = typeof data?.name === "string" && data.name.trim().length >= 2
      ? data.name.trim().slice(0, 16)
      : "Player";
    const elo = typeof data?.elo === "number" ? Math.max(0, Math.min(3000, data.elo)) : 1000;
    const region = typeof data?.region === "string" ? data.region : "global";

    if (this.matchQueue.isQueued(client.sessionId)) {
      client.send("error", { message: "Already in queue", code: "ALREADY_QUEUED" });
      return;
    }

    this.matchQueue.enqueue(client, client.sessionId, name, { elo, region });

    client.send("matchmaking_started", {
      sessionId: client.sessionId,
      position: this.matchQueue.size,
      queueSize: this.matchQueue.size,
    });
  }

  private handleCancelMatchmake(client: Client) {
    const removed = this.matchQueue.remove(client.sessionId);
    if (removed) {
      client.send("matchmaking_cancelled", { sessionId: client.sessionId });
    } else {
      client.send("error", { message: "Not in queue", code: "NOT_IN_QUEUE" });
    }
  }
}
