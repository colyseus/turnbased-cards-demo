import { Registry, Gauge, Histogram } from "prom-client";
import { matchMaker } from "@colyseus/core";

export const register = new Registry();

export const roomCount = new Gauge({
  name: "colyseus_room_count",
  help: "Number of active Colyseus rooms",
  registers: [register],
  async collect() {
    try {
      const rooms = await matchMaker.query();
      this.set(rooms.length);
    } catch {
      this.set(0);
    }
  },
});

export const activeUsers = new Gauge({
  name: "colyseus_active_users",
  help: "Number of connected users (CCU)",
  registers: [register],
  async collect() {
    try {
      const ccu = await matchMaker.stats.getGlobalCCU();
      this.set(ccu);
    } catch {
      this.set(0);
    }
  },
});

export const memoryUsage = new Gauge({
  name: "process_memory_usage_bytes",
  help: "Process memory usage in bytes",
  registers: [register],
  collect() {
    const mem = process.memoryUsage();
    this.set(mem.heapUsed);
  },
});

export const gameDuration = new Histogram({
  name: "game_duration_seconds",
  help: "Duration of completed games in seconds",
  buckets: [10, 30, 60, 120, 300, 600, 1800],
  registers: [register],
});

export function recordGameDuration(seconds: number) {
  gameDuration.observe(seconds);
}
