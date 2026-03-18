import { useState, useEffect } from "react";
import { Client, Room } from "@colyseus/sdk";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
const client = new Client(WS_URL);

// ── Module-level room store ─────────────────────────────────────
// Works across DOM and Canvas (react-three-fiber) reconcilers
// because it doesn't rely on React context.

let _room: Room | null = null;
let _stateVersion = 0;
const _listeners = new Set<() => void>();

function notifyListeners() {
  _stateVersion++;
  _listeners.forEach((fn) => fn());
}

/**
 * In Colyseus 0.17, joinOrCreate resolves before the initial state sync.
 * We wait for the first onStateChange to ensure the state is populated
 * before resolving.
 */
async function connectRoom(room: Room): Promise<Room> {
  _room = room;

  // Wait for the initial state to arrive, then set up ongoing listener
  await new Promise<void>((resolve) => {
    let initialSync = true;
    room.onStateChange(() => {
      if (initialSync) {
        initialSync = false;
        resolve();
      }
      notifyListeners();
    });
  });

  return room;
}

export async function joinOrCreate(
  roomName: string,
  options: Record<string, unknown>,
): Promise<Room> {
  const room = await client.joinOrCreate(roomName, options);
  return connectRoom(room);
}

export async function joinById(
  roomId: string,
  options: Record<string, unknown>,
): Promise<Room> {
  const room = await client.joinById(roomId, options);
  return connectRoom(room);
}

/** Returns the current Room instance (or null). Re-renders on state changes. */
export function useRoom(): Room | null {
  const [, setVersion] = useState(_stateVersion);
  useEffect(() => {
    const cb = () => setVersion(_stateVersion);
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  }, []);
  return _room;
}

/**
 * Returns [state, version].
 * `version` increments on every state change — use it in useMemo
 * dependency arrays since the state object reference is stable (mutated in place).
 */
export function useRoomState(): [any, number] {
  const [version, setVersion] = useState(_stateVersion);
  useEffect(() => {
    const cb = () => setVersion(_stateVersion);
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  }, []);
  return [_room?.state ?? null, version];
}
