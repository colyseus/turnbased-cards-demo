import { readStorage, writeStorage } from "./storage.ts";

export interface MatchHistoryEntry {
  id: string;
  timestamp: number;
  win: boolean;
  winnerName: string;
  cardsPlayed: number;
  durationSec: number;
  opponentNames: string[];
}

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  cardsPlayed: number;
  botKnockouts: number;
  history?: MatchHistoryEntry[];
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

function normalizeHistoryEntry(entry: unknown): MatchHistoryEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Partial<MatchHistoryEntry> & { id?: unknown; opponentNames?: unknown };
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    timestamp: toNumber(raw.timestamp),
    win: toBoolean(raw.win),
    winnerName: typeof raw.winnerName === "string" ? raw.winnerName : "Winner",
    cardsPlayed: toNumber(raw.cardsPlayed),
    durationSec: toNumber(raw.durationSec),
    opponentNames: Array.isArray(raw.opponentNames)
      ? raw.opponentNames.filter((name): name is string => typeof name === "string")
      : [],
  };
}

function normalizeStats(raw: unknown): GameStats {
  const defaults: GameStats = {
    played: 0,
    wins: 0,
    losses: 0,
    cardsPlayed: 0,
    botKnockouts: 0,
    history: [],
  };

  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<GameStats> & { history?: unknown };
  const history = Array.isArray(parsed.history)
    ? parsed.history.map(normalizeHistoryEntry).filter((entry): entry is MatchHistoryEntry => entry !== null)
    : [];

  return {
    played: toNumber(parsed.played),
    wins: toNumber(parsed.wins),
    losses: toNumber(parsed.losses),
    cardsPlayed: toNumber(parsed.cardsPlayed),
    botKnockouts: toNumber(parsed.botKnockouts),
    history,
  };
}

export function getStats(): GameStats {
  try {
    const raw = readStorage("uno_stats");
    return raw ? normalizeStats(JSON.parse(raw)) : normalizeStats(null);
  } catch {
    return normalizeStats(null);
  }
}

export function updateStats(
  win: boolean,
  cards: number,
  botKills: number,
  winnerName = "Winner",
  durationSec = 0,
  opponents: string[] = [],
) {
  try {
    const curr = getStats();
    const history = curr.history ?? [];
    curr.played += 1;
    if (win) curr.wins += 1;
    else curr.losses += 1;
    curr.cardsPlayed += cards;
    curr.botKnockouts += botKills;

    history.unshift({
      id: `match-${Date.now()}`,
      timestamp: Date.now(),
      win,
      winnerName,
      cardsPlayed: cards,
      durationSec,
      opponentNames: opponents,
    });
    if (history.length > 10) {
      curr.history = history.slice(0, 10);
    } else {
      curr.history = history;
    }
    writeStorage("uno_stats", JSON.stringify(curr));
  } catch {
    // ignored
  }
}
