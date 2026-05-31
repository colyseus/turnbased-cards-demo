import type { ChangeEvent } from 'react';
import { AudioControlHUD } from '../controls';
import { SceneActionButton } from './SceneActionButton';

interface SceneActionsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFlipHand: () => void;
  onDrawCard: () => void;
  onShuffleDeck: () => void;
  onResetTable: () => void;
}

export function SceneActions({
  isMuted,
  onToggleMute,
  onVolumeChange,
  onFlipHand,
  onDrawCard,
  onShuffleDeck,
  onResetTable,
}: SceneActionsProps) {
  return (
    <div className="control-hub">
      <AudioControlHUD isMuted={isMuted} onToggleMute={onToggleMute} onVolumeChange={onVolumeChange} />
      <SceneActionButton id="btn-flip" label="Flip Hand" hotkey="F" onClick={onFlipHand} />
      <SceneActionButton id="btn-draw" label="Draw Card" hotkey="D" onClick={onDrawCard} />
      <SceneActionButton id="btn-shuffle" label="Shuffle Deck" hotkey="S" onClick={onShuffleDeck} />
      <SceneActionButton id="btn-reset" label="Reset Board" hotkey="R" onClick={onResetTable} />
    </div>
  );
}
