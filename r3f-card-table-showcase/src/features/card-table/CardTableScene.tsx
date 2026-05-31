import { BoardBackdrop } from './scene/BoardBackdrop';
import { SceneErrorBoundary } from './scene/SceneErrorBoundary';
import { SceneOverlay } from './scene/SceneOverlay';
import { TableCanvas } from './scene/TableCanvas';
import type { CardTableController } from './useCardTableController';

interface CardTableSceneProps {
  controller: CardTableController;
}

export function CardTableScene({ controller }: CardTableSceneProps) {
  return (
    <BoardBackdrop feltTheme={controller.feltTheme}>
      <SceneErrorBoundary>
        <TableCanvas controller={controller} />
      </SceneErrorBoundary>
      <SceneOverlay controller={controller} />
    </BoardBackdrop>
  );
}
