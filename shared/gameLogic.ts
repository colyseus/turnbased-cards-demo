// ── Uno Game Logic ─────────────────────────────────────────────────────

import type { UnoCard, UnoColor } from './types.ts';

const UNO_COLORS: readonly UnoColor[] = ['red', 'blue', 'green', 'yellow'];
const UNO_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']);
const WILD_VALUES = new Set(['wild', 'wild_draw4']);

export type CardLike = {
  type?: string;
  cardType?: string;
  color?: string;
  value?: string;
  wildType?: string;
};

type SchemaCardLike = {
  id: string;
  cardType: string;
  color: string;
  value: string;
  chosenColor: string;
};

export function isUnoColor(value: unknown): value is UnoColor {
  return typeof value === 'string' && UNO_COLORS.includes(value as UnoColor);
}

function normalizedCardType(card: CardLike | unknown): string | undefined {
  if (!card || typeof card !== 'object') return undefined;
  const raw = card as CardLike;
  return raw.type ?? raw.cardType;
}

function normalizedCardValue(card: CardLike | unknown): string | undefined {
  if (!card || typeof card !== 'object') return undefined;
  const raw = card as CardLike;
  return raw.wildType ?? raw.value;
}

function isValidPlayableCard(card: unknown): boolean {
  if (!card || typeof card !== 'object') return false;
  const raw = card as CardLike;
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

function canPlayNormalized(
  card: CardLike,
  topCard: CardLike,
  activeColor: UnoColor,
  pendingDraw?: number,
): boolean {
  const cardType = card.type ?? card.cardType;
  const topCardType = topCard.type ?? topCard.cardType;
  if (pendingDraw && pendingDraw > 0) return false;
  if (cardType === 'wild') return true;
  if (card.color === activeColor) return true;
  if (topCardType === 'color' && card.value === topCard.value) return true;
  return false;
}

export function pickBestPlayableCard<T extends CardLike>(
  playable: readonly T[],
  activeColor: UnoColor,
  topCardValue?: string,
): T {
  const actionCards = playable.filter(
    (c) => normalizedCardType(c) === 'color' && ['skip', 'reverse', 'draw2'].includes(normalizedCardValue(c) ?? ''),
  );

  const reverse = actionCards.filter((c) => normalizedCardValue(c) === 'reverse');
  if (reverse.length > 0) return reverse[0];

  const skip = actionCards.filter((c) => normalizedCardValue(c) === 'skip');
  if (skip.length > 0) return skip[0];

  const draw2 = actionCards.filter((c) => normalizedCardValue(c) === 'draw2');
  if (draw2.length > 0) return draw2[0];

  const colorCards = playable.filter((c) => normalizedCardType(c) === 'color' && c.color === activeColor);
  const numberCards = colorCards.filter((c) => !['skip', 'reverse', 'draw2'].includes(normalizedCardValue(c) ?? ''));
  if (numberCards.length > 0) return numberCards[0];

  if (typeof topCardValue === 'string') {
    const matchingValueCards = playable.filter(
      (c) =>
        normalizedCardType(c) === 'color' &&
        c.color !== activeColor &&
        !['skip', 'reverse', 'draw2'].includes(normalizedCardValue(c) ?? '') &&
        normalizedCardValue(c) === topCardValue,
    );
    if (matchingValueCards.length > 0) return matchingValueCards[0];
  }

  const wildCards = playable.filter((c) => normalizedCardType(c) === 'wild');
  return wildCards[0] ?? playable[0];
}

export function populateSchemaCard<T extends SchemaCardLike>(target: T, card: UnoCard): T {
  target.id = card.id;
  if (card.type === 'color') {
    target.cardType = 'color';
    target.color = card.color;
    target.value = card.value;
    target.chosenColor = '';
  } else {
    target.cardType = 'wild';
    target.color = '';
    target.value = card.wildType;
    target.chosenColor = card.chosenColor || '';
  }
  return target;
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
  return canPlayNormalized(card as CardLike, topCard as CardLike, activeColor, pendingDraw);
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
  return canPlayNormalized(card as CardLike, topCard as CardLike, activeColor, pendingDraw);
}

/** Does this hand contain a normal legal option that blocks wild draw four? */
export function hasWildDrawFourAlternative(
  hand: Array<UnoCard | { cardType: string; color: string; value: string }>,
  activeColor: UnoColor | string,
): boolean {
  return hand.some((card) => {
    const c = card as CardLike;
    return (c.type ?? c.cardType) === 'color' && c.color === activeColor;
  });
}
