// ── Uno Types & Game Logic (server-only) ─────────────────────────────────────
// This file contains server-only game logic (AI, deck management, etc.)
// Pure types and shared functions are re-exported from the top-level shared/

// Re-export pure types and shared functions from shared/ for server use
export type { UnoColor, UnoValue, WildType, ColorCard, WildCard, UnoCard } from '../../shared/types.ts';
export { canPlay, cardTextureFromSchema, canPlaySchema, getActiveColor, cardTexture } from '../../shared/gameLogic.ts';
export { NUM_PLAYERS, HAND_SIZE } from '../../shared/constants.ts';

// Import for internal use within this file
import type { UnoColor, UnoValue, WildCard, UnoCard } from '../../shared/types.ts';
import type { ColorCard } from '../../shared/types.ts';
import { canPlay } from '../../shared/gameLogic.ts';
import { NUM_PLAYERS, HAND_SIZE } from '../../shared/constants.ts';

// ── Server-only implementations ──────────────────────────────────────────────

/** Monotonic counter so card IDs are unique across rounds */
let globalUid = 0;

/** Build a full 108-card Uno deck */
export function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let uid = globalUid;

  const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
  const values: UnoValue[] = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];

  for (const color of colors) {
    for (const value of values) {
      const copies = value === '0' ? 1 : 2;
      for (let c = 0; c < copies; c++) {
        deck.push({ type: 'color', color, value, id: `${color}_${value}_${uid++}` });
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'wild', wildType: 'wild', chosenColor: null, id: `wild_${uid++}` });
    deck.push({ type: 'wild', wildType: 'wild_draw4', chosenColor: null, id: `wild_draw4_${uid++}` });
  }

  globalUid = uid;
  return deck;
}

export function shuffleDeck(deck: UnoCard[]): UnoCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// UnoState and game management functions
export interface UnoState {
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  hands: UnoCard[][];
  currentPlayer: number;
  direction: 1 | -1;
  activeColor: UnoColor;
  pendingDraw: number;
  winner: number | null;
}

// Note: NUM_PLAYERS and HAND_SIZE already imported at top of file

