// ── Uno Types ──────────────────────────────────────────────────────────

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
