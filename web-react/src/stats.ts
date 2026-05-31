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

export function getStats(): GameStats {
  const defaults: GameStats = {
    played: 0,
    wins: 0,
    losses: 0,
    cardsPlayed: 0,
    botKnockouts: 0,
    history: [],
  };

  try {
    const raw = localStorage.getItem("uno_stats");
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
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
    curr.played += 1;
    if (win) curr.wins += 1;
    else curr.losses += 1;
    curr.cardsPlayed += cards;
    curr.botKnockouts += botKills;

    if (!curr.history) curr.history = [];
    curr.history.unshift({
      id: `match-${Date.now()}`,
      timestamp: Date.now(),
      win,
      winnerName,
      cardsPlayed: cards,
      durationSec,
      opponentNames: opponents,
    });
    if (curr.history.length > 10) {
      curr.history = curr.history.slice(0, 10);
    }
    localStorage.setItem("uno_stats", JSON.stringify(curr));
  } catch {
    // ignored
  }
}
