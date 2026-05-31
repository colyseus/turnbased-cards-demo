import { schema, ArraySchema } from "@colyseus/schema";

export const DemoCardSchema = schema({
  id: "string",
  cardType: "string",    // "color" | "wild"
  color: "string",       // UnoColor | ""
  value: "string",       // UnoValue | WildType
  chosenColor: "string", // set when wild is played, "" otherwise
});

export const DemoPlayerSchema = schema({
  sessionId: "string",
  seatIndex: "number",
  name: "string",
  isBot: "boolean",
  connected: "boolean",
  hand: { array: DemoCardSchema, view: true },
  handCount: "number",
});

export const TurnHistoryEntrySchema = schema({
  turn: "number",
  player: "number",
  action: "string",         // e.g. "play:red_5", "draw", "skip", "reverse", "win:2"
  cardId: "string",
  chosenColor: "string",
  timestamp: "number",
  handCounts: { array: "number" },  // hand counts of all 4 players after this action
});

export const DemoPlaybackSchema = schema({
  phase: "string",        // "idle" | "running" | "paused" | "finished"
  tickMs: "number",       // current tick interval in ms
  turnCount: "number",    // turns played so far
  winner: "number",       // seat index or -1
});

export const DemoState = schema({
  players: { map: DemoPlayerSchema },
  discardPile: { array: DemoCardSchema },
  drawPileCount: "number",
  currentPlayer: "number",   // seat index 0-3
  direction: "number",       // 1 or -1
  activeColor: "string",    // UnoColor
  pendingDraw: "number",
  winner: "number",          // -1 = none, 0-3 = winner seat
  phase: "string",          // "idle" | "running" | "paused" | "finished"
  demo: DemoPlaybackSchema,
  turnHistory: { array: TurnHistoryEntrySchema },
});
