// ── Uno Types & Game Logic ──────────────────────────────────────────

export type UnoColor = 'red' | 'blue' | 'green' | 'yellow';
export type UnoValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2';
export type WildType = 'wild' | 'wild_draw4';

export interface ColorCard {
  type: 'color';
  color: UnoColor;
  value: UnoValue;
  id: string; // unique card instance id
}

export interface WildCard {
  type: 'wild';
  wildType: WildType;
  chosenColor: UnoColor | null; // set when played
  id: string;
}

export type UnoCard = ColorCard | WildCard;

/** The filename (without extension) used to load the card texture */
export function cardTexture(card: UnoCard): string {
  if (card.type === 'wild') return card.wildType;
  return `${card.color}_${card.value}`;
}

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
      // One copy of 0, two copies of everything else
      const copies = value === '0' ? 1 : 2;
      for (let c = 0; c < copies; c++) {
        deck.push({ type: 'color', color, value, id: `${color}_${value}_${uid++}` });
      }
    }
  }

  // 4 Wild, 4 Wild Draw Four
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

/** Can this card be played on top of the discard pile? */
/* Accepts both UnoCard (type field) and Colyseus schema cards (cardType field) */
export function canPlay(
  card: UnoCard | { cardType: string; color: string; value: string },
  topCard: UnoCard | { cardType: string; value: string },
  activeColor: UnoColor,
  pendingDraw?: number,
): boolean {
  if (!card || !topCard) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = card as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = topCard as any;
  const cardType = c.type ?? c.cardType;
  const topCardType = t.type ?? t.cardType;
  // Draw-2 stacking: if pendingDraw > 0, only draw2 cards can stack
  if (pendingDraw && pendingDraw > 0) {
    if (cardType === 'color' && c.value === 'draw2') return true;
    // Wild draw4 can also stack on pending draw4 (pendingDraw >= 4)
    if (cardType === 'wild' && (c.wildType ?? c.value) === 'wild_draw4' && pendingDraw >= 4) return true;
    return false;
  }
  if (cardType === 'wild') return true;
  if (c.color === activeColor) return true;
  if (topCardType === 'color' && c.value === t.value) return true;
  return false;
}

/** Get the active color (considering wild card choices) */
export function getActiveColor(topCard: UnoCard): UnoColor {
  if (topCard.type === 'wild') return topCard.chosenColor ?? 'red';
  return topCard.color;
}

import { HAND_SIZE, NUM_PLAYERS } from "./constants.ts";

export { HAND_SIZE, NUM_PLAYERS };

export interface UnoState {
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  hands: UnoCard[][];
  currentPlayer: number;
  direction: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  activeColor: UnoColor;
  pendingDraw: number; // stacked +2/+4 draws
  winner: number | null;
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

  // Find first non-wild card for the discard pile
  let startIdx = idx;
  while (startIdx < deck.length && deck[startIdx].type === 'wild') startIdx++;
  if (startIdx >= deck.length) startIdx = idx; // fallback

  const firstCard = deck[startIdx];
  const remaining = [...deck.slice(idx, startIdx), ...deck.slice(startIdx + 1)];

  const activeColor = firstCard.type === 'color' ? firstCard.color : 'red';

  // Apply first card effects
  let currentPlayer = 0;
  let direction: 1 | -1 = 1;

