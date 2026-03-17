import "./index.css";
import { Suspense, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { Game, GameHud, setPlayerName } from "./components/Game";
import { TextureProvider } from "./components/Preloader";

function Lobby({ onPlay }: { onPlay: (name: string) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || 'Player';
    onPlay(trimmed);
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-header">
          <h1 className="lobby-title">Card Game</h1>
          <img src={`${import.meta.env.BASE_URL}cards/wild_draw4.png`} alt="" className="lobby-hero-card" />
        </div>
        <p className="lobby-subtitle">Colyseus Demo</p>
        <form onSubmit={handleSubmit} className="lobby-form">
          <input
            className="lobby-input"
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={16}
            autoFocus
          />
          <button className="lobby-btn" type="submit">
            Play Game
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [playing, setPlaying] = useState(false);

  const handlePlay = useCallback((name: string) => {
    setPlayerName(name);
    setPlaying(true);
  }, []);

  if (!playing) {
    return <Lobby onPlay={handlePlay} />;
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

createRoot(document.getElementById('root')!).render(<App />);
