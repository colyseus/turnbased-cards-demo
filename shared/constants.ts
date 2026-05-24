/** Game configuration constants shared between server and clients. */
export const NUM_PLAYERS = 4;
export const HAND_SIZE = 7;

/** How long a human player has to act before turn expires (ms). */
export const HUMAN_TURN_TIMEOUT_MS = 7000;

/** Delay before bot takes its turn (ms). */
export const BOT_TURN_DELAY_MS = 800;

/** Minimum interval between game actions per player (ms) — for rate limiting. */
export const ACTION_COOLDOWN_MS = 300;
