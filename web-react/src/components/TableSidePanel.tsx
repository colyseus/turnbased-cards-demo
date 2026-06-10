import { AvatarIcon } from "./AvatarIcon";
import type { Toast } from "../gameTypes";
import { getCardCountClass } from "../gameHelpers";
import type { MeSummary, RosterEntry } from "./tableRoomControllerLogic";

interface TableSidePanelProps {
  me: MeSummary | null;
  topCardLabel: string;
  phase: string | undefined;
  roster: RosterEntry[];
  cardBackTheme: string;
  onSetCardBackTheme: (theme: string) => void;
  showToast: (message: string, kind?: Toast["kind"]) => void;
}

export function TableSidePanel({
  me,
  topCardLabel,
  phase,
  roster,
  cardBackTheme,
  onSetCardBackTheme,
  showToast,
}: TableSidePanelProps) {
  return (
    <aside className="side-panel">
      <div className="status-card status-card-row">
        {me && (
          <div className="avatar-wrapper-pill" style={{ position: "relative" }}>
            <AvatarIcon symbol={me.symbol} theme={me.theme} size={40} glow />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span>Seat Allocation</span>
          <strong>{me ? `${me.displayName} (Seat ${me.seatIndex + 1})` : "Spectator"}</strong>
          <small>{me?.spectatorCount ?? 0} Watching table</small>
        </div>
      </div>

      <div className="status-card">
        <span>Active Discard</span>
        <strong>{topCardLabel}</strong>
        <small>{phase ?? "Awaiting"}</small>
      </div>

      <div className="roster-card">
        <span>Opponent Cards</span>
        <div className="roster-list">
          {roster.length === 0 ? (
            <p style={{ color: "var(--text-faint)" }}>Awaiting players...</p>
          ) : (
            roster.map((player) => (
              <div
                className="roster-row"
                key={player.sessionId}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <AvatarIcon symbol={player.symbol} theme={player.theme} size={28} glow={player.active} />
                <div className="roster-row-info" style={{ flex: 1 }}>
                  <strong>{player.displayName}</strong>
                  <span>{player.isBot ? "Bot" : "Opponent"}</span>
                </div>
                <div className={`roster-card-count opponent-card-gauge ${getCardCountClass(player.cardCount)}`}>
                  {player.cardCount}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="roster-card skin-picker-card">
        <span>Card Back Skin</span>
        <div className="skin-picker-grid">
          <button
            className={`skin-picker-btn classic ${cardBackTheme === "classic" ? "active" : ""}`}
            onClick={() => {
              onSetCardBackTheme("classic");
              showToast("Card back skin changed to Classic Crimson", "success");
            }}
            type="button"
          >
            <div className="skin-preview-thumb classic" />
            <span>Classic</span>
          </button>
          <button
            className={`skin-picker-btn cyber ${cardBackTheme === "cyber" ? "active" : ""}`}
            onClick={() => {
              onSetCardBackTheme("cyber");
              showToast("Card back skin changed to Cyber Gold", "success");
            }}
            type="button"
          >
            <div className="skin-preview-thumb cyber" />
            <span>Cyber</span>
          </button>
          <button
            className={`skin-picker-btn cosmic ${cardBackTheme === "cosmic" ? "active" : ""}`}
            onClick={() => {
              onSetCardBackTheme("cosmic");
              showToast("Card back skin changed to Cosmic Nebula", "success");
            }}
            type="button"
          >
            <div className="skin-preview-thumb cosmic" />
            <span>Cosmic</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
