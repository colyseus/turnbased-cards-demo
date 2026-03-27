import "./index.css";
import { Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { Game, GameHud } from "./components/Game";
import { TextureProvider } from "./components/Preloader";
import { client, RoomProvider, useRoom } from "./colyseus";

function Lobby({ onJoined }: { onJoined: (connect: () => Promise<any>) => void }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleQuickPlay = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || "Player";
    onJoined(() => client.joinOrCreate("uno", { name: trimmed }));
  };

  const handleJoinByCode = () => {
    if (!roomCode.trim()) return;
    const trimmed = name.trim() || "Player";
    onJoined(() => client.joinById(roomCode.trim(), { name: trimmed }));
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
          />
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
          <button
            className="lobby-btn lobby-join-btn"
            onClick={handleJoinByCode}
            disabled={!roomCode.trim()}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}

function GameContent({ onDisconnect }: { onDisconnect: () => void }) {
  const { room, error, isConnecting } = useRoom();

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
          <p className="lobby-subtitle">Connecting...</p>
        </div>
      </div>
    );
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

function App() {
  const [connectFn, setConnectFn] = useState<(() => Promise<any>) | null>(null);

  if (!connectFn) {
    return <Lobby onJoined={(fn) => setConnectFn(() => fn)} />;
  }

  return (
    <RoomProvider connect={connectFn}>
      <GameContent onDisconnect={() => setConnectFn(null)} />
    </RoomProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
