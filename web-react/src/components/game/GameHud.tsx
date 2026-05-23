import { lazy, Suspense } from 'react';
import { useRoom, useRoomState } from '../../colyseus';
import { LastPlayedInfo } from '../GameScene';
import { PlayerSchema } from '../../types';

// Lazy-load heavy overlays from current flat directory
const RulesOverlay = lazy(() => import('./RulesOverlay'));
const OptionsOverlay = lazy(() => import('./OptionsOverlay'));
const ChatOverlay = lazy(() => import('./ChatOverlay'));
const RematchOverlay = lazy(() => import('./RematchOverlay'));

export interface GameHudProps {
  onSortToggle: () => void;
  sortByColor: boolean;
  qualityLevel: string;
  onQualityToggle: () => void;
  lastPlayed: LastPlayedInfo | null;
  showChat: boolean;
  onShowChat: () => void;
  onCloseChat: () => void;
  // UI States
  showRules: boolean;
  onShowRules: () => void;
  onCloseRules: () => void;
  showOptions: boolean;
  onShowOptions: () => void;
  onCloseOptions: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
}

export function GameHud({
  onSortToggle,
  sortByColor,
  qualityLevel,
  onQualityToggle,
  lastPlayed,
  showChat,
  onShowChat,
  onCloseChat,
  showRules,
  onShowRules,
  onCloseRules,
  showOptions,
  onShowOptions,
  onCloseOptions,
  soundEnabled,
  onSoundToggle,
}: GameHudProps) {
  const { room } = useRoom();
  const state = useRoomState();

  if (!state) return null;

  const me = room
    ? ((Object.values(state.players) as PlayerSchema[]).find(
        (p) => p.sessionId === room.sessionId
      ) ?? null)
    : null;
  const players = Object.values(state.players) as PlayerSchema[];
  const currentPlayer = players.find((p) => p.seatIndex === state.currentPlayer);
  const directionLabel = state.reverse ? 'Counter-clockwise' : 'Clockwise';
  const dockActions = [
    {
      label: sortByColor ? 'Number' : 'Color',
      detail: 'Sort',
      aria: sortByColor ? 'Sort by number' : 'Sort by color',
      onClick: onSortToggle,
    },
    {
      label: qualityLevel.slice(0, 1).toUpperCase(),
      detail: 'Quality',
      aria: `Quality: ${qualityLevel}`,
      onClick: onQualityToggle,
    },
    {
      label: soundEnabled ? 'On' : 'Off',
      detail: 'Sound',
      aria: soundEnabled ? 'Mute sound' : 'Enable sound',
      onClick: onSoundToggle,
    },
    { label: 'Rules', detail: 'Guide', aria: 'Show rules', onClick: onShowRules },
    { label: 'Setup', detail: 'Options', aria: 'Settings', onClick: onShowOptions },
    { label: 'Chat', detail: 'Table', aria: 'Show chat', onClick: onShowChat },
  ];

  return (
    <div className="game-hud">
      <aside className="arena-rail">
        <div className="arena-brand">
          <span>Room</span>
          <strong>{room?.roomId || '...'}</strong>
        </div>

        <div className="arena-metric">
          <span>Viewers</span>
          <strong>{state.spectatorCount}</strong>
        </div>

        <div className="seat-list" aria-label="Players">
          {players
            .sort((a, b) => a.seatIndex - b.seatIndex)
            .map((player) => (
              <div
                className={`seat-row${player.seatIndex === state.currentPlayer ? ' active' : ''}`}
                key={player.sessionId}
              >
                <span className="seat-index">{player.seatIndex + 1}</span>
                <span className="seat-name">{player.name}</span>
                <strong>{player.handCount ?? player.hand?.length ?? 0}</strong>
              </div>
            ))}
        </div>
      </aside>

      <section className="turn-card" aria-live="polite">
        <div>
          <span>Current Turn</span>
          <strong>{currentPlayer?.name || 'Waiting'}</strong>
        </div>
        <div>
          <span>Direction</span>
          <strong>{directionLabel}</strong>
        </div>
        <div>
          <span>Draw Stack</span>
          <strong>{state.pendingDraw || 0}</strong>
        </div>
      </section>

      {lastPlayed && (
        <div className="last-played-info">
          <span>Last play</span>
          <span className="player-name">{lastPlayed.playerName}</span>
          <span className="card-name">{lastPlayed.cardId.replace('_', ' ')}</span>
        </div>
      )}

      <nav className="arena-dock" aria-label="Game controls">
        {dockActions.map((action) => (
          <button
            className="dock-btn"
            aria-label={action.aria}
            key={action.aria}
            onClick={action.onClick}
            type="button"
          >
            <strong>{action.label}</strong>
            <span>{action.detail}</span>
          </button>
        ))}
      </nav>

      {/* Overlays */}
      <Suspense fallback={null}>
        {showRules && <RulesOverlay onClose={onCloseRules} />}
        {showOptions && (
          <OptionsOverlay
            onClose={onCloseOptions}
            soundEnabled={soundEnabled}
            onSoundToggle={onSoundToggle}
            qualityLevel={qualityLevel}
            onQualityToggle={onQualityToggle}
            playerName={me?.name}
          />
        )}
        {showChat && <ChatOverlay onClose={onCloseChat} />}
        {state.phase === 'finished' && (
          <div
            className="rematch-container"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              pointerEvents: 'auto',
            }}
          >
            <RematchOverlay />
          </div>
        )}
      </Suspense>
    </div>
  );
}