  if (firstCard.type === 'color') {
    if (firstCard.value === 'skip') {
      currentPlayer = 1; // skip player 0
    } else if (firstCard.value === 'reverse') {
      direction = -1;
      currentPlayer = NUM_PLAYERS - 1; // reverse means last player goes first
    }
    // draw2 on first card: player 0 draws 2 and is skipped (handled in UI)
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

function nextPlayer(state: UnoState, skip = 0): number {
  let p = state.currentPlayer;
  for (let i = 0; i <= skip; i++) {
    p = ((p + state.direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
  }
  return p;
}

/** Recycle discard pile into draw pile (keep top card) */
function recycleDiscard(state: UnoState) {
  if (state.drawPile.length > 0) return;
  const top = state.discardPile[state.discardPile.length - 1];
  const recycled = shuffleDeck(state.discardPile.slice(0, -1));
  state.drawPile = recycled;
  state.discardPile = [top];
}

/** Draw N cards for a player */
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

/** Play a card from a player's hand */
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

  // Set chosen color for wild cards
  if (card.type === 'wild') {
    (card as WildCard).chosenColor = chosenColor ?? 'red';
    s.activeColor = (card as WildCard).chosenColor!;
  } else {
    s.activeColor = card.color;
  }

  s.discardPile.push(card);

  // Apply effects BEFORE win check — pendingDraw affects next player even if this player wins
  if (card.type === 'color') {
    switch (card.value) {
      case 'reverse':
        s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
        // In 2-player game reverse acts like skip, but with 4 players it just changes direction
        s.currentPlayer = nextPlayer(s);
        break;
      case 'skip':
        s.currentPlayer = nextPlayer(s, 1); // skip next player
        break;
      case 'draw2':
        s.pendingDraw += 2;
        s.currentPlayer = nextPlayer(s);
        break;
      default:
        s.currentPlayer = nextPlayer(s);
    }
  } else {
    // Wild Draw Four
    if (card.wildType === 'wild_draw4') {
      s.pendingDraw += 4;
    }
    s.currentPlayer = nextPlayer(s);
  }

  // Check win (must be last so all effects apply before winner is declared)
  if (s.hands[player].length === 0) {
    s.winner = player;
  }

  return s;
}

/** Get playable cards for a player */
export function getPlayableCards(state: UnoState, player: number): UnoCard[] {
  if (state.winner !== null) return [];
  if (player !== state.currentPlayer) return [];

  const topCard = state.discardPile[state.discardPile.length - 1];

  // If there's a pending draw, player must draw (can't play - simplified rules)
  if (state.pendingDraw > 0) return [];

  return state.hands[player].filter(c => canPlay(c, topCard, state.activeColor));
}

/** Handle drawing for current player (either forced from +2/+4 or voluntary) */
export function handleDraw(state: UnoState): UnoState {
  const player = state.currentPlayer;
  const count = state.pendingDraw > 0 ? state.pendingDraw : 1;

  let s = drawCards(state, player, count);
  s.pendingDraw = 0;

  // If it was a forced draw, skip to next player
  // If voluntary (count was 1), also move to next player
  s.currentPlayer = nextPlayer(s);

  return s;
}

/** Score a color for AI selection — lower is better */
function scoreColor(
  color: UnoColor,
  hand: UnoCard[],
  topCardValue: string | undefined,
): number {
  const colorCards = hand.filter((c): c is ColorCard => c.type === 'color' && c.color === color);
  const count = colorCards.length;
  // Prefer colors with fewer cards (fewer stuck cards)
  let score = 100 - count * 10;
  // But prioritize the color matching the top card's value (keeps options open)
  const hasMatchingValue = colorCards.some((c) => c.value === topCardValue);
  if (hasMatchingValue) score += 15;
  // Value action cards in the same color (keep skip/reverse/draw2 for defense)
  const actionCount = colorCards.filter((c) => ['skip', 'reverse', 'draw2'].includes(c.value)).length;
  score += actionCount * 5;
  return score;
}

/** Pick the best playable card using basic strategy */
function pickBestCard(playable: UnoCard[], _hand: UnoCard[], activeColor: UnoColor): UnoCard {
  // Prefer action cards when safe (they disrupt opponents)
  const actionCards = playable.filter((c): c is ColorCard => c.type === 'color' && ['skip', 'reverse', 'draw2'].includes(c.value));
  const numberCards = playable.filter((c): c is ColorCard => c.type === 'color' && !['skip', 'reverse', 'draw2'].includes(c.value));
  const wildCards = playable.filter((c) => c.type === 'wild');

  // Play a non-wild action card if available (wilds are better saved)
  if (actionCards.length > 0) {
    // Prefer reverse > skip > draw2 (reverse changes direction, most disruptive)
    const reverse = actionCards.filter((c) => c.value === 'reverse');
    if (reverse.length > 0) return reverse[Math.floor(Math.random() * reverse.length)];
    const skip = actionCards.filter((c) => c.value === 'skip');
    if (skip.length > 0) return skip[Math.floor(Math.random() * skip.length)];
    // Draw2 only if no other choice (it stacks pendingDraw)
    if (numberCards.length === 0 && wildCards.length === 0) {
      return actionCards[0];
    }
  }

  // Play a number card
  if (numberCards.length > 0) {
    // Prefer cards matching active color (safe plays)
    const matchingColor = numberCards.filter((c) => c.color === activeColor);
    if (matchingColor.length > 0) {
      return matchingColor[Math.floor(Math.random() * matchingColor.length)];
    }
    return numberCards[Math.floor(Math.random() * numberCards.length)];
  }

  // Fall back to wild
  return wildCards[0] ?? playable[0];
}

/** Smart AI: pick the best playable card using basic strategy, or draw */
export function aiTurn(state: UnoState): UnoState {
  const player = state.currentPlayer;

  // Must draw if pending
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

  // Pick the best card using strategy
  const card = pickBestCard(playable, hand, state.activeColor);

  // For wild cards, choose the color with best strategic value
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

/** Play a complete bot-only game for deterministic test harnesses and demos. */
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

  const completed = state.winner !== null;
  return {
    state,
    completed,
    turnsPlayed,
    winner: state.winner,
    reason: completed ? 'winner' : 'turn_limit',
  };
}

/** Score a color for AI selection using schema card format */
export function scoreColorSchema(
  color: UnoColor,
  hand: { cardType: string; color: string; value: string }[],
  topCardValue: string | undefined,
  discardedCounts?: Record<string, number>,
): number {
  const colorCards = hand.filter((c) => c.cardType === 'color' && c.color === color);
  const count = colorCards.length;
  // Depletion bonus: prefer colors with many cards already discarded (safer to play)
  const discarded = discardedCounts?.[color] ?? 0;
  let score = 100 - count * 10 + discarded * 2;
  const hasMatchingValue = colorCards.some((c) => c.value === topCardValue);
  if (hasMatchingValue) score += 15;
  const actionCount = colorCards.filter((c) => ['skip', 'reverse', 'draw2'].includes(c.value)).length;
  score += actionCount * 5;
  return score;
}

/** Pick the best playable card index using schema card format (for Colyseus bot) */
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

/** Choose the best color for a wild card using schema card format */
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

// ── Schema-compatible helpers (for multiplayer) ─────────────────

/** Card texture name from schema card data */
export function cardTextureFromSchema(card: { cardType: string; color: string; value: string }): string {
  if (card.cardType === 'wild') return card.value;
  return `${card.color}_${card.value}`;
}

/** Can this schema card be played on top of the discard pile? */
export function canPlaySchema(
  card: { cardType: string; color: string; value: string },
  topCard: { cardType: string; value: string },
  activeColor: string,
  pendingDraw?: number,
): boolean {
  if (pendingDraw && pendingDraw > 0) {
    if (card.cardType === 'color' && card.value === 'draw2') return true;
    if (card.cardType === 'wild' && card.value === 'wild_draw4' && pendingDraw >= 4) return true;
    return false;
  }
  if (card.cardType === 'wild') return true;
  if (card.color === activeColor) return true;
  if (topCard.cardType === 'color' && card.value === topCard.value) return true;
  return false;
}
