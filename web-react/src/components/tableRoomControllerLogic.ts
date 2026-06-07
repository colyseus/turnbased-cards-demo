import type { CardSchema, PlayerSchema } from "../gameTypes.ts";
import { AVATAR_THEMES } from "../tableConfig.ts";
import { cardLabel, parsePlayerName } from "../gameHelpers.ts";

export type SortMode = "none" | "color" | "value";

export type SpotlightPos = "bottom" | "top" | "left" | "right" | "none";

export interface MeSummary {
  displayName: string;
  symbol: string;
  theme: string;
  seatIndex: number;
  spectatorCount: number;
}

export interface RosterEntry {
  sessionId: string;
  displayName: string;
  symbol: string;
  theme: string;
  isBot: boolean;
  cardCount: number;
  active: boolean;
}

export type ActionCallout =
  | {
      kind: "uno";
      title: string;
      text: string;
    }
  | {
      kind: "penalty";
      title: string;
      text: string;
    }
  | null;

export interface GuidanceState {
  guidanceText: string;
  guidanceStatus: "normal" | "warning" | "error";
}

export function sortHand(hand: CardSchema[], sortBy: SortMode) {
  const rawHand = [...hand];
  if (sortBy === "color") {
    return rawHand.sort((a, b) => {
      if (a.cardType === "wild" && b.cardType !== "wild") return 1;
      if (b.cardType === "wild" && a.cardType !== "wild") return -1;
      if (a.color !== b.color) {
        return a.color.localeCompare(b.color);
      }
      return a.value.localeCompare(b.value);
    });
  }
  if (sortBy === "value") {
    return rawHand.sort((a, b) => {
      if (a.value !== b.value) {
        return a.value.localeCompare(b.value);
      }
      return a.color.localeCompare(b.color);
    });
  }
  return rawHand;
}

export function buildMeSummary(me: PlayerSchema | null | undefined, spectatorCount: number): MeSummary | null {
  if (!me) return null;
  const av = parsePlayerName(me.name);
  return {
    displayName: av.name,
    symbol: av.symbol,
    theme: av.theme,
    seatIndex: me.seatIndex,
    spectatorCount,
  };
}

export function buildRosterEntries(
  players: PlayerSchema[],
  meSessionId: string | undefined,
  currentPlayerSeat: number | undefined,
): RosterEntry[] {
  return players
    .filter((player) => player.sessionId !== meSessionId)
    .map((player) => {
      const av = parsePlayerName(player.name);
      return {
        sessionId: player.sessionId,
        displayName: av.name,
        symbol: av.symbol,
        theme: av.theme,
        isBot: player.isBot,
        cardCount: player.handCount ?? player.hand?.length ?? 0,
        active: player.seatIndex === currentPlayerSeat,
      };
    });
}

export function getSpotlightPos(params: {
  isMyTurn: boolean;
  players: PlayerSchema[];
  meSessionId: string | undefined;
  currentPlayerSeat: number | undefined;
}): SpotlightPos {
  const { isMyTurn, players, meSessionId, currentPlayerSeat } = params;
  if (isMyTurn) return "bottom";
  const opponents = players.filter((player) => player.sessionId !== meSessionId);
  const activeOpponentIdx = opponents.findIndex((p) => p.seatIndex === currentPlayerSeat);
  if (activeOpponentIdx === -1) return "none";
  const total = opponents.length;
  if (total === 1) return "top";
  if (total === 2) return activeOpponentIdx === 0 ? "left" : "right";
  if (activeOpponentIdx === 0) return "left";
  if (activeOpponentIdx === 1) return "top";
  return "right";
}

export function buildGuidanceState(params: {
  mustCallUno: boolean;
  isMyTurn: boolean;
  pendingDraw: number;
  selectedCard: CardSchema | null;
  isSelectedPlayable: boolean;
}): GuidanceState {
  const { mustCallUno, isMyTurn, pendingDraw, selectedCard, isSelectedPlayable } = params;

  if (mustCallUno) {
    return {
      guidanceText: "Call UNO now! Tap the red UNO button before playing your next card.",
      guidanceStatus: "warning",
    };
  }
  if (!isMyTurn) {
    return {
      guidanceText: "Awaiting opponent's turn... Inspect your hand in the meantime.",
      guidanceStatus: "normal",
    };
  }
  if (pendingDraw > 0) {
    return {
      guidanceText: `Draw penalty: +${pendingDraw}. Tap the glowing deck to take ${pendingDraw} cards.`,
      guidanceStatus: "warning",
    };
  }
  if (selectedCard && !isSelectedPlayable) {
    return {
      guidanceText: `Invalid selection! ${cardLabel(selectedCard)} doesn't match discard pile.`,
      guidanceStatus: "error",
    };
  }
  if (pendingDraw === 0) {
    return {
      guidanceText: "No playable cards in hand! Click the glowing draw pile to draw.",
      guidanceStatus: "warning",
    };
  }
  return {
    guidanceText: "Select a glowing playable card and click it again to play.",
    guidanceStatus: "normal",
  };
}

export function buildActionCallout(params: {
  mustCallUno: boolean;
  isMyTurn: boolean;
  pendingDraw: number;
}): ActionCallout {
  const { mustCallUno, isMyTurn, pendingDraw } = params;
  if (mustCallUno) {
    return {
      kind: "uno",
      title: "UNO call required",
      text: "Tap UNO before you play again to avoid the 2-card penalty.",
    };
  }
  if (isMyTurn && pendingDraw > 0) {
    return {
      kind: "penalty",
      title: `Take +${pendingDraw}`,
      text: "Tap the glowing deck to take the cards.",
    };
  }
  return null;
}

export function isTutorialCompleteFlagSet(storage: Pick<Storage, "getItem">) {
  return storage.getItem("uno_tutorial_complete") === "true";
}

export function getActivePlayerThemeColor(currentPlayer: PlayerSchema | null | undefined) {
  if (!currentPlayer) return "rgba(255, 255, 255, 0.1)";
  const av = parsePlayerName(currentPlayer.name);
  const themeInfo = AVATAR_THEMES.find((t) => t.id === av.theme);
  return themeInfo ? themeInfo.primary : "rgba(255, 255, 255, 0.1)";
}
