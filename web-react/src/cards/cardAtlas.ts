export const CARD_COLS = 10;
export const CARD_ROWS = 6;
export const CARD_ASPECT = 240 / 375;

const COLORS = ['red', 'blue', 'green', 'yellow'] as const;
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const ACTIONS = ['skip', 'reverse', 'draw2'] as const;

export const CARD_IDS: string[] = [];
for (const color of COLORS) {
  for (const n of NUMBERS) CARD_IDS.push(`${color}_${n}`);
  for (const a of ACTIONS) CARD_IDS.push(`${color}_${a}`);
}
CARD_IDS.push('wild', 'wild_draw4', 'back');

export interface CardUVs {
  u: number;
  v: number;
  w: number;
  h: number;
}

export function getCardUVs(id: string): CardUVs {
  const index = CARD_IDS.indexOf(id);
  const safeIndex = index === -1 ? CARD_IDS.indexOf('back') : index;
  const row = Math.floor(safeIndex / CARD_COLS);
  const col = safeIndex % CARD_COLS;
  return {
    u: col / CARD_COLS,
    v: row / CARD_ROWS,
    w: 1 / CARD_COLS,
    h: 1 / CARD_ROWS,
  };
}

export function getCardCssBackgroundPosition(id: string): string {
  const index = CARD_IDS.indexOf(id);
  const safeIndex = index === -1 ? CARD_IDS.indexOf('back') : index;
  const row = Math.floor(safeIndex / CARD_COLS);
  const col = safeIndex % CARD_COLS;
  return `${(col * 100) / (CARD_COLS - 1)}% ${(row * 100) / (CARD_ROWS - 1)}%`;
}
