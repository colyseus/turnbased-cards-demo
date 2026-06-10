import { defineServer, defineRoom } from "@colyseus/core";
import { RedisPresence } from "@colyseus/redis-presence";
import { UnoRoom } from "./rooms/UnoRoom.ts";
import { DemoRoom } from "./rooms/DemoRoom.ts";

function createPresence() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return new RedisPresence({
        host: url.hostname,
        port: Number(url.port) || 6379,
      });
    } catch {
      // Invalid REDIS_URL, fall back to default
    }
  }
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT) || 6379;
  if (host) {
    return new RedisPresence({ host, port });
  }
  return undefined;
}

const presence = createPresence();

export default defineServer({
  rooms: {
    uno: defineRoom(UnoRoom),
    demo: defineRoom(DemoRoom),
  },
  ...(presence ? { presence } : {}),
})
