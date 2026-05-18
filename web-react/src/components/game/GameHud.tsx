import { lazy, Suspense } from "react";
import { useRoom, useRoomState } from "../../colyseus";
import { LastPlayedInfo } from "../GameScene";
import { PlayerSchema } from "../../types";

// Lazy-load heavy overlays from current flat directory
const RulesOverlay = lazy(() => import("./RulesOverlay"));
const OptionsOverlay = lazy(() => import("./OptionsOverlay"));
const ChatOverlay = lazy(() => import("./ChatOverlay"));
const RematchOverlay = lazy(() => import("./RematchOverlay"));

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
    ? (Object.values(state.players) as PlayerSchema[]).find((p) => p.sessionId === room.sessionId) ?? null
    : null;

  return (
    <div className="game-hud" style={{ pointerEvents: "none" }}>
      {/* Top Left: Room Info */}
      <div className="hud-top-left" style={{ pointerEvents: "auto" }}>
        <div className="room-code">ROOM: {room?.roomId || "..." }</div>
        <div className="spectator-count">
          {state.spectatorCount} {state.spectatorCount === 1 ? "spectator" : "spectators"}
        </div>
      </div>

      {/* Top Right: Actions */}
      <div className="hud-actions" style={{ pointerEvents: "auto" }}>
        <button className="hud-btn" aria-label={sortByColor ? "Sort by color" : "Sort by number"} title="Sort hand" onClick={onSortToggle}>
          {sortByColor ? "🎨" : "🔢"}
        </button>
        <button className="hud-btn" aria-label={`Quality: ${qualityLevel}`} title="Quality" onClick={onQualityToggle}>
          {qualityLevel === "low" ? "🌑" : qualityLevel === "medium" ? "🌓" : "🌕"}
        </button>
        <button className="hud-btn" aria-label={soundEnabled ? "Mute sound" : "Enable sound"} title="Sound" onClick={onSoundToggle}>
          {soundEnabled ? "🔊" : "🔇"}
        </button>
        <button className="hud-btn" aria-label="Show rules" title="Rules" onClick={onShowRules}>
          ❓
        </button>
        <button className="hud-btn" aria-label="Settings" title="Settings" onClick={onShowOptions}>
          ⚙️
        </button>
        <button className="hud-btn" aria-label="Show chat" title="Chat" onClick={onShowChat}>
          💬
        </button>
      </div>

      {/* Bottom Center: Last Played Info */}
      {lastPlayed && (
        <div className="last-played-info">
          <span className="player-name">{lastPlayed.playerName}</span> played{" "}
          <span className="card-name">{lastPlayed.cardId.replace("_", " ")}</span>
        </div>
      )}

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
        {state.phase === "finished" && (
            <div className="rematch-container" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1000, pointerEvents: "auto" }}>
                <RematchOverlay />
            </div>
        )}
      </Suspense>
    </div>
  );
}
