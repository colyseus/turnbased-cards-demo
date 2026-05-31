export type Mode = "lobby" | "joining" | "table";

export interface Toast {
  id: string;
  message: string;
  kind: "info" | "warning" | "error" | "success";
}

export type UnoColor = "red" | "yellow" | "green" | "blue";

export interface CardSchema {
  id: string;
  cardType: "color" | "wild";
  color: string;
  value: string;
  chosenColor?: string;
}

export interface PlayerSchema {
  sessionId: string;
  seatIndex: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  hand?: CardSchema[];
  handCount: number;
}

export interface ChatMessageSchema {
  sender: string;
  text: string;
  timestamp: number;
}

export interface UnoState {
  players?: Map<string, PlayerSchema> | Record<string, PlayerSchema>;
  discardPile?: CardSchema[];
  drawPileCount?: number;
  deckCount?: number;
  currentPlayer?: number;
  direction?: number;
  activeColor?: string;
  pendingDraw?: number;
  winner?: number;
  phase?: string;
  spectatorCount?: number;
  chatMessages?: ChatMessageSchema[];
  unoCaller?: number;
  rematchVotes?: number[];
  turnDeadline?: number;
}
