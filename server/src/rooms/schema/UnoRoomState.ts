import { schema } from "@colyseus/schema";

export const UnoCardSchema = schema({
  id: "string",
  cardType: "string",    // "color" | "wild"
  color: "string",       // UnoColor | ""
  value: "string",       // UnoValue | WildType
  chosenColor: "string", // set when wild is played, "" otherwise
});

export const PlayerSchema = schema({
  sessionId: "string",
  seatIndex: "number",
  name: "string",
  isBot: "boolean",
  connected: "boolean",
  hand: { array: UnoCardSchema, view: true },  // only visible via StateView
  handCount: "number",                          // always visible to all
});

export const UnoRoomState = schema({
  players: { map: PlayerSchema },
  discardPile: { array: UnoCardSchema },
  drawPileCount: "number",
  currentPlayer: "number",     // seat index 0-3
  direction: "number",         // 1 or -1
  activeColor: "string",
  pendingDraw: "number",
  winner: "number",            // -1 = none, 0-3 = winner seat
  phase: "string",             // "waiting" | "playing" | "finished"
  turnDeadline: "number",      // timestamp for turn timeout
});