function nextPlayer(state: UnoState, skip = 0): number {
  let p = state.currentPlayer;
  for (let i = 0; i <= skip; i++) {
    p = ((p + state.direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
  }
  return p;
}

function recycleDiscard(state: UnoState) {
  if (state.drawPile.length > 0) return;
  const top = state.discardPile[state.discardPile.length - 1];
  const recycled = shuffleDeck(state.discardPile.slice(0, -1));
  state.drawPile = recycled;
  state.discardPile = [top];
}

export function drawCards(state: UnoState, player: number, count: number): UnoState {
  const newHands = state.hands.map((h, i) => i === player ? [...h] : [...h]);
  const s = { ...state, hands: newHands, drawPile: [...state.drawPile], discardPile: [...state.discardPile] };
  for (let i = 0; i < count; i++) {
    recycleDiscard(s);
    if (s.drawPile.length === 0) break;
    s.hands[player].push(s.drawPile.pop()!);
  }
  return s;
}

export function createGame(): UnoState {
  const deck = shuffleDeck(createUnoDeck());
  const hands: UnoCard[][] = Array.from({ length: NUM_PLAYERS }, () => []);

  let idx = 0;
  for (let c = 0; c < HAND_SIZE; c++) {
    for (let p = 0; p < NUM_PLAYERS; p++) {
      hands[p].push(deck[idx++]);
    }
  }

  let startIdx = idx;
  while (startIdx < deck.length && deck[startIdx].type === 'wild') startIdx++;
  if (startIdx >= deck.length) startIdx = idx;

  const firstCard = deck[startIdx];
  const remaining = [...deck.slice(idx, startIdx), ...deck.slice(startIdx + 1)];

  const activeColor = firstCard.type === 'color' ? firstCard.color : 'red';

  let currentPlayer = 0;
  let direction: 1 | -1 = 1;

  if (firstCard.type === 'color') {
    if (firstCard.value === 'skip') {
      currentPlayer = 1;
    } else if (firstCard.value === 'reverse') {
      direction = -1;
      currentPlayer = NUM_PLAYERS - 1;
    }
  }

  return {
    drawPile: remaining,
    discardPile: [firstCard],
    hands,
    currentPlayer,
    direction,
    activeColor,
    pendingDraw: firstCard.type === 'color' && firstCard.value === 'draw2' ? 2 : 0,
    winner: null,
  };
}

export function getPlayableCards(state: UnoState, player: number): UnoCard[] {
  if (state.winner !== null) return [];
  if (player !== state.currentPlayer) return [];
  const topCard = state.discardPile[state.discardPile.length - 1];
  if (state.pendingDraw > 0) return [];
  return state.hands[player].filter(c => canPlay(c, topCard, state.activeColor));
}

export function handleDraw(state: UnoState): UnoState {
  const player = state.currentPlayer;
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
  let s = drawCards(state, player, count);
  s.pendingDraw = 0;
  s.currentPlayer = nextPlayer(s);
  return s;
}

function scoreColor(
  color: UnoColor,
  hand: UnoCard[],
  topCardValue: string | undefined,
): number {
  const colorCards = hand.filter((c): c is ColorCard => c.type === 'color' && c.color === color);
  const count = colorCards.length;
  let score = 100 + count * 10;
  const hasMatchingValue = colorCards.some((c) => c.value === topCardValue);
  if (hasMatchingValue) score += 15;
  const actionCount = colorCards.filter((c) => ['skip', 'reverse', 'draw2'].includes(c.value)).length;
  score += actionCount * 5;
  return score;
}

function pickBestCard(playable: UnoCard[], _hand: UnoCard[], activeColor: UnoColor): UnoCard {
  const actionCards = playable.filter((c): c is ColorCard => c.type === 'color' && ['skip', 'reverse', 'draw2'].includes(c.value));
  const numberCards = playable.filter((c): c is ColorCard => c.type === 'color' && !['skip', 'reverse', 'draw2'].includes(c.value));
  const wildCards = playable.filter((c) => c.type === 'wild');

  if (actionCards.length > 0) {
    const reverse = actionCards.filter((c) => c.value === 'reverse');
    if (reverse.length > 0) return reverse[Math.floor(Math.random() * reverse.length)];
    const skip = actionCards.filter((c) => c.value === 'skip');
    if (skip.length > 0) return skip[Math.floor(Math.random() * skip.length)];
    if (numberCards.length === 0 && wildCards.length === 0) {
      return actionCards[0];
    }
  }

  if (numberCards.length > 0) {
    const matchingColor = numberCards.filter((c) => c.color === activeColor);
    if (matchingColor.length > 0) {
      return matchingColor[Math.floor(Math.random() * matchingColor.length)];
    }
    return numberCards[Math.floor(Math.random() * numberCards.length)];
  }

  return wildCards[0] ?? playable[0];
}

export function aiTurn(state: UnoState): UnoState {
  const player = state.currentPlayer;

  if (state.pendingDraw > 0) {
    return handleDraw(state);
  }

  const playable = getPlayableCards(state, player);
  if (playable.length === 0) {
    return handleDraw(state);
  }

  const hand = state.hands[player];
  const topCard = state.discardPile[state.discardPile.length - 1];
  const topCardValue = topCard.type === 'color' ? topCard.value : undefined;

  const card = pickBestCard(playable, hand, state.activeColor);

  let chosenColor: UnoColor | undefined;
  if (card.type === 'wild') {
    const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
    chosenColor = colors.reduce((best, color) => {
      const score = scoreColor(color, hand, topCardValue);
      const bestScore = scoreColor(best, hand, topCardValue);
      return score > bestScore ? color : best;
    }, colors[0]);
  }

  return playCard(state, player, card.id, chosenColor);
}

export interface AutoPlayResult {
  state: UnoState;
  completed: boolean;
  turnsPlayed: number;
  winner: number | null;
  reason: 'winner' | 'turn_limit';
}

export interface AutoPlayOptions {
  maxTurns?: number;
  onTurn?: (state: UnoState, turn: number) => void;
}

export function autoPlayGame(
  initialState: UnoState = createGame(),
  options: AutoPlayOptions = {},
): AutoPlayResult {
  const maxTurns = options.maxTurns ?? 1000;
  let state = initialState;
  let turnsPlayed = 0;

  while (state.winner === null && turnsPlayed < maxTurns) {
    const before = state;
    state = aiTurn(state);
    turnsPlayed++;
    options.onTurn?.(state, turnsPlayed);

    if (state === before) {
      break;
    }
  }

  return {
    state,
    completed: state.winner !== null,
    turnsPlayed,
    winner: state.winner,
    reason: state.winner !== null ? 'winner' : 'turn_limit',
  };
}

// AI strategy functions using schema card format (for Colyseus)
export function scoreColorSchema(
  color: UnoColor,
  hand: { cardType: string; color: string; value: string }[],
  topCardValue: string | undefined,
  discardedCounts?: Record<string, number>,
): number {
  const colorCards = hand.filter((c) => c.cardType === 'color' && c.color === color);
  const count = colorCards.length;
  const discarded = discardedCounts?.[color] ?? 0;
  let score = 100 + count * 10 + discarded * 2;
  const hasMatchingValue = colorCards.some((c) => c.value === topCardValue);
  if (hasMatchingValue) score += 15;
  const actionCount = colorCards.filter((c) => ['skip', 'reverse', 'draw2'].includes(c.value)).length;
  score += actionCount * 5;
  return score;
}

export function pickBestCardSchema(
  playableIndices: number[],
  hand: { cardType: string; color: string; value: string; id: string }[],
  activeColor: UnoColor,
): number {
  const playable = playableIndices.map((i) => hand[i]);

  const actionCards = playable.filter((c) => c.cardType === 'color' && ['skip', 'reverse', 'draw2'].includes(c.value));
  const numberCards = playable.filter((c) => c.cardType === 'color' && !['skip', 'reverse', 'draw2'].includes(c.value));
  const wildCards = playable.filter((c) => c.cardType === 'wild');

  if (actionCards.length > 0) {
    const reverse = actionCards.filter((c) => c.value === 'reverse');
    if (reverse.length > 0) return playableIndices[playable.indexOf(reverse[0])];
    const skip = actionCards.filter((c) => c.value === 'skip');
    if (skip.length > 0) return playableIndices[playable.indexOf(skip[0])];
    if (numberCards.length === 0 && wildCards.length === 0) {
      return playableIndices[playable.indexOf(actionCards[0])];
    }
  }

  if (numberCards.length > 0) {
    const matchingColor = numberCards.filter((c) => c.color === activeColor);
    if (matchingColor.length > 0) {
      return playableIndices[playable.indexOf(matchingColor[0])];
    }
    return playableIndices[playable.indexOf(numberCards[0])];
  }

  return playableIndices[0];
}

export function pickBestColorSchema(
  hand: { cardType: string; color: string; value: string }[],
  topCardValue: string | undefined,
  discardedCounts?: Record<string, number>,
): UnoColor {
  const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
  return colors.reduce((best, color) => {
    const score = scoreColorSchema(color, hand, topCardValue, discardedCounts);
    const bestScore = scoreColorSchema(best, hand, topCardValue, discardedCounts);
    return score > bestScore ? color : best;
  }, colors[0]);
}

// Internal helper for aiTurn (canPlay already imported/re-exported at top)
export function playCard(
  state: UnoState,
  player: number,
  cardId: string,
  chosenColor?: UnoColor,
): UnoState {
  const newHands = state.hands.map((h, i) => i === player ? [...h] : [...h]);
  const s = { ...state, hands: newHands, drawPile: [...state.drawPile], discardPile: [...state.discardPile] };

  const handIdx = s.hands[player].findIndex(c => c.id === cardId);
  if (handIdx === -1) return state;

  const card = { ...s.hands[player][handIdx] };
  s.hands[player] = [...s.hands[player].slice(0, handIdx), ...s.hands[player].slice(handIdx + 1)];

  if (card.type === 'wild') {
    (card as WildCard).chosenColor = chosenColor ?? 'red';
    s.activeColor = (card as WildCard).chosenColor!;
  } else {
    s.activeColor = card.color;
  }

  s.discardPile.push(card);

  if (card.type === 'color') {
    switch (card.value) {
      case 'reverse':
        s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
        s.currentPlayer = nextPlayer(s);
        break;
      case 'skip':
        s.currentPlayer = nextPlayer(s, 1);
        break;
      case 'draw2':
        s.pendingDraw += 2;
        s.currentPlayer = nextPlayer(s);
        break;
      default:
        s.currentPlayer = nextPlayer(s);
    }
  } else {
    if (card.wildType === 'wild_draw4') {
      s.pendingDraw += 4;
    }
    s.currentPlayer = nextPlayer(s);
  }

  if (s.hands[player].length === 0) {
    s.winner = player;
  }

  return s;
}
