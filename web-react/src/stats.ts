const STORAGE_KEY = 'uno-stats-v1';

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  unoCalls: number;
  cardsPlayed: number;
  lastPlayed: number; // timestamp
}

function loadAll(): Record<string, PlayerStats> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, PlayerStats>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function getStats(playerName: string): PlayerStats {
  const all = loadAll();
  return all[playerName] ?? { gamesPlayed: 0, wins: 0, unoCalls: 0, cardsPlayed: 0, lastPlayed: 0 };
}

export function recordGamePlayed(playerName: string) {
  const all = loadAll();
  const stats = all[playerName] ?? {
    gamesPlayed: 0,
    wins: 0,
    unoCalls: 0,
    cardsPlayed: 0,
    lastPlayed: 0,
  };
  stats.gamesPlayed++;
  stats.lastPlayed = Date.now();
  all[playerName] = stats;
  saveAll(all);
}

export function recordWin(playerName: string) {
  const all = loadAll();
  const stats = all[playerName] ?? {
    gamesPlayed: 0,
    wins: 0,
    unoCalls: 0,
    cardsPlayed: 0,
    lastPlayed: 0,
  };
  stats.wins++;
  stats.lastPlayed = Date.now();
  all[playerName] = stats;
  saveAll(all);
}

export function recordUnoCall(playerName: string) {
  const all = loadAll();
  const stats = all[playerName] ?? {
    gamesPlayed: 0,
    wins: 0,
    unoCalls: 0,
    cardsPlayed: 0,
    lastPlayed: 0,
  };
  stats.unoCalls++;
  all[playerName] = stats;
  saveAll(all);
}

export function recordCardPlayed(playerName: string) {
  const all = loadAll();
  const stats = all[playerName] ?? {
    gamesPlayed: 0,
    wins: 0,
    unoCalls: 0,
    cardsPlayed: 0,
    lastPlayed: 0,
  };
  stats.cardsPlayed++;
  all[playerName] = stats;
  saveAll(all);
}

export function getLeaderboard(limit = 10): { name: string; stats: PlayerStats }[] {
  const all = loadAll();
  return Object.entries(all)
    .map(([name, stats]) => ({ name, stats }))
    .sort((a, b) => b.stats.wins - a.stats.wins || b.stats.gamesPlayed - a.stats.gamesPlayed)
    .slice(0, limit);
}
