import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { Game } from "./Game";
import { GameHud } from "./game/GameHud";
import { TextureProvider } from "./Preloader";
import { DevToolsProvider, DevToolsLogic, DevToolsUI } from "./DevTools";
import { LongPressCard } from "./LongPressCard";

export interface LastPlayedInfo {
  cardId: string;
  playerName: string;
  textureId: string;
}

interface LongPressInfo {
  textureId: string;
}

const SHAKE_DURATION_MS = 400;
const SHAKE_INTENSITY = 0.08;

function CameraShake({ shakeStart }: { shakeStart: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const origPos = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame(() => {
    if (!initialized.current) {
      origPos.current.copy(camera.position);
      initialized.current = true;
    }
    const elapsed = Date.now() - shakeStart.current;
    if (elapsed < SHAKE_DURATION_MS) {
      const progress = elapsed / SHAKE_DURATION_MS;
      const intensity = SHAKE_INTENSITY * (1 - progress);
      camera.position.x = origPos.current.x + (Math.random() - 0.5) * 2 * intensity;
      camera.position.y = origPos.current.y + (Math.random() - 0.5) * 2 * intensity;
    } else if (initialized.current) {
      camera.position.x = origPos.current.x;
      camera.position.y = origPos.current.y;
    }
  });

  return null;
}

export type QualityLevel = "low" | "medium" | "high";

const QUALITY_PRESETS: Record<QualityLevel, { dpr: number | [number, number]; antialias: boolean }> = {
  low: { dpr: 1, antialias: false },
  medium: { dpr: 1.5, antialias: true },
  high: { dpr: [1, 2], antialias: true },
};

export default function GameScene() {
  const [sortByColor, setSortByColor] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>("medium");
  const [lastPlayed, setLastPlayed] = useState<LastPlayedInfo | null>(null);
  const [longPressCard, setLongPressCard] = useState<LongPressInfo | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(-1);
  const shakeStart = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const SWIPE_THRESHOLD = 50;

  const triggerShake = useCallback(() => {
    shakeStart.current = Date.now();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case "m":
          setSoundEnabled((v) => !v);
          break;
        case "s":
          setSortByColor((v) => !v);
          break;
        case "q":
          setQualityLevel((v) => (v === "low" ? "medium" : v === "medium" ? "high" : "low"));
          break;
        case "f":
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        case "?":
        case "/":
          setShowRules((v) => !v);
          break;
        case "c":
          setShowChat((v) => !v);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Swipe gestures for mobile card navigation
  useEffect(() => {
    function onTouchStart(e: globalThis.TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
    function onTouchEnd(e: globalThis.TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

      // Dispatch arrow key events for swipe
      const event = new KeyboardEvent("keydown", {
        key: dx > 0 ? "ArrowRight" : "ArrowLeft",
        bubbles: true,
      });
      window.dispatchEvent(event);
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <DevToolsProvider>
      <Canvas
        camera={{ position: [0, -0.5, 10], fov: 50 }}
        dpr={QUALITY_PRESETS[qualityLevel].dpr}
        gl={{ antialias: QUALITY_PRESETS[qualityLevel].antialias, alpha: false, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={2.5} />
        <directionalLight position={[0, 2, 10]} intensity={1.5} />
        <CameraShake shakeStart={shakeStart} />
        <DevToolsLogic />
        <TextureProvider>
          <Game
            sortByColor={sortByColor}
            qualityLevel={qualityLevel}
            onLastPlayed={setLastPlayed}
            onShake={triggerShake}
            onLongPress={(textureId) => setLongPressCard({ textureId })}
            selectedCardIndex={selectedCardIndex}
            onSelectCard={setSelectedCardIndex}
          />
        </TextureProvider>
      </Canvas>
      <DevToolsUI />
      {longPressCard && (
        <LongPressCard
          textureId={longPressCard.textureId}
          onClose={() => setLongPressCard(null)}
        />
      )}
      <GameHud
        sortByColor={sortByColor}
        onSortToggle={() => setSortByColor((v) => !v)}
        showRules={showRules}
        onShowRules={() => setShowRules(true)}
        onCloseRules={() => setShowRules(false)}
        showOptions={showOptions}
        onShowOptions={() => setShowOptions(true)}
        onCloseOptions={() => setShowOptions(false)}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled((v) => !v)}
        qualityLevel={qualityLevel}
        onQualityToggle={() => setQualityLevel((v) => (v === "low" ? "medium" : v === "medium" ? "high" : "low"))}
        lastPlayed={lastPlayed}
        showChat={showChat}
        onShowChat={() => setShowChat(true)}
        onCloseChat={() => setShowChat(false)}
        />
        </DevToolsProvider>
        );
        }
