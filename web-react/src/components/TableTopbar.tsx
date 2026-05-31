import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { PingVisualizer } from "./PingVisualizer";

interface TableTopbarProps {
  roomCode: string;
  isMyTurn: boolean;
  currentPlayerLabel: string;
  direction: number | undefined;
  ping: number | null;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
  onShowRules: () => void;
  onLeave: () => void;
}

export function TableTopbar({
  roomCode,
  isMyTurn,
  currentPlayerLabel,
  direction,
  ping,
  colorblindMode,
  onToggleColorblind,
  onShowRules,
  onLeave,
}: TableTopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-info">
        <div className="topbar-stat">
          <span>Invite code</span>
          <strong>{roomCode}</strong>
        </div>
        <div className="topbar-stat">
          <span>Turn status</span>
          <strong style={{ color: isMyTurn ? "var(--gold)" : "var(--text-primary)" }}>
            {isMyTurn ? "Your Turn!" : currentPlayerLabel}
          </strong>
        </div>
        <div className="topbar-stat">
          <span>Play order</span>
          <strong>{direction === -1 ? "Counter-Clockwise ◀" : "Clockwise ▶"}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        <PingVisualizer ping={ping} />
        <AudioSettingsPanel />
        <button
          className={`ghost-btn ${colorblindMode ? "active-acc" : ""}`}
          onClick={onToggleColorblind}
          type="button"
          title="Toggle colorblind accessibility symbols"
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          ♿ {colorblindMode ? "CB: On" : "CB: Off"}
        </button>
        <button className="ghost-btn" data-testid="topbar-rules" onClick={onShowRules} type="button">
          Rules (?)
        </button>
        <button className="ghost-btn" onClick={onLeave} type="button">
          Leave Game
        </button>
      </div>
    </header>
  );
}
