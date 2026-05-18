import "./index.css";
import { Suspense, useState, lazy, useRef } from "react";
import { createRoot } from "react-dom/client";
import { client, RoomProvider, useRoom, watchRoom } from "./colyseus";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getLeaderboard } from "./stats";

// Lazy-load the 3D game canvas so three.js is not in the initial bundle
const GameScene = lazy(() => import("./components/GameScene"));
const StressTestScene = lazy(() => import("./components/StressTestScene"));

function Preloader() {
  return (
    <div className="preloader">
      <div className="preloader-spinner" />
      <span className="preloader-text">Loading…</span>
    </div>
  );
}

function Lobby({ onJoined }: { onJoined: (_connect: () => Promise<any>) => void }) { // eslint-disable-line no-unused-vars, @typescript-eslint/no-explicit-any
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [nameError, setNameError] = useState("");
  const [mode, setMode] = useState<"play" | "watch">("play");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [password, setPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showStats, setShowStats] = useState(false);

  const validateName = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "Name cannot be empty.";
    if (trimmed.length < 2) return "Name must be at least 2 characters.";
    if (trimmed.length > 16) return "Name must be 16 characters or fewer.";
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(trimmed)) return "Name can only contain letters, numbers, spaces, hyphens, and underscores.";
    return "";
  };

  const handleQuickPlay = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateName(name);
    if (error) { setNameError(error); return; }
    setNameError("");
    const trimmed = name.trim();
    onJoined(() => client.joinOrCreate("uno", { name: trimmed, private: privateRoom, difficulty, password: password || undefined }));
  };

  const handleJoinByCode = () => {
    if (!roomCode.trim()) return;
    const error = validateName(name);
    if (error) { setNameError(error); return; }
    setNameError("");
    const trimmed = name.trim();
    onJoined(() => client.joinById(roomCode.trim(), { name: trimmed, password: joinPassword || undefined }));
  };

  const handleWatch = () => {
    if (!roomCode.trim()) return;
    onJoined(() => watchRoom(roomCode.trim()));
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-header">
          <h1 className="lobby-title">Card Game</h1>
          <div 
            className="lobby-hero-card" 
            style={{ backgroundImage: `url('${import.meta.env.BASE_URL}cards/atlas.webp?v=${Date.now()}')` }}
          />
        </div>
        <p className="lobby-subtitle">Colyseus Demo</p>

        <div className="lobby-tabs">
          <button
            className={`lobby-tab ${mode === "play" ? "lobby-tab-active" : ""}`}
            onClick={() => setMode("play")}
          >
            Play
          </button>
          <button
            className={`lobby-tab ${mode === "watch" ? "lobby-tab-active" : ""}`}
            onClick={() => setMode("watch")}
          >
            Watch
          </button>
        </div>

        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <button
            className="hud-btn"
            title="Leaderboard"
            aria-label="Leaderboard"
            onClick={() => setShowStats(true)}
            style={{ width: 34, height: 34, fontSize: 16 }}
          >
            🏆
          </button>
        </div>

        {mode === "play" ? (
          <>
            <form onSubmit={handleQuickPlay} className="lobby-form">
              <input
                className="lobby-input"
                type="text"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                maxLength={16}
                autoFocus
              />
              {nameError && <p className="lobby-error">{nameError}</p>}
              <div className="option-row" style={{ width: "100%", justifyContent: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Private room</span>
                <button
                  className={`toggle-btn${privateRoom ? " on" : ""}`}
                  onClick={() => setPrivateRoom((v) => !v)}
                  type="button"
                >
                  {privateRoom ? "ON" : "OFF"}
                </button>
              </div>
              {privateRoom && (
                <input
                  className="lobby-input"
                  type="password"
                  placeholder="Room password (optional)..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={32}
                  style={{ width: 220, fontSize: 14, padding: "10px 16px" }}
                />
              )}
              <div className="option-row" style={{ width: "100%", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Bot difficulty</span>
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    className={`toggle-btn${difficulty === d ? " on" : ""}`}
                    onClick={() => setDifficulty(d)}
                    type="button"
                    style={{ fontSize: 11, padding: "3px 10px" }}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              <button className="lobby-btn" type="submit">
                Quick Play
              </button>
            </form>
            <div className="lobby-divider">or join by code</div>
            <div className="lobby-join-code">
              <input
                className="lobby-input lobby-code-input"
                type="text"
                placeholder="Room code..."
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
              <input
                className="lobby-input lobby-code-input"
                type="password"
                placeholder="Password..."
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                style={{ width: 120 }}
              />
              <button
                className="lobby-btn lobby-join-btn"
                onClick={handleJoinByCode}
                disabled={!roomCode.trim()}
              >
                Join
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="lobby-join-code">
              <input
                className="lobby-input lobby-code-input"
                type="text"
                placeholder="Room code..."
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                autoFocus
              />
              <button
                className="lobby-btn lobby-join-btn"
                onClick={handleWatch}
                disabled={!roomCode.trim()}
              >
                Watch
              </button>
            </div>
            <p className="lobby-subtitle" style={{ fontSize: 12, marginTop: 8 }}>
              Watch a game in progress without joining a seat.
            </p>
          </>
        )}
      </div>
      {showStats && <StatsOverlay onClose={() => setShowStats(false)} />}
    </div>
  );
}

function StatsOverlay({ onClose }: { onClose: () => void }) {
  const leaderboard = getLeaderboard();
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-header">
          <h2>Leaderboard</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body">
          {leaderboard.length === 0 ? (
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              No games played yet.
            </p>
          ) : (
            <table style={{ width: "100%", fontSize: 13, color: "rgba(255,255,255,0.8)", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#ffcc00", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px" }}>Player</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>Wins</th>
                  <th style={{ textAlign: "center", padding: "4px 8px" }}>Played</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(({ name, stats }) => (
                  <tr key={name} style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{name}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px", color: "#ffcc00" }}>{stats.wins}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px" }}>{stats.gamesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function GameContent({ onDisconnect }: { onDisconnect: () => void }) {
  const { room, error, isConnecting } = useRoom();
  const wasConnected = useRef(false);
  if (room && !isConnecting) wasConnected.current = true;

  if (error) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <p className="lobby-error">{error.message || "Failed to connect"}</p>
          <button className="lobby-btn" onClick={onDisconnect}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting || !room) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          {wasConnected.current ? (
            <p className="lobby-subtitle">Reconnecting…</p>
          ) : (
            <p className="lobby-subtitle">Connecting…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Preloader />}>
      <GameScene />
    </Suspense>
  );
}

function App() {
  const [connectFn, setConnectFn] = useState<(() => Promise<any>) | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showStressTest, setShowStressTest] = useState(false);

  if (showStressTest) {
    return (
      <Suspense fallback={<Preloader />}>
        <StressTestScene onBack={() => setShowStressTest(false)} />
      </Suspense>
    );
  }

  if (!connectFn) {
    return (
      <>
        <Lobby onJoined={(fn) => setConnectFn(() => fn)} />
        <button 
          className="devtools-trigger" 
          style={{ bottom: 12, left: 12, right: 'auto' }}
          onClick={() => setShowStressTest(true)}
        >
          STRESS TEST
        </button>
      </>
    );
  }

  return (
    <RoomProvider connect={connectFn}>
      <ErrorBoundary onReset={() => setConnectFn(null)}>
        <GameContent onDisconnect={() => setConnectFn(null)} />
      </ErrorBoundary>
    </RoomProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for offline caching
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failed — silently ignore (e.g., in dev mode)
    });
  });
}
