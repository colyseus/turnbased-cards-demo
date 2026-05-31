export type CardLocation = 'deck' | 'hand' | 'discard';

export interface CardData {
  id: string;
  suit: string;
  rank: string;
  symbol: string;
  location: CardLocation;
  index: number;
  textureName?: string;
}

export interface ToastRef {
  show: (message: string) => void;
}

export interface CardTarget {
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  ry: number;
  rz: number;
  zIndex: number;
}

export interface CardLayout {
  fanWidth: number;
  arcHeight: number;
  maxTilt: number;
  handY: number;
  pileY: number;
  pileScale: number;
  deckX: number;
  discardX: number;
}
