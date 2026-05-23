import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import { InstancedCards, CardData } from "./game/InstancedCards";
import { Table } from "./game/Table";
import { DevToolsLogic, DevToolsProvider, DevToolsUI, useDevTools } from "./DevTools";
import { TextureProvider } from "./Preloader";
import { client, RoomProvider, useRoom, useRoomState } from "../colyseus";
import type { Room } from "@colyseus/sdk";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DemoCardSchema {
  id: string;
  cardType: string;
  color: string;
  value: string;
  chosenColor: string;
}

interface DemoPlayerSchema {
  sessionId: string;
  seatIndex: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  hand: DemoCardSchema[];
  handCount: number;
}

interface TurnHistoryEntry {
  turn: number;
  player: number;
  action: string;
  cardId: string;
  chosenColor: string;
  timestamp: number;
  handCounts: number[];
}

interface DemoPlayback {
  phase: "idle" | "running" | "paused" | "finished";
  tickMs: number;
  turnCount: number;
  winner: number;
}

interface DemoRoomState {
  players: Record<string, DemoPlayerSchema>;
  discardPile: DemoCardSchema[];
  drawPileCount: number;
  currentPlayer: number;
  direction: number;
  activeColor: string;
  pendingDraw: number;
  winner: number;
  phase: string;
  demo: DemoPlayback;
  turnHistory: TurnHistoryEntry[];
}

const SPEED_OPTIONS: { label: string; tickMs: number }[] = [
  { label: "0.25×", tickMs: 4000 },
  { label: "0.5×", tickMs: 2000 },
  { label: "1×", tickMs: 1000 },
  { label: "2×", tickMs: 500 },
  { label: "4×", tickMs: 250 },
];

// ─── Stress-mode cards (original orbiting visualization) ───────────────────────

function StressTestCardsInner() {
  const { stressTestCount } = useDevTools();
  const textureIds = [
    "red_0", "red_1", "red_2",
    "blue_0", "blue_1", "blue_2",
    "green_0", "green_1", "green_2",
    "yellow_0", "yellow_1", "yellow_2",
    "back",
  ];

  const cards = useMemo<CardData[]>(() => {
    const count = Math.max(stressTestCount, 500);
    return Array.from({ length: count }, (_, i) => ({
      id: `stress-${i}`,
      textureId: textureIds[i % textureIds.length],
      position: [0, 0, 0] as [number, number, number],
      rotationZ: 0,
      faceUp: true,
      scale: 0.5,
    }));
  }, [stressTestCount]);

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

// ─── Demo-mode cards (render game state from Colyseus room) ───────────────────

function buildTextureId(card: DemoCardSchema): string {
  if (card.cardType === "wild") return card.value;
  return `${card.color}_${card.value}`;
}

function DemoCards({ state }: { state: DemoRoomState }) {
  const cards = useMemo<CardData[]>(() => {
    const result: CardData[] = [];

    // Discard pile: show up to 5 recent cards stacked at center
    const discard = state.discardPile ?? [];
    const showDiscard = discard.slice(-5);
    showDiscard.forEach((card, i) => {
      result.push({
        id: `discard-${card.id}-${i}`,
        textureId: buildTextureId(card),
        position: [i * 0.05, i * 0.05, i * 0.02],
        rotationZ: 0,
        faceUp: true,
        scale: 0.55,
      });
    });

    // Player 0 (local demo player) hand — face up, fanned in front of table
    const localPlayer = state.players?.["0"];
    if (localPlayer?.hand) {
      const handSize = localPlayer.hand.length;
      localPlayer.hand.forEach((card, i) => {
        const t = handSize <= 1 ? 0.5 : i / (handSize - 1);
        const angle = (t - 0.5) * 1.2;
        const r = 2.8;
        result.push({
          id: `p0-${card.id}`,
          textureId: buildTextureId(card),
          position: [Math.sin(angle) * r, -Math.cos(angle) * r * 0.5 - 1.5, 0.1 + i * 0.001],
          rotationZ: angle * 0.3,
          faceUp: true,
          scale: 0.5,
        });
      });
    }

    // Other players: show face-down card-backs stacked near their seat positions
    const seatOffsets: Record<string, [number, number, number]> = {
      "1": [-5, 0, 0],
      "2": [0, 5, 0],
      "3": [5, 0, 0],
    };
    for (let p = 1; p <= 3; p++) {
      const player = state.players?.[String(p)];
      const count = player?.handCount ?? 0;
      const [ox, oy, oz] = seatOffsets[String(p)];
      for (let i = 0; i < Math.min(count, 7); i++) {
        result.push({
          id: `p${p}-hidden-${i}`,
          textureId: "back",
          position: [ox + i * 0.01, oy + i * 0.01, oz + i * 0.005],
          rotationZ: 0,
          faceUp: false,
          scale: 0.5,
        });
      }
    }

    return result;
  }, [state]);

  return <InstancedCards cards={cards} />;
}

// ─── Debug metrics panel ───────────────────────────────────────────────────────

function DebugPanel({ state }: { state: DemoRoomState }) {
  const history = useMemo(() => {
    return (state.turnHistory ?? []).slice(-20);
  }, [state.turnHistory]);

  const handCounts = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => state.players?.[String(i)]?.handCount ?? 0);
  }, [state.players]);

  const activeColor = state.activeColor ?? "red";

  return (
    <div className="debug-panel">
      <div className="debug-section-title">Turn History</div>
      {history.map((entry, idx) => (
        <div key={idx} className="turn-entry">
          <span className="turn-num">T{String(entry.turn).padStart(3, "0")}</span>
          <span className="player-badge">P{entry.player}</span>
          <span className="action-text">
            {entry.action}
            {entry.cardId && `:${entry.cardId}`}
            {entry.chosenColor && ` (${entry.chosenColor})`}
          </span>
        </div>
      ))}
      {history.length === 0 && <div className="turn-entry">No turns yet</div>}

      <div className="debug-section-title" style={{ marginTop: 10 }}>
        Hands — P0:{handCounts[0]} P1:{handCounts[1]} P2:{handCounts[2]} P3:{handCounts[3]}
      </div>
      <div style={{ marginTop: 4, display: "flex", gap: 12, alignItems: "center" }}>
        <span
          className="color-dot"
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: activeColor,
            verticalAlign: "middle",
          }}
        />
        <span>Active: {activeColor}</span>
        <span>Dir: {state.direction > 0 ? "CW" : "CCW"}</span>
      </div>
    </div>
  );
}

