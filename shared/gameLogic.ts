// ── Uno Game Logic ─────────────────────────────────────────────────────

import type { UnoCard, UnoColor } from './types.ts';

const UNO_COLORS: readonly UnoColor[] = ['red', 'blue', 'green', 'yellow'];
const UNO_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']);
const WILD_VALUES = new Set(['wild', 'wild_draw4']);

export function isUnoColor(value: unknown): value is UnoColor {
  return typeof value === 'string' && UNO_COLORS.includes(value as UnoColor);
}

function normalizedCardType(card: unknown): string | undefined {
  if (!card || typeof card !== 'object') return undefined;
  return (card as { type?: string; cardType?: string }).type ?? (card as { type?: string; cardType?: string }).cardType;
}

function normalizedCardValue(card: unknown): string | undefined {
  if (!card || typeof card !== 'object') return undefined;
  const raw = card as { value?: string; wildType?: string };
  return raw.wildType ?? raw.value;
}

function isValidPlayableCard(card: unknown): boolean {
  if (!card || typeof card !== 'object') return false;
  const raw = card as { color?: string };
  const cardType = normalizedCardType(card);
  const value = normalizedCardValue(card);

  if (cardType === 'color') {
    return isUnoColor(raw.color) && typeof value === 'string' && UNO_VALUES.has(value);
  }

  if (cardType === 'wild') {
    return typeof value === 'string' && WILD_VALUES.has(value);
  }

  return false;
}

function isValidTopCard(card: unknown): boolean {
  if (!card || typeof card !== 'object') return false;
  const cardType = normalizedCardType(card);
  const value = normalizedCardValue(card);

  if (cardType === 'color') {
    return typeof value === 'string' && UNO_VALUES.has(value);
  }

  if (cardType === 'wild') {
    return typeof value === 'string' && WILD_VALUES.has(value);
  }

  return false;
}

/** The filename (without extension) used to load the card texture */
export function cardTexture(card: UnoCard): string {
  if (card.type === 'wild') return card.wildType;
  return `${card.color}_${card.value}`;
}

/** Can this card be played on top of the discard pile? (accepts both UnoCard and schema card formats) */
export function canPlay(
  card: UnoCard | { cardType: string; color: string; value: string; wildType?: string },
  topCard: UnoCard | { cardType: string; value: string },
  activeColor: UnoColor,
  pendingDraw?: number,
): boolean {
  if (!isValidPlayableCard(card) || !isValidTopCard(topCard) || !isUnoColor(activeColor)) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = card as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = topCard as any;
  const cardType = c.type ?? c.cardType;
  const topCardType = t.type ?? t.cardType;
  if (pendingDraw && pendingDraw > 0) return false;
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

// ── Schema-compatible helpers (for Colyseus multiplayer) ─────────────

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
  if (!isValidPlayableCard(card) || !isValidTopCard(topCard) || !isUnoColor(activeColor)) return false;

  if (pendingDraw && pendingDraw > 0) return false;
  if (card.cardType === 'wild') return true;
  if (card.color === activeColor) return true;
  if (topCard.cardType === 'color' && card.value === topCard.value) return true;
  return false;
}

/** Does this hand contain a normal legal option that blocks wild draw four? */
export function hasWildDrawFourAlternative(
  hand: Array<UnoCard | { cardType: string; color: string; value: string }>,
  _topCard: UnoCard | { cardType: string; value: string },
  activeColor: UnoColor | string,
): boolean {
  return hand.some((card) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = card as any;
    return (c.type ?? c.cardType) === 'color' && c.color === activeColor;
  });
}
