import { SceneActions } from './SceneActions';
import { SceneHeader } from './SceneHeader';
import { SceneSpecs } from './SceneSpecs';
import { SceneUtilityPanels } from './SceneUtilityPanels';
import type { CardTableController } from '../useCardTableController';

interface SceneOverlayProps {
  controller: CardTableController;
}

export function SceneOverlay({ controller }: SceneOverlayProps) {
  const {
    flipHand,
    handleVolumeChange,
    isMuted,
    resetTable,
    shuffleDeck,
    toggleMute,
    drawCard,
  } = controller;

  return (
    <div className="scene-overlay">
      <SceneHeader />
      <SceneSpecs />
      <SceneActions
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onVolumeChange={handleVolumeChange}
        onFlipHand={flipHand}
        onDrawCard={drawCard}
        onShuffleDeck={shuffleDeck}
        onResetTable={resetTable}
      />
      <SceneUtilityPanels controller={controller} />
    </div>
  );
}
