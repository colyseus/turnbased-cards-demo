import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { InstancedCards, CardData } from "./game/InstancedCards";
import { Table } from "./game/Table";
import { ColorPicker } from "./game/ColorPicker";
import { DevToolsLogic, DevToolsProvider, DevToolsUI, useDevTools } from "./DevTools";
import { TextureProvider } from "./Preloader";
import { autoPlayGame, UnoColor } from "../../../server/shared/uno";

type AutoPlayStatus = "idle" | "running" | "complete" | "limit";

interface AutoPlaySummary {
  status: AutoPlayStatus;
  turns: number;
  winner: number | null;
}

function StressTestCards() {
  const { stressTestCount } = useDevTools();
  
  const cards = useMemo(() => {
    const list: CardData[] = [];
    const count = Math.max(stressTestCount, 500); // minimum 500 for the "stress" feel
    const textureIds = ["red_0", "red_1", "red_2", "blue_0", "blue_1", "blue_2", "green_0", "green_1", "green_2", "yellow_0", "yellow_1", "yellow_2", "back"];

    for (let i = 0; i < count; i++) {
      list.push({
        id: `stress-${i}`,
        textureId: textureIds[i % textureIds.length],
        position: [0, 0, 0], // will be updated in frame
        rotationZ: 0,
        faceUp: true,
        scale: 0.5,
      });
    }
    return list;
  }, [stressTestCount]);

  // Procedural movement logic for stress test
  const cardDataRef = useRef(cards);
  cardDataRef.current = cards;

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    cardDataRef.current.forEach((card, i) => {
      const angle = (i / cardDataRef.current.length) * Math.PI * 2 + time * 0.2;
      const r = 3 + Math.sin(time * 0.5 + i * 0.1) * 2;
      card.position[0] = Math.cos(angle) * r;
      card.position[1] = Math.sin(angle) * r;
      card.position[2] = Math.sin(time + i * 0.05) * 0.5;
      card.rotationZ = angle + Math.PI / 2;
    });
  });

  return <InstancedCards cards={cards} />;
}

function StressTestSceneInner({ onBack }: { onBack: () => void }) {
  const showColorPicker = new window.URLSearchParams(window.location.search).get("colorPicker") === "1";
  const [hoveredPickerColor, setHoveredPickerColor] = useState<UnoColor | null>("yellow");
  const [autoPlaySummary, setAutoPlaySummary] = useState<AutoPlaySummary>({
    status: "idle",
    turns: 0,
    winner: null,
  });

  const runAutoPlay = () => {
    setAutoPlaySummary({ status: "running", turns: 0, winner: null });
    window.setTimeout(() => {
      const result = autoPlayGame(undefined, { maxTurns: 1000 });
      setAutoPlaySummary({
        status: result.completed ? "complete" : "limit",
        turns: result.turnsPlayed,
        winner: result.winner,
      });
    }, 0);
  };

  return (
    <>
      <div className="stress-test-overlay" data-autoplay-status={autoPlaySummary.status}>
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back to Lobby
        </button>
        <div className="stress-test-title">Stress Test Scene</div>
        <button className="hud-btn autoplay-btn" onClick={runAutoPlay}>
          Auto-Play Game
        </button>
        <div className="stress-test-summary" aria-live="polite">
          {autoPlaySummary.status === "idle" && "Auto-play ready"}
          {autoPlaySummary.status === "running" && "Auto-play running"}
          {autoPlaySummary.status === "complete" &&
            `Winner P${autoPlaySummary.winner! + 1} in ${autoPlaySummary.turns} turns`}
          {autoPlaySummary.status === "limit" &&
            `Turn limit reached after ${autoPlaySummary.turns} turns`}
        </div>
      </div>

      <Canvas
        camera={{ position: [0, -2, 12], fov: 45 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={2.0} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <DevToolsLogic />
        <TextureProvider>
          <Table />
          {!showColorPicker && <StressTestCards />}
          {showColorPicker && (
            <ColorPicker
              hoveredPickerColor={hoveredPickerColor}
              onPickColor={setHoveredPickerColor}
              onHoverColor={setHoveredPickerColor}
            />
          )}
        </TextureProvider>
      </Canvas>

      <DevToolsUI />
    </>
  );
}

export default function StressTestScene(props: { onBack: () => void }) {
  return (
    <DevToolsProvider>
      <StressTestSceneInner {...props} />
    </DevToolsProvider>
  );
}
