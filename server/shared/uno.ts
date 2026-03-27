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

/** Build a full 108-card Uno deck */
export function createUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let uid = 0;

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
export function canPlay(card: UnoCard, topCard: UnoCard, activeColor: UnoColor): boolean {
  // Wild cards can always be played
  if (card.type === 'wild') return true;

  // Match by color
  if (card.color === activeColor) return true;

  // Match by value/symbol
  if (topCard.type === 'color' && card.value === topCard.value) return true;

  return false;
}

/** Get the active color (considering wild card choices) */
export function getActiveColor(topCard: UnoCard): UnoColor {
  if (topCard.type === 'wild') return topCard.chosenColor ?? 'red';
  return topCard.color;
}

// ── Game State ──────────────────────────────────────────────────────

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

const HAND_SIZE = 7;
const NUM_PLAYERS = 4;

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
  const s = { ...state, hands: state.hands.map(h => [...h]), drawPile: [...state.drawPile], discardPile: [...state.discardPile] };
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
  const s = { ...state, hands: state.hands.map(h => [...h]), drawPile: [...state.drawPile], discardPile: [...state.discardPile] };

  const handIdx = s.hands[player].findIndex(c => c.id === cardId);
  if (handIdx === -1) return state;

  const card = { ...s.hands[player][handIdx] };
  s.hands[player].splice(handIdx, 1);

  // Set chosen color for wild cards
  if (card.type === 'wild') {
    (card as WildCard).chosenColor = chosenColor ?? 'red';
    s.activeColor = (card as WildCard).chosenColor!;
  } else {
    s.activeColor = card.color;
  }

  s.discardPile.push(card);

  // Check win
  if (s.hands[player].length === 0) {
    s.winner = player;
    return s;
  }

  // Apply effects
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

/** Simple AI: pick a random playable card, or draw */
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

  // Pick a random playable card (prefer action cards and wilds to be slightly strategic)
  const card = playable[Math.floor(Math.random() * playable.length)];

  // For wild cards, choose the color we have the most of
  let chosenColor: UnoColor | undefined;
  if (card.type === 'wild') {
    const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const c of state.hands[player]) {
      if (c.type === 'color') colorCounts[c.color]++;
    }
    chosenColor = (Object.entries(colorCounts) as [UnoColor, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  return playCard(state, player, card.id, chosenColor);
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
): boolean {
  if (card.cardType === 'wild') return true;
  if (card.color === activeColor) return true;
  if (topCard.cardType === 'color' && card.value === topCard.value) return true;
  return false;
}
