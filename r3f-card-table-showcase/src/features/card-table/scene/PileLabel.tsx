import { Html } from '@react-three/drei';

interface PileLabelProps {
  text: string;
}

export function PileLabel({ text }: PileLabelProps) {
  return (
    <Html position={[0, 1.8, 0]} center zIndexRange={[100, 10]}>
      <div className="deck-label" style={{ whiteSpace: 'nowrap' }}>{text}</div>
    </Html>
  );
}
