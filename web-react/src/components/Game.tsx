import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Card } from "./Card";
import { UnoColor, cardTextureFromSchema, canPlaySchema } from "../../../server/shared/uno";
import {
  playCardSound,
  drawCardSound,
  selectColorSound,
  wildCardSound,
  winSound,
  unoSound,
  setSoundEnabled,
  vibrate,
} from "../sound";
import { useRoom, useRoomState } from "../colyseus";
import { Avatar } from "./Avatar";

// ── Shared types (mirrored from server schema) ─────────────────────

interface CardSchema {
  id: string;
  cardType: "color" | "wild";
  color: string;
  value: string;
  chosenColor: string;
}

interface PlayerSchema {
  sessionId: string;
  seatIndex: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  hand: CardSchema[];
  handCount: number;
}

interface ChatMessageSchema {
  sender: string;
  text: string;
  timestamp: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function getVisualPosition(seatIndex: number, localSeatIndex: number): number {
  return ((seatIndex - localSeatIndex) + 4) % 4;
}

function hashRotation(id: string, index: number): number {
  let h = index * 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 40) - 20) * (Math.PI / 180);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

interface CardRender {
  key: string;
  textureId: string;
  position: [number, number, number];
  rotationZ: number;
  faceUp: boolean;
  scale: number;
  shake?: boolean;
  highlight?: boolean;
  hoverTilt?: [number, number];
  selected?: boolean;
  initialPosition?: [number, number, number];
}

const SHOWCASE_DURATION_MS = 700;

const COLOR_HEX: Record<UnoColor, string> = {
  red: "#ff3333",
  blue: "#3377ff",
  green: "#33bb44",
  yellow: "#ffcc00",
};

// Player positions as angles: 0=bottom(-PI/2), 1=left(PI), 2=top(PI/2), 3=right(0)
const PLAYER_ANGLE = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

// ── TurnIndicator ───────────────────────────────────────────────

