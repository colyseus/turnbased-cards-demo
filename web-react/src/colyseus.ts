import { Client } from "@colyseus/sdk";
import { createRoomContext } from "@colyseus/react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
export const client = new Client(WS_URL);

export const { RoomProvider, useRoom, useRoomState } = createRoomContext();
