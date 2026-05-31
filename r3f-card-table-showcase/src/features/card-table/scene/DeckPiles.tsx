import { DeckStack } from './DeckStack';
import { DiscardPile } from './DiscardPile';

interface DeckPilesProps {
  deckCount: number;
  drawCard: () => void;
  isShuffling: boolean;
  pileY: number;
  pileScale: number;
  deckX: number;
  discardX: number;
}

export function DeckPiles({ deckCount, drawCard, isShuffling, pileY, pileScale, deckX, discardX }: DeckPilesProps) {
  return (
    <>
      <DeckStack deckCount={deckCount} drawCard={drawCard} isShuffling={isShuffling} pileY={pileY} pileScale={pileScale} deckX={deckX} />
      <DiscardPile pileY={pileY} discardX={discardX} pileScale={pileScale} />
    </>
  );
}
