import { useRoom, useRoomState } from '../../colyseus';
import { PlayerSchema } from '../../types';

export default function RematchOverlay() {
  const { room } = useRoom();
  const state = useRoomState();

  if (!room || !state || state.phase !== 'finished') return null;

  const rematchVotes = (state as unknown as { rematchVotes?: number[] }).rematchVotes ?? [];

  // Count connected human players
  let connectedHumans = 0;
  for (const p of Object.values(state.players) as PlayerSchema[]) {
    if (!p.isBot && p.connected) connectedHumans++;
  }

  const voteCount = rematchVotes.length;
  const localPlayer = Object.values(state.players as PlayerSchema[]).find(
    (p) => p.sessionId === room.sessionId
  );
  const canVote = localPlayer && !localPlayer.isBot;
  const localVoted = localPlayer ? rematchVotes.includes(localPlayer.seatIndex) : false;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Rematch"
    >
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
        {voteCount}/{connectedHumans} voted for rematch
      </div>
      {canVote && !localVoted && (
        <button
          className="wood-btn"
          onClick={() => {
            room.send('vote_rematch');
          }}
        >
          Vote Rematch
        </button>
      )}
      {canVote && localVoted && (
        <button className="wood-btn" disabled style={{ opacity: 0.5, cursor: 'default' }}>
          Voted ✓
        </button>
      )}
      <button
        className="wood-btn"
        style={{ fontSize: 14, padding: '10px 28px' }}
        onClick={() => room.send('restart')}
      >
        New Game
      </button>
    </div>
  );
}
