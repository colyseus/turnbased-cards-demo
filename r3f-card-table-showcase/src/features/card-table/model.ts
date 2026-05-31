import type { CardData, CardLayout, CardTarget } from './types';

export const generateDeck = (): CardData[] => {
  const handCards = [
    { suit: 'hearts', rank: 'A', symbol: '♥' },
    { suit: 'spades', rank: 'K', symbol: '♠' },
    { suit: 'skip', rank: '', symbol: '' },
    { suit: 'reverse', rank: '', symbol: '' },
    { suit: 'draw2', rank: '', symbol: '' },
  ];

  return Array.from({ length: 25 }).map((_, index) => {
    let suit = 'diamonds';
    let rank = '0';
    let symbol = '♦';

    if (index < 5) {
      suit = handCards[index].suit;
      rank = handCards[index].rank;
      symbol = handCards[index].symbol;
    }

    return {
      id: `card-${index}`,
      suit,
      rank,
      symbol,
      location: index < 5 ? 'hand' : 'deck',
      index: index >= 5 ? index - 5 : index,
    };
  });
};

export function computeCardTarget(
  card: CardData,
  allCards: CardData[],
  isFaceDown: boolean,
  layout: CardLayout,
): CardTarget {
  if (card.location === 'deck') {
    const jitterX = Math.sin(card.index * 1234.5) * 0.05;
    const jitterY = Math.cos(card.index * 6789.0) * 0.05;
    const jitterRotZ = Math.sin(card.index * 3456.7) * 0.03;

    return {
      tx: layout.deckX + jitterX,
      ty: 0 + jitterY,
      tz: card.index * 0.02,
      rx: 0,
      ry: Math.PI,
      rz: jitterRotZ,
      zIndex: card.index,
    };
  }

  if (card.location === 'discard') {
    return {
      tx: layout.discardX,
      ty: 0 + card.index * 0.01,
      tz: card.index * 0.02,
      rx: 0,
      ry: 0,
      rz: Math.sin(card.index * 111) * 0.1,
      zIndex: card.index,
    };
  }

  const handCards = allCards.filter((c) => c.location === 'hand');
  const total = handCards.length;
  const handIndex = handCards.findIndex((c) => c.id === card.id);

  const spacing = total > 1 ? layout.fanWidth / (total - 1) : 0;
  const startX = -((total - 1) * spacing) / 2;
  const x = startX + handIndex * spacing;

  const norm = total > 1 ? (handIndex / (total - 1)) * 2 - 1 : 0;
  const y = layout.handY + (1 - norm * norm) * layout.arcHeight;

  const rz = -norm * layout.maxTilt;

  return {
    tx: x,
    ty: y,
    tz: handIndex * 0.02 + 0.1,
    rx: 0,
    ry: isFaceDown ? Math.PI : 0,
    rz,
    zIndex: handIndex,
  };
}

export function resolveCardFace(card: CardData) {
  let suit = card.suit;
  let rank = card.rank;
  let symbol = card.symbol;

  if (card.textureName) {
    if (card.textureName === 'wild') {
      suit = 'wild';
      rank = 'WILD';
      symbol = '✨';
    } else if (card.textureName === 'wild_draw4') {
      suit = 'wild4';
      rank = '+4';
      symbol = '✨';
    } else {
      const parts = card.textureName.split('_');
      if (parts.length === 2) {
        const color = parts[0];
        const value = parts[1];

        if (color === 'red') suit = 'hearts';
        else if (color === 'blue') suit = 'skip';
        else if (color === 'green') suit = 'reverse';
        else if (color === 'yellow') suit = 'draw2';

        if (value === 'skip' || value === 'reverse' || value === 'draw2') {
          rank = '';
          symbol = '';
        } else {
          rank = value.toUpperCase();
          symbol = value.toUpperCase();
        }
      }
    }
  }

  return { suit, rank, symbol };
}
