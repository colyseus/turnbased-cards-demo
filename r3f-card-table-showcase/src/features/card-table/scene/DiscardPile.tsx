import { Html } from '@react-three/drei';
import { PileLabel } from './PileLabel';

interface DiscardPileProps {
  pileY: number;
  discardX: number;
  pileScale: number;
}

export function DiscardPile({ pileY, discardX, pileScale }: DiscardPileProps) {
  return (
    <group position={[discardX, pileY, 0]}>
      <Html transform center scale={pileScale} zIndexRange={[100, 10]} style={{ pointerEvents: 'none' }}>
        <div className="card-component" id="discard-pile" style={{ cursor: 'default', margin: 0 }}>
          <div className="card-component-inner">
            <div className="card-face-front" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.15)' }}>
              <span style={{ fontSize: '32px', color: 'rgba(255,255,255,0.15)' }}>+</span>
            </div>
            <div className="card-face-back" />
          </div>
        </div>
      </Html>
      <PileLabel text="DISCARD PILE" />
    </group>
  );
}
