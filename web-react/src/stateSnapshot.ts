import type { CardSchema, ChatMessageSchema, PlayerSchema, UnoState } from "./gameTypes";

export function schemaValues<T>(raw: unknown): T[] {
  if (!raw) return [];
  const collected: T[] = [];
  const maybeCollection = raw as {
    forEach?: Function;
    values?: () => IterableIterator<T>;
    length?: number;
  };

  if (typeof maybeCollection.forEach === "function") {
    maybeCollection.forEach((value: T) => collected.push(value));
    return collected;
  }

  if (typeof maybeCollection.values === "function") {
    return Array.from(maybeCollection.values());
  }

  if (Array.isArray(raw)) return raw as T[];

  return Object.values(raw as Record<string, T>).filter(
    (value): value is T => value !== undefined && value !== null,
  );
}

export function snapshotState(next: UnoState): UnoState {
  return {
    players: Object.fromEntries(
      schemaValues<PlayerSchema>(next.players).map((player) => [String(player.seatIndex), player]),
    ),
    discardPile: schemaValues<CardSchema>(next.discardPile),
    drawPileCount: next.drawPileCount,
    deckCount: next.deckCount,
    currentPlayer: next.currentPlayer,
    direction: next.direction,
    activeColor: next.activeColor,
    pendingDraw: next.pendingDraw,
    winner: next.winner,
    phase: next.phase,
    spectatorCount: next.spectatorCount,
    chatMessages: schemaValues<ChatMessageSchema>(next.chatMessages),
    unoCaller: next.unoCaller,
    rematchVotes: schemaValues<number>(next.rematchVotes),
    turnDeadline: next.turnDeadline,
  };
}
