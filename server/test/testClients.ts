import type { Client } from "@colyseus/core";

export function makeTestClient(sessionId: string, send: Client["send"] = () => undefined): Client {
  return { sessionId, send } as Client;
}
