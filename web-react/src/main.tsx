import "./index.css";
import { Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { Game, GameHud } from "./components/Game";
import { TextureProvider } from "./components/Preloader";
import { joinOrCreate, joinById } from "./colyseus";

function Lobby({ onJoined }: { onJoined: () => void }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleQuickPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setError("");
    try {
      const trimmed = name.trim() || "Player";
      await joinOrCreate("uno", { name: trimmed });
      onJoined();
    } catch (err: any) {
      setError(err.message || "Failed to connect");
      setJoining(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!roomCode.trim()) return;
    setJoining(true);
    setError("");
    try {
      const trimmed = name.trim() || "Player";
      await joinById(roomCode.trim(), { name: trimmed });
      onJoined();
    } catch (err: any) {
      setError(err.message || "Failed to join room");
      setJoining(false);
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-header">
          <h1 className="lobby-title">Card Game</h1>
          <img
            src={`${import.meta.env.BASE_URL}cards/wild_draw4.png`}
            alt=""
            className="lobby-hero-card"
          />
        </div>
        <p className="lobby-subtitle">Colyseus Demo</p>
        <form onSubmit={handleQuickPlay} className="lobby-form">
          <input
            className="lobby-input"
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoFocus
            disabled={joining}
          />
          <button className="lobby-btn" type="submit" disabled={joining}>
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
            disabled={joining}
          />
          <button
            className="lobby-btn lobby-join-btn"
            onClick={handleJoinByCode}
            disabled={joining || !roomCode.trim()}
          >
            Join
          </button>
        </div>
        {error && <p className="lobby-error">{error}</p>}
      </div>
    </div>
  );
}

function App() {
  const [playing, setPlaying] = useState(false);

  if (!playing) {
    return <Lobby onJoined={() => setPlaying(true)} />;
  }

  return (
    <>
      <Canvas camera={{ position: [0, -0.5, 10], fov: 50 }}>
        <ambientLight intensity={2.5} />
        <directionalLight position={[0, 2, 10]} intensity={1.5} />
        <Suspense fallback={null}>
          <TextureProvider>
            <Game />
          </TextureProvider>
        </Suspense>
      </Canvas>
      <GameHud />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