function TurnIndicator({
  currentPlayer,
  direction,
  radius,
}: {
  currentPlayer: number;
  direction: number;
  radius: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const vel = useRef(0);
  const prevPlayer = useRef(currentPlayer);

  const targetAngle = PLAYER_ANGLE[currentPlayer];
  const targetRef = useRef(targetAngle);
  const currentAngle = useRef(targetAngle);

  if (prevPlayer.current !== currentPlayer) {
    prevPlayer.current = currentPlayer;
    let diff = targetAngle - currentAngle.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.01) diff = direction * Math.PI * 2;
    targetRef.current = currentAngle.current + diff;
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const cur = currentAngle.current;
    const tgt = targetRef.current;
    const acc = 120 * (tgt - cur) - 22 * vel.current;
    vel.current += acc * dt;
    currentAngle.current = cur + vel.current * dt;
    groupRef.current.rotation.z = currentAngle.current;
  });

  const arrowShape = useMemo(() => {
    const s = radius * 0.15;
    const shape = new THREE.Shape();
    shape.moveTo(s, 0);
    shape.lineTo(-s * 0.6, s * 0.5);
    shape.lineTo(-s * 0.6, -s * 0.5);
    shape.closePath();
    return shape;
  }, [radius]);

  const dirShape = useMemo(() => {
    const s = radius * 0.08;
    const shape = new THREE.Shape();
    shape.moveTo(s, 0);
    shape.lineTo(-s * 0.5, s * 0.4);
    shape.lineTo(-s * 0.5, -s * 0.4);
    shape.closePath();
    return shape;
  }, [radius]);

  const dirArrows = useMemo(() => {
    const arrows: { x: number; y: number; angle: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const tangent =
        a + (direction === 1 ? -Math.PI / 2 : Math.PI / 2);
      arrows.push({
        x: Math.cos(a) * radius * 0.85,
        y: Math.sin(a) * radius * 0.85,
        angle: tangent,
      });
    }
    return arrows;
  }, [radius, direction]);

  const dirGroupRef = useRef<THREE.Group>(null!);
  const spinSpeed = direction === 1 ? -0.1 : 0.1;

  useFrame((_, delta) => {
    dirGroupRef.current.rotation.z += spinSpeed * Math.min(delta, 0.05);
  });

  return (
    <group position={[0, 0, 0.1]}>
      <group ref={groupRef}>
        <mesh position={[radius, 0, 0]} rotation={[0, 0, 0]}>
          <shapeGeometry args={[arrowShape]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      </group>
      <group ref={dirGroupRef}>
        {dirArrows.map((arr, i) => (
          <mesh
            key={`dir-${i}`}
            position={[arr.x, arr.y, 0]}
            rotation={[0, 0, arr.angle]}
          >
            <shapeGeometry args={[dirShape]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── AnimatedRing ────────────────────────────────────────────────

function AnimatedRing({
  color,
  innerRadius,
  outerRadius,
  position,
}: {
  color: string;
  innerRadius: number;
  outerRadius: number;
  position: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);
  const vel = useRef({ scale: 0, inner: 0 });
  const prevColor = useRef(color);
  const target = useRef({ scale: 1, innerRatio: 1 });

  if (color !== prevColor.current) {
    prevColor.current = color;
    groupRef.current?.scale.setScalar(1.8);
    vel.current.scale = 0;
    vel.current.inner = 0;
    target.current.scale = 1;
    target.current.innerRatio = 1;
    if (innerRef.current) {
      innerRef.current.scale.setScalar(0.4);
    }
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;

    const curScale = g.scale.x;
    const accScale =
      200 * (target.current.scale - curScale) - 30 * vel.current.scale;
    vel.current.scale += accScale * dt;
    g.scale.setScalar(curScale + vel.current.scale * dt);

    const curInner = innerRef.current.scale.x;
    const accInner =
      200 * (target.current.innerRatio - curInner) - 30 * vel.current.inner;
    vel.current.inner += accInner * dt;
    innerRef.current.scale.setScalar(curInner + vel.current.inner * dt);
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={outerRef}>
        <circleGeometry args={[outerRadius, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={innerRef} position={[0, 0, 0.001]}>
        <circleGeometry args={[innerRadius, 32]} />
        <meshBasicMaterial color="#1a7a3c" />
      </mesh>
    </group>
  );
}

// ── ColorPicker ─────────────────────────────────────────────────

const PICKER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const PICKER_STAGGER_MS = 80;

function ColorPicker({
  hoveredPickerColor,
  onPickColor,
  onHoverColor,
}: {
  hoveredPickerColor: UnoColor | null;
  onPickColor: (color: UnoColor) => void; // eslint-disable-line no-unused-vars
  onHoverColor: (color: UnoColor | null) => void; // eslint-disable-line no-unused-vars
}) {
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null!);
  const circleRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const circleVels = useRef([0, 0, 0, 0]);
  const elapsed = useRef(0);
  const overlayVel = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;

    const curOpacity = overlayRef.current.opacity;
    const accO = 200 * (0.5 - curOpacity) - 30 * overlayVel.current;
    overlayVel.current += accO * dt;
    overlayRef.current.opacity = curOpacity + overlayVel.current * dt;

    for (let i = 0; i < 4; i++) {
      const mesh = circleRefs.current[i];
      if (!mesh) continue;
      const delay = ((i + 1) * PICKER_STAGGER_MS) / 1000;
      const target =
        elapsed.current > delay
          ? hoveredPickerColor === PICKER_COLORS[i]
            ? 1.3
            : 1
          : 0;
      const cur = mesh.scale.x;
      const acc = 200 * (target - cur) - 30 * circleVels.current[i];
      circleVels.current[i] += acc * dt;
      mesh.scale.setScalar(Math.max(0, cur + circleVels.current[i] * dt));
    }
  });

  return (
    <>
      <mesh position={[0, 0, 1.9]}>
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial
          ref={overlayRef}
          color="#000000"
          transparent
          opacity={0}
        />
      </mesh>
      {PICKER_COLORS.map((color, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
        const r = 0.6;
        return (
          <mesh
            key={`picker-${color}`}
            ref={(el) => {
              circleRefs.current[i] = el;
            }}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 2]}
            scale={0}
            onClick={(e) => {
              e.stopPropagation();
              onPickColor(color);
            }}
            onPointerEnter={() => {
              document.body.style.cursor = "pointer";
              onHoverColor(color);
            }}
            onPointerLeave={() => {
              document.body.style.cursor = "auto";
              onHoverColor(null);
            }}
          >
            <circleGeometry args={[0.35, 32]} />
            <meshBasicMaterial color={COLOR_HEX[color]} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Felt table texture ──────────────────────────────────────────

function createFeltTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1a7a3c";
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    d[i] += noise;
    d[i + 1] += noise;
    d[i + 2] += noise;
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = "rgba(255,255,255,0.02)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 4 + Math.random() * 12;
    const angle = Math.PI * 0.25 + (Math.random() - 0.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

// ── Main Game component ─────────────────────────────────────────

interface GameProps {
  sortByColor: boolean;
  qualityLevel: string;
  onLastPlayed: (info: { cardId: string; playerName: string; textureId: string } | null) => void;
  onShake: () => void;
  onLongPress: (textureId: string) => void;
  selectedCardIndex: number;
  onSelectCard: (index: number) => void;
}

export function Game(props: GameProps) {
  const { sortByColor, onLastPlayed, onShake, onLongPress, selectedCardIndex, onSelectCard } = props;
  const { room } = useRoom();
  const state = useRoomState();
  const { viewport } = useThree();
  const vw = viewport.width;
  const vh = viewport.height;

  const feltTexture = useMemo(() => createFeltTexture(), []);

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showcaseCardId, setShowcaseCardId] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [hoveredPickerColor, setHoveredPickerColor] = useState<UnoColor | null>(
    null,
  );
  const [invalidMoveCard, setInvalidMoveCard] = useState<string | null>(null);
  const invalidMoveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const actionCooldown = useRef<boolean>(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Local seat detection ──────────────────────────────────────

  const localSeatIndex = useMemo(() => {
    if (!state?.players || !room) return 0;
    let seat = 0;
    for (const p of Object.values(state.players) as PlayerSchema[]) {
      if (p.sessionId === room.sessionId) seat = p.seatIndex;
    }
    return seat;
  }, [state, room]);

  // ── Players by visual position ────────────────────────────────

  const playersByVisualPos = useMemo(() => {
    if (!state?.players) return [];
    const result: {
      seatIndex: number;
      visualPos: number;
      player: PlayerSchema;
    }[] = [];
    for (const player of Object.values(state.players) as PlayerSchema[]) {
      result.push({
        seatIndex: player.seatIndex,
        visualPos: getVisualPosition(player.seatIndex, localSeatIndex),
        player,
      });
    }
    return result.sort((a, b) => a.visualPos - b.visualPos);
  }, [state, localSeatIndex]);

  // ── Local player's hand ───────────────────────────────────────

  const localHand: CardSchema[] = useMemo(() => {
    const entry = playersByVisualPos.find((p) => p.visualPos === 0);
    if (!entry?.player?.hand) return [];
    return [...entry.player.hand];
  }, [playersByVisualPos]);

  // Play UNO sound when local player goes to 1 card
  const prevLocalHandCount = useRef<number>(0);
  useEffect(() => {
    const count = localHand.length;
    if (prevLocalHandCount.current === 1 && count === 1) {
      // Already at 1, don't re-trigger
    } else if (count === 1 && prevLocalHandCount.current >= 2) {
      unoSound();
    }
    prevLocalHandCount.current = count;
  }, [localHand.length]);

  // ── Playable cards set ────────────────────────────────────────

  const playableSet = useMemo(() => {
    if (
      !state ||
      showcaseCardId ||
      colorPickerFor ||
      state.currentPlayer !== localSeatIndex ||
      state.winner !== -1
    ) {
      return new Set<string>();
    }
    if (state.discardPile.length === 0) return new Set<string>();

    const topCard = state.discardPile[state.discardPile.length - 1];
    const set = new Set<string>();
    for (const card of localHand) {
      if (canPlaySchema(card, topCard, state.activeColor, state.pendingDraw)) {
        set.add(card.id);
      }
    }
    return set;
  }, [state, localHand, localSeatIndex, showcaseCardId, colorPickerFor]);

  // Keyboard navigation for accessible card selection
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showcaseCardId || colorPickerFor) return;
      if (state?.currentPlayer !== localSeatIndex || state?.winner !== -1) return;
      const playableIndices: number[] = [];
      for (let i = 0; i < localHand.length; i++) {
        if (playableSet.has(localHand[i].id)) playableIndices.push(i);
      }
      if (playableIndices.length === 0) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          {
            const cur = selectedCardIndex;
            const idx = playableIndices.findIndex((i) => i === cur);
            if (idx <= 0) onSelectCard(playableIndices[playableIndices.length - 1]);
            else onSelectCard(playableIndices[idx - 1]);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          {
            const cur = selectedCardIndex;
            const idx = playableIndices.findIndex((i) => i === cur);
            if (idx < 0 || idx >= playableIndices.length - 1) onSelectCard(playableIndices[0]);
            else onSelectCard(playableIndices[idx + 1]);
          }
          break;
        case "Enter":
        case " ":
          if (selectedCardIndex >= 0 && selectedCardIndex < localHand.length) {
            const card = localHand[selectedCardIndex];
            if (card && playableSet.has(card.id)) {
              e.preventDefault();
              const cardId = card.id;
              if (card.cardType === "wild") {
                setColorPickerFor(cardId);
              } else {
                room?.send("play_card", { cardId });
                playCardSound();
                vibrate(30);
                onLastPlayed({
                  cardId,
                  playerName: "You",
                  textureId: cardTextureFromSchema(card),
                });
              }
              onSelectCard(-1);
            }
          }
          break;
        case "Escape":
          onSelectCard(-1);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCardIndex, localHand, playableSet, localSeatIndex, state, showcaseCardId, colorPickerFor, room, onLastPlayed, onSelectCard]);

  // ── Showcase / play card ──────────────────────────────────────

  const showcaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clean up showcase timer on unmount
  useEffect(() => () => { clearTimeout(showcaseTimer.current); clearTimeout(invalidMoveTimer.current); }, []);

  // UNO call keyboard shortcut (U key)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() !== "u") return;
      if (!room || !state) return;
      if (state.unoCaller === localSeatIndex) {
        room.send("uno");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [room, state, localSeatIndex]);

  const onPlayCard = useCallback(
    (cardId: string) => {
      if (!room || !state || showcaseCardId || colorPickerFor) return;
      if (actionCooldown.current) return;

      const card = localHand.find((c: CardSchema) => c.id === cardId);
      if (!card || !playableSet.has(cardId)) return;

      if (card.cardType === "wild") {
        wildCardSound();
        setColorPickerFor(cardId);
        return;
      }

      actionCooldown.current = true;
      setTimeout(() => { actionCooldown.current = false; }, 300);

      playCardSound();
      vibrate(30);
      room.send("play_card", { cardId });
      setHoveredCard(null);
      setShowcaseCardId(cardId);
      showcaseTimer.current = setTimeout(() => {
        setShowcaseCardId(null);
      }, SHOWCASE_DURATION_MS);
    },
    [room, state, localHand, showcaseCardId, colorPickerFor, playableSet],
  );

  const onPickColor = useCallback(
    (color: UnoColor) => {
      if (!room || !colorPickerFor) return;
      if (actionCooldown.current) return;

      actionCooldown.current = true;
      setTimeout(() => { actionCooldown.current = false; }, 300);

      const cardId = colorPickerFor;

      // Check if it's wild_draw4 for shake effect
      const card = localHand.find((c: CardSchema) => c.id === cardId);
      const isDraw4 = card?.value === "wild_draw4";

      selectColorSound();
      vibrate(30);
      if (isDraw4) onShake();
      room.send("play_card", { cardId, chosenColor: color });
      setColorPickerFor(null);
      setHoveredCard(null);
      setHoveredPickerColor(null);
      setShowcaseCardId(cardId);
      showcaseTimer.current = setTimeout(() => {
        setShowcaseCardId(null);
      }, SHOWCASE_DURATION_MS);
    },
    [room, colorPickerFor, localHand, onShake],
  );

  // ── Layout ────────────────────────────────────────────────────

  const L = useMemo(() => {
    const portrait = vw < vh;
    const unit = Math.min(vw, vh);

    const playerScale = portrait ? vw * 0.25 : unit * 0.21;
    const playerSpacing = playerScale * (portrait ? 0.28 : 0.36);
    const playerHoverScale = playerScale * 1.12;
    const hoverLift = playerScale * 0.3;
    const bottomY = -vh * 0.39;

    const opponentScale = portrait ? vw * 0.13 : unit * 0.11;
    const hSpacing = opponentScale * 0.35;
    const vSpacing = opponentScale * 0.35;
    const topY = vh * 0.35;
    const sideX = clamp(vw * 0.42, unit * 0.3, 5.5);
    const sideYOffset = -vh * 0.03;

    const pileX = clamp(unit * 0.12, 0.4, 1.2);
    const pileScale = portrait ? vw * 0.14 : unit * 0.11;
    const discardScale = portrait ? vw * 0.16 : unit * 0.13;

    const showcaseScale = portrait ? vw * 0.4 : unit * 0.3;

    return {
      playerScale,
      playerSpacing,
      playerHoverScale,
      hoverLift,
      bottomY,
      opponentScale,
      hSpacing,
      vSpacing,
      topY,
      sideX,
      sideYOffset,
      pileX,
      pileScale,
      discardScale,
      showcaseScale,
    };
  }, [vw, vh]);

  // ── Track state changes for card animations ────────────────

  const prevStateRef = useRef({
    discardLen: 0,
    currentPlayer: -1,
    handCounts: new Map<number, number>(),
    localHandIds: new Set<string>(),
  });

  // Compute initial positions for newly appearing cards
  const newCardAnimations = useMemo(() => {
    const anims = new Map<string, [number, number, number]>();
    if (!state) return anims;

    const prev = prevStateRef.current;
    const discardLen = state.discardPile.length;

    // Helper: center position of a player's hand by visual position
    function handCenter(vp: number): [number, number, number] {
      switch (vp) {
        case 1: return [-L.sideX, L.sideYOffset, 0.1];
        case 2: return [0, L.topY, 0.1];
        case 3: return [L.sideX, L.sideYOffset, 0.1];
        default: return [0, L.bottomY, 0.1];
      }
    }

    const drawPileOrigin: [number, number, number] = [-L.pileX, 0, 0];

    // New discard card: animate FROM the player who just played
    if (discardLen > prev.discardLen && prev.currentPlayer >= 0) {
      const newCard = state.discardPile[discardLen - 1];
      const fromVisualPos = getVisualPosition(prev.currentPlayer, localSeatIndex);
      // Don't set initialPosition for local player — showcase handles that
      if (fromVisualPos !== 0) {
        anims.set(newCard.id, handCenter(fromVisualPos));
      }
    }

    // New opponent hand cards: animate FROM the draw pile
    playersByVisualPos.forEach(({ player, visualPos }) => {
      if (visualPos === 0) return; // skip local
      const prevCount = prev.handCounts.get(player.seatIndex) ?? 0;
      if (player.handCount > prevCount) {
        for (let i = prevCount; i < player.handCount; i++) {
          anims.set(`opponent-${player.seatIndex}-${i}`, drawPileOrigin);
        }
      }
    });

    // New local hand cards: animate FROM the draw pile
    for (const card of localHand) {
      if (!prev.localHandIds.has(card.id)) {
        anims.set(card.id, drawPileOrigin);
      }
    }

    return anims;
  }, [state, localSeatIndex, localHand, playersByVisualPos, L]);

  // Update tracking ref after render
  useEffect(() => {
    if (!state) return;
    const prev = prevStateRef.current;
    prev.discardLen = state.discardPile.length;
    prev.currentPlayer = state.currentPlayer;
    playersByVisualPos.forEach(({ player }) => {
      prev.handCounts.set(player.seatIndex, player.handCount);
    });
    const ids = new Set<string>();
    for (const card of localHand) ids.add(card.id);
    prev.localHandIds = ids;
  }, [state, playersByVisualPos, localHand]);

  // Track last played card
  const prevDiscardLen = useRef(0);
  useEffect(() => {
    if (!state) return;
    if (state.discardPile.length > prevDiscardLen.current) {
      const topCard = state.discardPile[state.discardPile.length - 1];
      // prev.currentPlayer is who just played (before turn advanced)
      const prevPlayer = prevStateRef.current.currentPlayer;
      let playerName = "Player";
      if (state.players) {
        for (const p of Object.values(state.players) as PlayerSchema[]) {
          if (p.seatIndex === prevPlayer) { playerName = p.name; break; }
        }
      }
      onLastPlayed({
        cardId: topCard.id,
        playerName,
        textureId: cardTextureFromSchema(topCard),
      });
    }
    prevDiscardLen.current = state.discardPile.length;
  }, [state, onLastPlayed]);

  // ── Build card renders ────────────────────────────────────────

  const cards = useMemo(() => {
    if (!state) return [];
    const result: CardRender[] = [];
    const placed = new Set<string>();

    // --- Discard pile z calculation ---
    const discardLen = state.discardPile.length;
    const discardBaseZ = 0.5;
    const discardTopZ = discardBaseZ + discardLen * 0.02;

    // --- Showcase card ---
    if (showcaseCardId) {
      // Find card in local hand or discard pile
      let card: CardSchema | undefined = localHand.find((c: CardSchema) => c.id === showcaseCardId);
      if (!card) {
        for (let i = 0; i < discardLen; i++) {
          if (state.discardPile[i].id === showcaseCardId) {
            card = state.discardPile[i];
            break;
          }
        }
      }
      if (card) {
        placed.add(card.id);
        result.push({
          key: card.id,
          textureId: cardTextureFromSchema(card),
          position: [0, 0, discardTopZ + 1],
          rotationZ: 0,
          faceUp: true,
          scale: L.showcaseScale,
        });
      }
    }

    // --- Discard pile ---
    for (let i = 0; i < discardLen; i++) {
      const card = state.discardPile[i];
      if (placed.has(card.id)) continue;
      placed.add(card.id);
      result.push({
        key: card.id,
        textureId: cardTextureFromSchema(card),
        position: [
          L.pileX + (((i * 13) % 7) - 3) * 0.03,
          (((i * 7) % 5) - 2) * 0.03,
          discardBaseZ + i * 0.02,
        ],
        rotationZ: hashRotation(card.id, i),
        faceUp: true,
        scale: L.discardScale,
        initialPosition: newCardAnimations.get(card.id),
      });
    }

    // --- Local player hand (visual position 0 = bottom) ---
    const sortedHand = sortByColor
      ? [...localHand].sort((a, b) => {
          if (a.cardType === "wild" && b.cardType !== "wild") return 1;
          if (a.cardType !== "wild" && b.cardType === "wild") return -1;
          if (a.cardType === "color" && b.cardType === "color") {
            if (a.color !== b.color) return a.color.localeCompare(b.color);
            return a.value.localeCompare(b.value);
          }
          return 0;
        })
      : localHand;
    const hand0 = sortedHand.filter((c: CardSchema) => !placed.has(c.id));
    hand0.forEach((card: CardSchema, i: number) => {
      placed.add(card.id);
      const center = i - (hand0.length - 1) / 2;
      const playable = playableSet.has(card.id);
      const hovered = playable && card.id === hoveredCard;
      const colorMatch =
        hoveredPickerColor &&
        card.cardType === "color" &&
        card.color === hoveredPickerColor;
      const fanAngle = center * 0.03;
      const lift = colorMatch
        ? L.hoverLift * 0.5
        : playable
          ? L.hoverLift * 0.35
          : 0;
      result.push({
        key: card.id,
        textureId: cardTextureFromSchema(card),
        position: [
          center * L.playerSpacing,
          L.bottomY +
            (hovered ? L.hoverLift : lift) -
            Math.abs(center) * 0.03,
          i * 0.01 + (hovered ? 0.1 : 0),
        ],
        rotationZ: -fanAngle,
        faceUp: true,
        scale: hovered ? L.playerHoverScale : L.playerScale,
        shake: (hand0.length === 1 && state.winner === -1) || card.id === invalidMoveCard,
        highlight: playable,
        selected: i === selectedCardIndex && playable,
        hoverTilt: hovered ? [0.08, center * 0.06] : undefined,
        initialPosition: newCardAnimations.get(card.id),
      });
    });

    // --- Opponents (face down, by visual position) ---
    for (const { player, visualPos } of playersByVisualPos) {
      if (visualPos === 0) continue; // skip local player

      for (let i = 0; i < player.handCount; i++) {
        const center = i - (player.handCount - 1) / 2;
        let pos: [number, number, number];
        let rot: number;

        if (visualPos === 1) {
          pos = [
            -L.sideX,
            center * L.vSpacing + L.sideYOffset,
            i * 0.01,
          ];
          rot = Math.PI / 2;
        } else if (visualPos === 2) {
          pos = [center * L.hSpacing, L.topY, i * 0.01];
          rot = 0;
        } else {
          pos = [L.sideX, center * L.vSpacing + L.sideYOffset, i * 0.01];
          rot = -Math.PI / 2;
        }

        const opKey = `opponent-${player.seatIndex}-${i}`;
        result.push({
          key: opKey,
          textureId: "back",
          position: pos,
          rotationZ: rot,
          faceUp: false,
          scale: L.opponentScale,
          shake: player.handCount === 1 && state.winner === -1,
          initialPosition: newCardAnimations.get(opKey),
        });
      }
    }

    // --- Draw pile (visual only — no card data) ---
    const drawCount = state.drawPileCount;
    const visibleCount = Math.min(drawCount, 8);
    for (let i = 0; i < visibleCount; i++) {
      const depth =
        visibleCount > 1 ? (visibleCount - 1 - i) / (visibleCount - 1) : 0;
      result.push({
        key: `draw-${i}`,
        textureId: "back",
        position: [
          -L.pileX + depth * L.pileScale * 0.06,
          -depth * L.pileScale * 0.12,
          i * 0.008,
        ],
        rotationZ: 0,
        faceUp: false,
        scale: L.pileScale,
      });
    }

    return result;
  }, [
    state,
    hoveredCard,
    showcaseCardId,
    playableSet,
    hoveredPickerColor,
    localHand,
    sortByColor,
    playersByVisualPos,
    newCardAnimations,
    invalidMoveCard,
    selectedCardIndex,
    L,
  ]);

  const activeColor = state
    ? (state.activeColor as UnoColor) || "red"
    : "red";

  const currentVisualPos = state
    ? getVisualPosition(state.currentPlayer, localSeatIndex)
    : 0;

  if (!state || !room) return null;

  return (
    <group>
      {/* Table surface */}
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[25, 16]} />
        <meshStandardMaterial map={feltTexture} color="#ffffff" />
      </mesh>


      {/* Active color indicator ring */}
      {state.phase === "playing" && (
        <AnimatedRing
          color={COLOR_HEX[activeColor]}
          innerRadius={0.55 * L.discardScale}
          outerRadius={0.62 * L.discardScale}
          position={[L.pileX, 0, 0.49]}
        />
      )}

      {/* Turn / direction indicator */}
      {state.phase === "playing" && state.winner === -1 && (
        <TurnIndicator
          currentPlayer={currentVisualPos}
          direction={state.direction}
          radius={Math.min(vh * 0.28, vw * 0.32)}
        />
      )}

      {/* Cards */}
      {cards.map((c) => (
        <Card
          key={c.key}
          textureId={c.textureId}
          position={c.position}
          rotationZ={c.rotationZ}
          faceUp={c.faceUp}
          scale={c.scale}
          shake={c.shake}
          highlight={c.highlight}
          hoverTilt={c.hoverTilt}
          selected={c.selected}
          initialPosition={c.initialPosition}
        />
      ))}

      {/* Hit areas for local player's hand */}
      {!showcaseCardId &&
        state.currentPlayer === localSeatIndex &&
        state.winner === -1 &&
        (() => {
          return localHand.map((card: CardSchema, i: number) => {
            const total = localHand.length;
            const center = i - (total - 1) / 2;
            const playable = playableSet.has(card.id);
            return (
              <mesh
                key={`hit-${card.id}`}
                position={[
                  center * L.playerSpacing,
                  L.bottomY - Math.abs(center) * 0.03,
                  0.08,
                ]}
                rotation={[0, 0, -center * 0.03]}
                onClick={(e) => {
                  e.stopPropagation();
                  // Cancel any pending long-press
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                  if (playable) onPlayCard(card.id);
                  else {
                    setInvalidMoveCard(card.id);
                    clearTimeout(invalidMoveTimer.current);
                    invalidMoveTimer.current = setTimeout(() => setInvalidMoveCard(null), 400);
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  longPressTimer.current = setTimeout(() => {
                    onLongPress(cardTextureFromSchema(card));
                    longPressTimer.current = null;
                  }, 500);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onPointerEnter={(e) => {
                  e.stopPropagation();
                  if (playable) {
                    document.body.style.cursor = "pointer";
                    setHoveredCard(card.id);
                  }
                }}
                onPointerLeave={() => {
                  document.body.style.cursor = "auto";
                  setHoveredCard(null);
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
              >
                <planeGeometry
                  args={[L.playerSpacing, L.playerScale * 1.2]}
                />
                <meshBasicMaterial
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </mesh>
            );
          });
        })()}

      {/* Draw pile hit area — click to draw */}
      {!showcaseCardId &&
        !colorPickerFor &&
        state.currentPlayer === localSeatIndex &&
        state.winner === -1 && (
          <mesh
            position={[-L.pileX, 0, 0.05]}
            rotation={[0, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (actionCooldown.current) return;
              actionCooldown.current = true;
              setTimeout(() => { actionCooldown.current = false; }, 300);
              drawCardSound();
              room.send("draw_card");
            }}
            onPointerEnter={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerLeave={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <planeGeometry args={[L.pileScale * 1.5, L.pileScale * 2.2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

      {/* Color picker for wild cards */}
      {colorPickerFor && (
        <ColorPicker
          hoveredPickerColor={hoveredPickerColor}
          onPickColor={onPickColor}
          onHoverColor={setHoveredPickerColor}
        />
      )}

      {/* Winner dim overlay */}
      {state.winner !== -1 && (
        <mesh position={[0, 0, 3]}>
          <planeGeometry args={[25, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

// ── RulesOverlay ────────────────────────────────────────────────

function RulesOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-overlay">
      <div className="rules-card">
        <div className="rules-header">
          <h2>UNO Rules</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body">
          <section>
            <h3>Objective</h3>
            <p>Be the first to play all your cards. When you have one card left, you must call &ldquo;UNO&rdquo;.</p>
          </section>
          <section>
            <h3>Playing Cards</h3>
            <p>Play a card that matches the top card on the discard pile by color or value. Wild cards can be played on any card.</p>
          </section>
          <section>
            <h3>Action Cards</h3>
            <ul>
              <li><strong>Skip</strong> — Next player loses their turn</li>
              <li><strong>Reverse</strong> — Direction of play reverses</li>
              <li><strong>Draw 2</strong> — Next player draws 2 cards and loses turn</li>
            </ul>
          </section>
          <section>
            <h3>Wild Cards</h3>
            <ul>
              <li><strong>Wild</strong> — Choose any color to play next</li>
              <li><strong>Wild Draw 4</strong> — Choose color + opponent draws 4</li>
            </ul>
          </section>
          <section>
            <h3>Drawing</h3>
            <p>If you cannot play, click the draw pile to draw a card. Your turn passes to the next player.</p>
          </section>
          <section>
            <h3>Keyboard Shortcuts</h3>
            <ul>
              <li><strong>M</strong> — Toggle sound</li>
              <li><strong>S</strong> — Toggle sort by color</li>
              <li><strong>F</strong> — Toggle fullscreen</li>
              <li><strong>?</strong> — Show this help</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── OptionsOverlay ──────────────────────────────────────────────

interface OptionsOverlayProps {
  onClose: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  qualityLevel: string;
  onQualityToggle: () => void;
}

function OptionsOverlay({ onClose, soundEnabled, onSoundToggle, qualityLevel, onQualityToggle }: OptionsOverlayProps) {
  const qualityLabel = qualityLevel.toUpperCase();
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-header">
          <h2>Options</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body">
          <section>
            <h3>Sound</h3>
            <div className="option-row">
              <span>Sound effects</span>
              <button
                className={`toggle-btn${soundEnabled ? " on" : ""}`}
                onClick={onSoundToggle}
              >
                {soundEnabled ? "ON" : "OFF"}
              </button>
            </div>
          </section>
          <section>
            <h3>Display</h3>
            <div className="option-row">
              <span>Card sorting</span>
              <button className="toggle-btn on">AUTO</button>
            </div>
            <div className="option-row" style={{ marginTop: 8 }}>
              <span>Quality (Q)</span>
              <button className="toggle-btn on" onClick={onQualityToggle}>
                {qualityLabel}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              Cycles: Low → Medium → High
            </p>
          </section>
          <section>
            <h3>About</h3>
            <p>Turn-based Card Game — Colyseus Demo</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              Built with React Three Fiber, TypeScript, and Colyseus
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── ChatOverlay ──────────────────────────────────────────────────

interface ChatOverlayProps {
  onClose: () => void;
}

function ChatOverlay({ onClose }: ChatOverlayProps) {
  const { room } = useRoom();
  const state = useRoomState();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = (state as unknown as { chatMessages?: ChatMessageSchema[] }).chatMessages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !room) return;
    room.send("chat", { text });
    setInput("");
  };

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="rules-header">
          <h2>Chat</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body" style={{ maxHeight: 240, overflowY: "auto", gap: 8 }}>
          {messages.length === 0 && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
              No messages yet
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              <strong style={{ color: "#ffcc00" }}>{msg.sender}:</strong>{" "}
              <span style={{ color: "rgba(255,255,255,0.85)" }}>{msg.text}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            ref={inputRef}
            className="lobby-input"
            style={{ flex: 1, fontSize: 14, padding: "8px 12px" }}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            maxLength={200}
          />
          <button
            className="lobby-btn"
            style={{ width: "auto", padding: "8px 16px", fontSize: 14 }}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Turn Timer ──────────────────────────────────────────────────

const HUMAN_TURN_MS = 7000;
const BOT_TURN_MS = 800;

function TurnTimer({ deadline, isBot }: { deadline: number; isBot: boolean }) {
  const svgRef = useRef<SVGCircleElement>(null!);
  const duration = isBot ? BOT_TURN_MS : HUMAN_TURN_MS;

  useEffect(() => {
    let raf: number;
    function tick() {
      const remaining = Math.max(0, deadline - Date.now());
      const progress = Math.min(1, remaining / duration);
      const circle = svgRef.current;
      if (circle) {
        const circumference = 2 * Math.PI * 9;
        circle.style.strokeDashoffset = String(
          circumference * (1 - progress),
        );
        // Color: green → yellow → red
        if (progress > 0.5) {
          circle.style.stroke = "#33bb44";
        } else if (progress > 0.2) {
          circle.style.stroke = "#ffcc00";
        } else {
          circle.style.stroke = "#ff4444";
        }
      }
      if (remaining > 0) raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [deadline, duration]);

  const circumference = 2 * Math.PI * 9;

  return (
    <svg className="turn-timer" width="22" height="22" viewBox="0 0 22 22">
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="2.5"
      />
      <circle
        ref={svgRef}
        cx="11"
        cy="11"
        r="9"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset="0"
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

// ── HUD overlay ─────────────────────────────────────────────────

interface GameHudProps {
  sortByColor: boolean;
  onSortToggle: () => void;
  showRules: boolean;
  onShowRules: () => void;
  onCloseRules: () => void;
  showOptions: boolean;
  onShowOptions: () => void;
  onCloseOptions: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  qualityLevel: string;
  onQualityToggle: () => void;
  lastPlayed: { cardId: string; playerName: string; textureId: string } | null;
  showChat: boolean;
  onShowChat: () => void;
  onCloseChat: () => void;
}

export function GameHud({ sortByColor, onSortToggle, showRules, onShowRules, onCloseRules, showOptions, onShowOptions, onCloseOptions, soundEnabled, onSoundToggle, qualityLevel, onQualityToggle, lastPlayed, showChat, onShowChat, onCloseChat }: GameHudProps) {
  const { room } = useRoom();
  const state = useRoomState();
  const [copied, setCopied] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const prevWinner = useRef(-1);

  // Play win sound when winner is declared
  useEffect(() => {
    if (state.winner !== -1 && state.winner !== prevWinner.current) {
      prevWinner.current = state.winner;
      winSound();
    }
  }, [state.winner]);

  // Measure connection latency every 5 seconds
  useEffect(() => {
    if (!room) return;
    let mounted = true;
    const id = setInterval(() => {
      if (!mounted || !room) return;
      room.ping((ms: number) => {
        if (mounted) setLatency(ms);
      });
    }, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [room]);

  if (!state?.players || !room) return null;

  // Waiting for more players
  if (state.phase === "waiting") {
    const connectedCount = Object.values(state.players as PlayerSchema[]).filter((p) => p.connected).length;
    return (
      <div className="hud">
        <div className="waiting-overlay">
          <div className="waiting-text">Waiting for players… ({connectedCount}/4)</div>
        </div>
      </div>
    );
  }

  const players = Object.values(state.players) as PlayerSchema[];

  // Find local seat
  let localSeatIndex = 0;
  for (const p of players) {
    if (p.sessionId === room.sessionId) localSeatIndex = p.seatIndex;
  }

  // Build player labels
  const labels: React.ReactNode[] = [];
  for (const player of players) {
    const visualPos = getVisualPosition(player.seatIndex, localSeatIndex);
    const isActive =
      state.currentPlayer === player.seatIndex && state.winner === -1;
    labels.push(
      <div
        key={`label-${player.seatIndex}`}
        className={`player-label p${visualPos}${isActive ? " active" : ""}`}
      >
        <Avatar name={player.name} size={22} />
        {isActive && state.turnDeadline > 0 && (
          <TurnTimer deadline={state.turnDeadline} isBot={player.isBot} />
        )}
        <span className="player-name">{player.name}</span>
        <span className="card-count">{player.handCount}</span>
      </div>,
    );
  }

  // Find winner name
  let winnerName = "";
  if (state.winner !== -1) {
    for (const p of players) {
      if (p.seatIndex === state.winner) winnerName = p.name;
    }
  }

  return (
    <div className="hud">
      <div className="hud-top">
        <div
          className={`room-code${copied ? " copied" : ""}`}
          title="Click to copy"
          onClick={() => {
            try {
              navigator.clipboard.writeText(room.roomId);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard API unavailable (e.g., insecure context) — silently fail
            }
          }}
        >
          {copied ? "Copied!" : room.roomId}
          {!copied && (
            <svg className="copy-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
            </svg>
          )}
        </div>
        {state.spectatorCount > 0 && (
          <div className="spectator-badge" title="Spectators watching">
            👁 {state.spectatorCount}
          </div>
        )}
        {latency !== null && (
          <div
            className="spectator-badge"
            title={`Latency: ${latency}ms`}
            style={{ color: latency < 80 ? "#33bb44" : latency < 200 ? "#ffcc00" : "#ff6b6b" }}
          >
            {latency < 80 ? "●●●" : latency < 200 ? "●●○" : "●○○"} {latency}ms
          </div>
        )}
        <div className="hud-actions">
          <button
            className="hud-btn"
            title={sortByColor ? "Sort by hand order" : "Sort by color"}
            onClick={onSortToggle}
          >
            {sortByColor ? "📋" : "🎨"}
          </button>
          <button
            className="hud-btn"
            title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            onClick={() => { setSoundEnabled(!soundEnabled); onSoundToggle(); }}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
          <button
            className="hud-btn"
            title="Game rules"
            onClick={onShowRules}
          >
            ?
          </button>
          <button
            className="hud-btn"
            title="Options"
            onClick={onShowOptions}
          >
            ⚙
          </button>
          <button
            className="hud-btn"
            title="Toggle fullscreen"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
          >
            ⛶
          </button>
          <button
            className="hud-btn"
            title="Chat (C)"
            onClick={onShowChat}
          >
            💬
          </button>
        </div>
      </div>
      {labels}
      {lastPlayed && state.winner === -1 && (
        <div className="last-played">
          <span className="last-played-player">{lastPlayed.playerName}</span>
          <span className="last-played-card" data-texture={lastPlayed.textureId} />
        </div>
      )}
      {state.winner !== -1 && (
        <div className="winner-overlay">
          {/* Confetti pieces */}
          {["#ffcc00","#ff3333","#3377ff","#33bb44","#ff69b4","#ff9900"].map((color, i) => (
            <div
              key={`confetti-${i}`}
              className="confetti-piece"
              style={{
                left: `${15 + i * 14}%`,
                background: color,
                animationDelay: `${i * 0.08}s`,
                width: i % 3 === 0 ? 10 : 6,
                height: i % 3 === 0 ? 14 : 8,
              }}
            />
          ))}
          <div className="winner-text">{winnerName} wins!</div>
          <button
            className="new-game-btn"
            onClick={() => room.send("restart")}
          >
            New Game
          </button>
        </div>
      )}
      {showRules && <RulesOverlay onClose={onCloseRules} />}
      {showOptions && (
        <OptionsOverlay
          onClose={onCloseOptions}
          soundEnabled={soundEnabled}
          onSoundToggle={() => { setSoundEnabled(!soundEnabled); onSoundToggle(); }}
          qualityLevel={qualityLevel}
          onQualityToggle={onQualityToggle}
        />
      )}
      {showChat && <ChatOverlay onClose={onCloseChat} />}
    </div>
  );
}
