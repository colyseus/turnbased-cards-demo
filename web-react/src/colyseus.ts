import { Client } from "@colyseus/sdk";
import { createRoomContext } from "@colyseus/react";

const WS_URL = import.meta.env.VITE_WS_URL;
if (!WS_URL) {
  console.warn("[colyseus] VITE_WS_URL is not set. Defaulting to localhost for development only.");
}
export const client = new Client(WS_URL || "ws://localhost:2567");

export const { RoomProvider, useRoom, useRoomState } = createRoomContext();

/** Join an existing room as a spectator (watch-only, no seat). */
export async function watchRoom(roomId: string, name?: string) {
  return client.joinById(roomId, { name: name ?? "Spectator", spectator: true });
}
