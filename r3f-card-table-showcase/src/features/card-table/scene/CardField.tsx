import { Suspense } from 'react';
import type { CardTableController } from '../useCardTableController';
import { CardFieldCard } from './CardFieldCard';

interface CardFieldProps {
  controller: CardTableController;
}

export function CardField({ controller }: CardFieldProps) {
  const { cards, cardTargets, isShuffling, handleCardDrop, topDeckCardId } = controller;

  return (
    <Suspense fallback={null}>
      {cards.map((card) => {
        const target = cardTargets.get(card.id)!;
        const isVisible = card.location !== 'deck' || (card.id === topDeckCardId && !isShuffling);

        return (
          <CardFieldCard
            key={card.id}
            card={card}
            target={target}
            isVisible={isVisible}
            onDrop={handleCardDrop}
          />
        );
      })}
    </Suspense>
  );
}
