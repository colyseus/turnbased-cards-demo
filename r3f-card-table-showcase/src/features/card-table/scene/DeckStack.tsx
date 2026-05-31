import { Html } from '@react-three/drei';
import { PileLabel } from './PileLabel';

interface DeckStackProps {
  deckCount: number;
  drawCard: () => void;
  isShuffling: boolean;
  pileY: number;
  deckX: number;
  pileScale: number;
}

export function DeckStack({ deckCount, drawCard, isShuffling, pileY, deckX, pileScale }: DeckStackProps) {
  return (
    <group position={[deckX, pileY, 0]}>
      <Html transform center scale={pileScale} zIndexRange={[100, 10]} style={{ pointerEvents: 'none' }}>
        <div className="luxury-deck-stack" id="deck-draw" style={{ position: 'relative', margin: 0, pointerEvents: 'auto' }} onClick={drawCard}>
          <div className={`luxury-deck-layer layer-6 ${isShuffling ? 'shuffling-left' : ''}`} />
          <div className={`luxury-deck-layer layer-5 ${isShuffling ? 'shuffling-right' : ''}`} />
          <div className={`luxury-deck-layer layer-4 ${isShuffling ? 'shuffling-left' : ''}`} />
          <div className={`luxury-deck-layer layer-3 ${isShuffling ? 'shuffling-right' : ''}`} />
          <div className={`luxury-deck-layer layer-2 ${isShuffling ? 'shuffling-left' : ''}`} />
          <div className={`luxury-deck-layer layer-1 ${isShuffling ? 'shuffling-right' : ''}`} />
          <div className={`luxury-deck-top-card ${isShuffling ? 'shuffling-top-card' : ''}`}>
            <div className="luxury-card-back-emblem" />
          </div>
        </div>
      </Html>
      <PileLabel text={`DRAW DECK (${deckCount})`} />
    </group>
  );
}
