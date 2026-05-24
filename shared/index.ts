// Shared types, constants, and pure game logic for both frontend and backend

export type { ColorCard, UnoCard, UnoColor, UnoValue, WildCard, WildType } from './types.ts';
export {
  ACTION_COOLDOWN_MS,
  BOT_TURN_DELAY_MS,
  HAND_SIZE,
  HUMAN_TURN_TIMEOUT_MS,
  NUM_PLAYERS,
} from './constants.ts';
export { canPlay, canPlaySchema, cardTexture, cardTextureFromSchema, getActiveColor } from './gameLogic.ts';
