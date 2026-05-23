import { getStats } from '../../stats';

interface OptionsOverlayProps {
  onClose: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  qualityLevel: string;
  onQualityToggle: () => void;
  playerName?: string;
}

export default function OptionsOverlay({
  onClose,
  soundEnabled,
  onSoundToggle,
  qualityLevel,
  onQualityToggle,
  playerName,
}: OptionsOverlayProps) {
  const qualityLabel = qualityLevel.toUpperCase();
  const stats = playerName ? getStats(playerName) : null;

  return (
    <div
      className="rules-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
      onClick={onClose}
    >
      <div className="rules-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-header">
          <h2>Options</h2>
          <button className="rules-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="rules-body">
          <section>
            <h3>Sound</h3>
            <div className="option-row">
              <span>Sound effects</span>
              <button className={`toggle-btn${soundEnabled ? ' on' : ''}`} onClick={onSoundToggle}>
                {soundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </section>
          <section>
            <h3>Display</h3>
            <div className="option-row">
              <span>Card sorting</span>
              <button className="toggle-btn on">AUTO</button>
            </div>
            <div className="option-row" style={{ marginTop: 8 }}>
              <span>Quality (Q)</span>
              <button className="toggle-btn on" onClick={onQualityToggle}>
                {qualityLabel}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Cycles: Low → Medium → High
            </p>
          </section>
          {stats && (
            <section>
              <h3>Your Stats</h3>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}
              >
                <div style={{ color: 'var(--text-muted)' }}>
                  Games: <span style={{ color: 'var(--text-primary)' }}>{stats.gamesPlayed}</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Wins: <span style={{ color: 'var(--accent)' }}>{stats.wins}</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  UNO calls: <span style={{ color: 'var(--text-primary)' }}>{stats.unoCalls}</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Cards: <span style={{ color: 'var(--text-primary)' }}>{stats.cardsPlayed}</span>
                </div>
              </div>
            </section>
          )}
          <section>
            <h3>About</h3>
            <p>Turn-based Card Game — Colyseus Demo</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Built with React Three Fiber, TypeScript, and Colyseus
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
