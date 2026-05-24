// ── Uno Game Logic ─────────────────────────────────────────────────────

import type { UnoCard, UnoColor } from './types.ts';

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
