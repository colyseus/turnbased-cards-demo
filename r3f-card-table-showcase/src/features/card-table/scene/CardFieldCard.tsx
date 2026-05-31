import { Card3D } from '../../../components/Card3D';
import { resolveCardFace } from '../model';
import type { CardData, CardTarget, CardLocation } from '../types';

interface CardFieldCardProps {
  card: CardData;
  target: CardTarget;
  isVisible: boolean;
  onDrop: (id: string, x: number) => void;
}

export function CardFieldCard({ card, target, isVisible, onDrop }: CardFieldCardProps) {
  const { suit, rank, symbol } = resolveCardFace(card);

  return (
    <Card3D
      key={card.id}
      id={card.id}
      suit={suit}
      rank={rank}
      symbol={symbol}
      tx={target.tx}
      ty={target.ty}
      tz={target.tz}
      rx={target.rx}
      ry={target.ry}
      rz={target.rz}
      zIndex={target.zIndex}
      location={card.location as CardLocation}
      isVisible={isVisible}
      onDrop={onDrop}
    />
  );
}