// ─── Playback controls overlay ───────────────────────────────────────────────

function PlaybackControls({
  room,
  state,
  onBack,
}: {
  room: Room;
  state: DemoRoomState;
  onBack: () => void;
}) {
  const [activeSpeed, setActiveSpeed] = useState(1000);

  const phase = state.demo?.phase ?? "idle";

  const handleSpeed = useCallback(
    (tickMs: number) => {
      setActiveSpeed(tickMs);
      room.send("set_speed", { tickMs });
    },
    [room],
  );

  const phaseLabel =
    phase === "idle"
      ? "Waiting to start"
      : phase === "running"
      ? `Running — T${state.demo?.turnCount ?? 0}`
      : phase === "paused"
      ? `Paused — T${state.demo?.turnCount ?? 0}`
      : `Finished — P${state.demo?.winner ?? "?"} won`;

  return (
    <>
      <div className="stress-test-overlay" data-phase={phase}>
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back
        </button>

        <div className="stress-test-title">Demo Room</div>

        <div className="playback-controls">
          {(phase === "idle" || phase === "finished") && (
            <button className="hud-btn autoplay-btn" onClick={() => room.send("start")}>
              Start
            </button>
          )}
          {phase === "running" && (
            <button className="hud-btn" onClick={() => room.send("pause")}>
              Pause
            </button>
          )}
          {phase === "paused" && (
            <>
              <button className="hud-btn" onClick={() => room.send("resume")}>
                Resume
              </button>
              <button className="hud-btn" onClick={() => room.send("step")}>
                Step
              </button>
            </>
          )}
        </div>

        <div className="stress-test-summary" aria-live="polite">
          {phaseLabel}
        </div>
      </div>

      <div className="speed-btns">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s.tickMs}
            className={`speed-btn${activeSpeed === s.tickMs ? " active" : ""}`}
            onClick={() => handleSpeed(s.tickMs)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <DebugPanel state={state} />

      <div className="demo-badge">DEMO</div>
    </>
  );
}

// ─── Demo room inner scene (uses Colyseus hooks) ─────────────────────────────

function DemoSceneInner({ onBack }: { onBack: () => void }) {
  const { room, isConnecting, error } = useRoom();
  const state = useRoomState() as DemoRoomState | undefined;

  if (isConnecting || !room) {
    return (
      <div className="stress-test-overlay">
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="stress-test-title">Connecting to Demo Room…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stress-test-overlay">
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="stress-test-title">Connection Failed</div>
        <div className="stress-test-summary">{error.message}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="stress-test-overlay">
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="stress-test-title">Waiting for state…</div>
      </div>
    );
  }

  return (
    <>
      <PlaybackControls room={room} state={state} onBack={onBack} />
      <Canvas
        camera={{ position: [0, -2, 12], fov: 45 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={2.0} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <DevToolsLogic />
        <TextureProvider>
          <Table />
          <DemoCards state={state} />
        </TextureProvider>
      </Canvas>
      <DevToolsUI />
    </>
  );
}

// ─── Demo room wrapper (RoomProvider) ────────────────────────────────────────

function DemoRoomScene({ onBack }: { onBack: () => void }) {
  return (
    <RoomProvider
      connect={() => client.joinOrCreate("demo", { name: "Demo Viewer" })}
    >
      <DemoSceneInner onBack={onBack} />
    </RoomProvider>
  );
}

// ─── Stress scene (original orbiting cards) ───────────────────────────────────

function StressSceneInner({ onBack }: { onBack: () => void }) {
  const showColorPicker =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("colorPicker") === "1";

  return (
    <>
      <div className="stress-test-overlay" data-autoplay-status="idle">
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back to Lobby
        </button>
        <div className="stress-test-title">Stress Test Scene</div>
        <div className="stress-test-summary">Instanced cards stress test</div>
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
          {!showColorPicker && <StressTestCardsInner />}
          {showColorPicker && <ColorPickerPlaceholder />}
        </TextureProvider>
      </Canvas>
      <DevToolsUI />
    </>
  );
}

// Minimal placeholder — ColorPicker requires complex context; keep scene functional
function ColorPickerPlaceholder() {
  return null;
}

// ─── Root scene — picks mode based on URL param ────────────────────────────────

export default function StressTestScene({ onBack }: { onBack: () => void }) {
  const mode =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mode")
      : null;

  return (
    <DevToolsProvider>
      {mode === "demo" ? (
        <DemoRoomScene onBack={onBack} />
      ) : (
        <StressSceneInner onBack={onBack} />
      )}
    </DevToolsProvider>
  );
}
