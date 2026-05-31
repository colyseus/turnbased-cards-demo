import type { CardSchema } from "../gameTypes";

export interface TableRoomTurnBanner {
  name: string;
  emoji: string;
  themeColor: string;
}

export interface TableRoomOverlaySnapshot {
  showRules: boolean;
  tutorialStep: number;
  wildFor: CardSchema | null;
  cardAlert: string | null;
  turnBanner: TableRoomTurnBanner | null;
  showReverseSweep: boolean;
}

export function getReplayGuideSnapshot(snapshot: TableRoomOverlaySnapshot) {
  return {
    ...snapshot,
    showRules: false,
    tutorialStep: 0,
  };
}

export function getCloseTutorialSnapshot(snapshot: TableRoomOverlaySnapshot) {
  return {
    ...snapshot,
    tutorialStep: -1,
  };
}

export function getClearOverlaySnapshot(): TableRoomOverlaySnapshot {
  return {
    showRules: false,
    tutorialStep: -1,
    wildFor: null,
    cardAlert: null,
    turnBanner: null,
    showReverseSweep: false,
  };
}
