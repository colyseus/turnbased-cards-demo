import type { CSSProperties } from "react";
import { useState } from "react";
import { sfx } from "../audio/sfx";
import { AvatarIcon } from "./AvatarIcon";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { StatsDashboard } from "./StatsDashboard";
import { LobbyShell } from "./LobbyShell";
import { AVATAR_SYMBOLS, AVATAR_THEMES, ATLAS_ORDER } from "../tableConfig";
import { parsePlayerName } from "../gameHelpers";
import { readStorage, writeStorage } from "../storage";

interface LobbyProps {
  busy: boolean;
  error: string;
  onQuickPlay: (options: Record<string, unknown>) => void;
  onJoinCode: (roomId: string, options: Record<string, unknown>) => void;
  onWatch: (roomId: string) => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
}

export function Lobby({
  busy,
  error,
  onQuickPlay,
  onJoinCode,
  onWatch,
  colorblindMode,
  onToggleColorblind,
}: LobbyProps) {
  const [name, setName] = useState(() => {
    const raw = readStorage("uno_nickname") || "";
    return parsePlayerName(raw).name;
  });
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [avatarSymbol, setAvatarSymbol] = useState(() => readStorage("uno_av_symbol") || "tiger");
  const [avatarTheme, setAvatarTheme] = useState(() => readStorage("uno_av_theme") || "rose");

  const trimmedName = name.trim();
  const validName = trimmedName.length >= 2 && trimmedName.length <= 16;

  const handleStart = (action: (options: Record<string, unknown>) => void) => {
    writeStorage("uno_av_symbol", avatarSymbol);
    writeStorage("uno_av_theme", avatarTheme);
    writeStorage("uno_nickname", trimmedName);

    const serializedName = `[av-${avatarSymbol}-${avatarTheme}]${trimmedName}`;
    action({
      name: serializedName,
      private: privateRoom,
      difficulty,
      password: password || undefined,
    });
  };

  return (
    <LobbyShell>
      <section className="brand-panel" aria-label="Wild Table preview">
        <div className="table-sculpture">
          <div className="table-rail" />
          <div className="table-felt-mini" />
          <div className="lobby-hero-hand">
            {["red", "blue", "yellow", "green", "wild"].map((color, index) => {
              const fileKey = color === "wild" ? "wild" : `${color}_5`;
              const tileIdx = ATLAS_ORDER.indexOf(fileKey);
              const col = tileIdx !== -1 ? tileIdx % 10 : 52;
              const row = tileIdx !== -1 ? Math.floor(tileIdx / 10) : 5;
              return (
                <div
                  key={color}
                  className="lobby-hero-card card-sprite"
                  style={
                    {
                      "--i": index,
                      "--col": col,
                      "--row": row,
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        </div>
        <div className="brand-copy" style={{ zIndex: 10 }}>
          <h1>Wild Table</h1>
          <p>
            An elegant, high-fidelity real-time card table. Seamless turns, live spectators, and
            smooth glassmorphic interfaces.
          </p>
        </div>
      </section>

      <section className="join-panel" aria-label="Join game">
        <div className="panel-header">
          <span>Multiplayer Table</span>
          <strong>
            {busy ? (
              <span className="connecting-spinner">
                <span className="spinner-ring" /> Connecting...
              </span>
            ) : (
              "Ready"
            )}
          </strong>
        </div>

        <label className="field">
          <span>Player nickname</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            maxLength={16}
            autoFocus
          />
        </label>

        <div className="avatar-creator-panel">
          <span>Customize Avatar</span>
          <div className="avatar-creator-layout">
            <AvatarIcon symbol={avatarSymbol} theme={avatarTheme} size={64} glow />
            <div className="avatar-creator-picker-column">
              <div className="avatar-grid-picker">
                {AVATAR_SYMBOLS.map((sym) => (
                  <button
                    key={sym.id}
                    className={`avatar-picker-btn ${avatarSymbol === sym.id ? "active" : ""}`}
                    onClick={() => {
                      setAvatarSymbol(sym.id);
                      sfx.playPluck();
                    }}
                    type="button"
                    title={sym.name}
                  >
                    {sym.emoji}
                  </button>
                ))}
              </div>
              <div className="theme-grid-picker">
                {AVATAR_THEMES.map((th) => (
                  <button
                    key={th.id}
                    className={`theme-picker-btn ${avatarTheme === th.id ? "active" : ""}`}
                    style={{ "--theme-color-highlight": th.primary } as CSSProperties}
                    onClick={() => {
                      setAvatarTheme(th.id);
                      sfx.playPluck();
                    }}
                    type="button"
                  >
                    {th.name.split(" ")[1]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="field">
          <span>Match options</span>
          <div className="control-row">
            <button
              className={privateRoom ? "chip active" : "chip"}
              onClick={() => setPrivateRoom((value) => !value)}
              type="button"
            >
              Private: {privateRoom ? "On" : "Off"}
            </button>
            {(["easy", "medium", "hard"] as const).map((level) => (
              <button
                key={level}
                className={difficulty === level ? "chip active" : "chip"}
                onClick={() => setDifficulty(level)}
                type="button"
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {privateRoom && (
          <label className="field">
            <span>Room password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Optional table password"
              type="password"
              maxLength={32}
            />
          </label>
        )}

        <button
          className={`primary-btn ${busy ? "loading" : ""}`}
          disabled={!validName || busy}
          onClick={() => handleStart(onQuickPlay)}
          type="button"
        >
          {busy ? "Connecting..." : "Create Table"}
        </button>

        <div className="join-grid">
          <label className="field compact">
            <span>Invite code</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="Room Code"
            />
          </label>
          <button
            className="secondary-btn"
            disabled={!roomCode.trim() || !validName || busy}
            onClick={() => handleStart((opts) => onJoinCode(roomCode.trim(), opts))}
            type="button"
          >
            Enter
          </button>
          <button
            className="secondary-btn"
            disabled={!roomCode.trim() || busy}
            onClick={() => onWatch(roomCode.trim())}
            type="button"
          >
            Watch
          </button>
        </div>

        <div style={{ marginTop: "8px" }}>
          <StatsDashboard />
        </div>

        <div className="lobby-actions-row">
          <AudioSettingsPanel />
          <button
            className={`accessibility-toggle-btn ${colorblindMode ? "active" : ""}`}
            onClick={onToggleColorblind}
            type="button"
          >
            ♿ Colorblind Mode: {colorblindMode ? "On" : "Off"}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>
    </LobbyShell>
  );
}
