import { Canvas } from '@react-three/fiber';
import { DeckPiles } from './DeckPiles';
import { CardField } from './CardField';
import type { CardTableController } from '../useCardTableController';

interface TableCanvasProps {
  controller: CardTableController;
}

export function TableCanvas({ controller }: TableCanvasProps) {
  const {
    deckCount,
    isShuffling,
    drawCard,
    cardLayout,
  } = controller;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'auto' }}>
      <Canvas
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 5, pointerEvents: 'auto' }}
        camera={{ position: [0, 0, 10], zoom: 60 }}
        orthographic
        flat
        frameloop="demand"
        gl={{ alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={1.5} />
        <DeckPiles
          deckCount={deckCount}
          drawCard={drawCard}
          isShuffling={isShuffling}
          pileY={cardLayout.pileY}
          pileScale={cardLayout.pileScale}
          deckX={cardLayout.deckX}
          discardX={cardLayout.discardX}
        />
        <CardField controller={controller} />
      </Canvas>
    </div>
  );
}
