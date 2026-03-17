import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Card } from './Card';
import {
  UnoState, UnoColor,
  createGame, playCard, handleDraw, aiTurn,
  getPlayableCards, getActiveColor, cardTexture,
} from '../uno';

let PLAYER_NAMES = ['You', 'Player 2', 'Player 3', 'Player 4'];

export function setPlayerName(name: string) {
  PLAYER_NAMES[0] = name;
}

// Shared HUD state — Game writes, GameHud reads via useSyncExternalStore-like pattern
type HudState = { game: UnoState | null; isDealing: boolean; restart: () => void };
let hudState: HudState = { game: null, isDealing: true, restart: () => {} };
let hudListeners = new Set<() => void>();
function setHudState(s: HudState) {
  hudState = s;
  hudListeners.forEach(fn => fn());
}
function useHudState(): HudState {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const cb = () => forceUpdate(c => c + 1);
    hudListeners.add(cb);
    return () => { hudListeners.delete(cb); };
  }, []);
  return hudState;
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
}

const DEAL_INTERVAL_MS = 100;
const DEAL_START_DELAY_MS = 500;
const SHOWCASE_DURATION_MS = 700;
const AI_DELAY_MS = 800;

const COLOR_HEX: Record<UnoColor, string> = {
  red: '#ff3333',
  blue: '#3377ff',
  green: '#33bb44',
  yellow: '#ffcc00',
};

// Player positions as angles: 0=bottom(-PI/2), 1=left(PI), 2=top(PI/2), 3=right(0)
const PLAYER_ANGLE = [-Math.PI / 2, Math.PI, Math.PI / 2, 0];

function TurnIndicator({ currentPlayer, direction, radius }: {
  currentPlayer: number;
  direction: 1 | -1;
  radius: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const vel = useRef(0);
  const prevPlayer = useRef(currentPlayer);

  const targetAngle = PLAYER_ANGLE[currentPlayer];
  const targetRef = useRef(targetAngle);
  const currentAngle = useRef(targetAngle);

  // Only update target when currentPlayer actually changes
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

  // Arrow triangle shape
  const arrowShape = useMemo(() => {
    const s = radius * 0.15;
    const shape = new THREE.Shape();
    shape.moveTo(s, 0);
    shape.lineTo(-s * 0.6, s * 0.5);
    shape.lineTo(-s * 0.6, -s * 0.5);
    shape.closePath();
    return shape;
  }, [radius]);

  // Direction arc arrows (small triangles showing CW/CCW)
  const dirShape = useMemo(() => {
    const s = radius * 0.08;
    const shape = new THREE.Shape();
    shape.moveTo(s, 0);
    shape.lineTo(-s * 0.5, s * 0.4);
    shape.lineTo(-s * 0.5, -s * 0.4);
    shape.closePath();
    return shape;
  }, [radius]);

  // Place 4 small direction arrows around the circle
  const dirArrows = useMemo(() => {
    const arrows: { x: number; y: number; angle: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4; // offset from player positions
      const tangent = a + (direction === 1 ? -Math.PI / 2 : Math.PI / 2);
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
      {/* Main arrow pointing at current player */}
      <group ref={groupRef}>
        <mesh position={[radius, 0, 0]} rotation={[0, 0, 0]}>
          <shapeGeometry args={[arrowShape]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      </group>
      {/* Direction arrows — slowly rotating */}
      <group ref={dirGroupRef}>
        {dirArrows.map((arr, i) => (
          <mesh key={`dir-${i}`} position={[arr.x, arr.y, 0]} rotation={[0, 0, arr.angle]}>
            <shapeGeometry args={[dirShape]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function AnimatedRing({ color, innerRadius, outerRadius, position }: {
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

  // When color changes, punch scale up and shrink inner radius for a thicker ring
  if (color !== prevColor.current) {
    prevColor.current = color;
    groupRef.current?.scale.setScalar(1.8);
    vel.current.scale = 0;
    vel.current.inner = 0;
    target.current.scale = 1;
    target.current.innerRatio = 1;
    // Temporarily make inner ring smaller (thicker ring)
    if (innerRef.current) {
      innerRef.current.scale.setScalar(0.4);
    }
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;

    // Spring scale
    const curScale = g.scale.x;
    const accScale = 200 * (target.current.scale - curScale) - 30 * vel.current.scale;
    vel.current.scale += accScale * dt;
    g.scale.setScalar(curScale + vel.current.scale * dt);

    // Spring inner ring scale back to 1
    const curInner = innerRef.current.scale.x;
    const accInner = 200 * (target.current.innerRatio - curInner) - 30 * vel.current.inner;
    vel.current.inner += accInner * dt;
    innerRef.current.scale.setScalar(curInner + vel.current.inner * dt);
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Outer filled circle */}
      <mesh ref={outerRef}>
        <circleGeometry args={[outerRadius, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Inner cutout (table-colored) on top */}
      <mesh ref={innerRef} position={[0, 0, 0.001]}>
        <circleGeometry args={[innerRadius, 32]} />
        <meshBasicMaterial color="#1a7a3c" />
      </mesh>
    </group>
  );
}

const PICKER_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
const PICKER_STAGGER_MS = 80;

function ColorPicker({ hoveredPickerColor, onPickColor, onHoverColor }: {
  hoveredPickerColor: UnoColor | null;
  onPickColor: (color: UnoColor) => void;
  onHoverColor: (color: UnoColor | null) => void;
}) {
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null!);
  const circleRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const circleVels = useRef([0, 0, 0, 0]);
  const elapsed = useRef(0);
  const overlayVel = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;

    // Fade in overlay
    const curOpacity = overlayRef.current.opacity;
    const accO = 200 * (0.5 - curOpacity) - 30 * overlayVel.current;
    overlayVel.current += accO * dt;
    overlayRef.current.opacity = curOpacity + overlayVel.current * dt;

    // Stagger circles
    for (let i = 0; i < 4; i++) {
      const mesh = circleRefs.current[i];
      if (!mesh) continue;
      const delay = (i + 1) * PICKER_STAGGER_MS / 1000;
      const target = elapsed.current > delay
        ? (hoveredPickerColor === PICKER_COLORS[i] ? 1.3 : 1)
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
        <meshBasicMaterial ref={overlayRef} color="#000000" transparent opacity={0} />
      </mesh>
      {PICKER_COLORS.map((color, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
        const r = 0.6;
        return (
          <mesh
            key={`picker-${color}`}
            ref={(el) => { circleRefs.current[i] = el; }}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 2]}
            scale={0}
            onClick={(e) => { e.stopPropagation(); onPickColor(color); }}
            onPointerEnter={() => { document.body.style.cursor = 'pointer'; onHoverColor(color); }}
            onPointerLeave={() => { document.body.style.cursor = 'auto'; onHoverColor(null); }}
          >
            <circleGeometry args={[0.35, 32]} />
            <meshBasicMaterial color={COLOR_HEX[color]} />
          </mesh>
        );
      })}
    </>
  );
}

function createFeltTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1a7a3c';
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

  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
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

export function Game() {
  const { viewport } = useThree();
  const vw = viewport.width;
  const vh = viewport.height;

  const feltTexture = useMemo(() => createFeltTexture(), []);

  const [game, setGame] = useState<UnoState | null>(null);
  const [dealCount, setDealCount] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [showcaseCardId, setShowcaseCardId] = useState<string | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [hoveredPickerColor, setHoveredPickerColor] = useState<UnoColor | null>(null);

  useEffect(() => {
    setGame(createGame());
  }, []);

  // Deal order: built once from the initial game state, never recomputed.
  const dealOrderRef = useRef<string[]>([]);
  if (game && dealOrderRef.current.length === 0) {
    const order: string[] = [];
    const maxLen = Math.max(...game.hands.map(h => h.length));
    for (let c = 0; c < maxLen; c++) {
      for (let p = 0; p < 4; p++) {
        if (c < game.hands[p].length) {
          order.push(game.hands[p][c].id);
        }
      }
    }
    order.push(game.discardPile[0].id);
    dealOrderRef.current = order;
  }
  const dealOrder = dealOrderRef.current;
  const totalDeal = dealOrder.length;

  useEffect(() => {
    if (!game || dealCount >= totalDeal) return;
    const delay = dealCount === 0 ? DEAL_START_DELAY_MS : DEAL_INTERVAL_MS;
    const timer = setTimeout(() => setDealCount(c => c + 1), delay);
    return () => clearTimeout(timer);
  }, [game, dealCount, totalDeal]);

  const isDealing = !game || dealCount < totalDeal;

  const restart = useCallback(() => {
    dealOrderRef.current = [];
    setDealCount(0);
    setHoveredCard(null);
    setShowcaseCardId(null);
    setColorPickerFor(null);
    setHoveredPickerColor(null);
    setGame(createGame());
  }, []);

  // Sync HUD state for the HTML overlay
  useEffect(() => { setHudState({ game, isDealing, restart }); }, [game, isDealing, restart]);

  // During dealing, this set tracks which cards have been "dealt" (animated out).
  // After dealing is done, this is irrelevant — all cards use their real positions.
  const dealtSet = useMemo(() => {
    if (!isDealing) return null; // null = everything is dealt
    return new Set(dealOrder.slice(0, dealCount));
  }, [isDealing, dealOrder, dealCount]);

  // AI turns
  useEffect(() => {
    if (!game || isDealing || game.winner !== null || showcaseCardId) return;
    if (game.currentPlayer === 0) return;
    const timer = setTimeout(() => {
      setGame(prev => prev ? aiTurn(prev) : prev);
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, isDealing, showcaseCardId]);

  // Auto-draw for pending +2/+4 on human's turn
  useEffect(() => {
    if (!game || isDealing || game.winner !== null || showcaseCardId) return;
    if (game.currentPlayer !== 0 || game.pendingDraw === 0) return;
    const timer = setTimeout(() => {
      setGame(prev => prev ? handleDraw(prev) : prev);
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, isDealing, showcaseCardId]);

  const playableSet = useMemo(() => {
    if (!game || isDealing || showcaseCardId || colorPickerFor) return new Set<string>();
    return new Set(getPlayableCards(game, 0).map(c => c.id));
  }, [game, isDealing, showcaseCardId, colorPickerFor]);

  // Auto-draw and skip turn when player has no playable cards
  useEffect(() => {
    if (!game || isDealing || game.winner !== null || showcaseCardId || colorPickerFor) return;
    if (game.currentPlayer !== 0 || game.pendingDraw !== 0) return;
    if (playableSet.size > 0) return;
    const timer = setTimeout(() => {
      setGame(prev => prev ? handleDraw(prev) : prev);
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, isDealing, showcaseCardId, colorPickerFor, playableSet]);

  const showcaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clean up showcase timer on unmount
  useEffect(() => () => { clearTimeout(showcaseTimer.current); }, []);

  const onPlayCard = useCallback((cardId: string) => {
    if (!game || showcaseCardId || colorPickerFor) return;
    const card = game.hands[0].find(c => c.id === cardId);
    if (!card || !playableSet.has(cardId)) return;

    if (card.type === 'wild') {
      setColorPickerFor(cardId);
      return;
    }

    setHoveredCard(null);
    setShowcaseCardId(cardId);
    showcaseTimer.current = setTimeout(() => {
      setGame(prev => prev ? playCard(prev, 0, cardId) : prev);
      setShowcaseCardId(null);
    }, SHOWCASE_DURATION_MS);
  }, [game, showcaseCardId, colorPickerFor, playableSet]);

  const onPickColor = useCallback((color: UnoColor) => {
    if (!game || !colorPickerFor) return;
    const cardId = colorPickerFor;
    setColorPickerFor(null);
    setHoveredCard(null);
    setHoveredPickerColor(null);
    setShowcaseCardId(cardId);
    showcaseTimer.current = setTimeout(() => {
      setGame(prev => prev ? playCard(prev, 0, cardId, color) : prev);
      setShowcaseCardId(null);
    }, SHOWCASE_DURATION_MS);
  }, [game, colorPickerFor]);

  // Layout
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
      playerScale, playerSpacing, playerHoverScale, hoverLift, bottomY,
      opponentScale, hSpacing, vSpacing, topY, sideX, sideYOffset,
      pileX, pileScale, discardScale, showcaseScale,
    };
  }, [vw, vh]);

  const drawPilePos = useMemo((): [number, number, number] =>
    [-L.pileX, 0, 0], [L.pileX]);

  // Build ALL card renders — always in the tree so textures load once.
  // During dealing: undealt cards sit at draw pile, dealt ones fly to position.
  // After dealing: all cards at their real positions (isDealt always true).
  const cards = useMemo(() => {
    if (!game) return [];
    const result: CardRender[] = [];
    const placed = new Set<string>();

    // --- Discard pile z calculation ---
    const discardBaseZ = 0.5;
    const discardTopZ = discardBaseZ + game.discardPile.length * 0.02;

    // --- Showcase card (always above everything) ---
    if (showcaseCardId) {
      let card;
      for (const hand of game.hands) {
        card = hand.find(c => c.id === showcaseCardId);
        if (card) break;
      }
      if (card) {
        placed.add(card.id);
        result.push({
          key: card.id,
          textureId: cardTexture(card),
          position: [0, 0, discardTopZ + 1],
          rotationZ: 0,
          faceUp: true,
          scale: L.showcaseScale,
        });
      }
    }
    game.discardPile.forEach((card, i) => {
      if (placed.has(card.id)) return;
      placed.add(card.id);
      const dealt = !dealtSet || dealtSet.has(card.id);
      result.push({
        key: card.id,
        textureId: cardTexture(card),
        position: dealt
          ? [
              L.pileX + ((i * 13) % 7 - 3) * 0.03,
              ((i * 7) % 5 - 2) * 0.03,
              discardBaseZ + i * 0.02,
            ]
          : drawPilePos,
        rotationZ: dealt ? hashRotation(card.id, i) : 0,
        faceUp: dealt,
        scale: dealt ? L.discardScale : L.pileScale,
      });
    });

    // --- Player 0 hand ---
    const hand0 = game.hands[0].filter(c => !placed.has(c.id));
    hand0.forEach((card, i) => {
      placed.add(card.id);
      const dealt = !dealtSet || dealtSet.has(card.id);
      const center = (i - (hand0.length - 1) / 2);
      const playable = dealt && playableSet.has(card.id);
      const hovered = dealt && playable && card.id === hoveredCard;
      const colorMatch = dealt && hoveredPickerColor && card.type === 'color' && card.color === hoveredPickerColor;
      const fanAngle = center * 0.03;
      const lift = colorMatch ? L.hoverLift * 0.5 : playable ? L.hoverLift * 0.35 : 0;
      result.push({
        key: card.id,
        textureId: cardTexture(card),
        position: dealt
          ? [
              center * L.playerSpacing,
              L.bottomY + (hovered ? L.hoverLift : lift) - Math.abs(center) * 0.03,
              i * 0.01 + (hovered ? 0.1 : 0),
            ]
          : drawPilePos,
        rotationZ: dealt ? -fanAngle : 0,
        faceUp: dealt,
        scale: dealt
          ? (hovered ? L.playerHoverScale : L.playerScale)
          : L.pileScale,
        shake: dealt && hand0.length === 1,
      });
    });

    // --- Opponents ---
    for (let p = 1; p <= 3; p++) {
      const hand = game.hands[p];
      hand.forEach((card, i) => {
        if (placed.has(card.id)) return;
        placed.add(card.id);
        const dealt = !dealtSet || dealtSet.has(card.id);
        const center = (i - (hand.length - 1) / 2);
        let pos: [number, number, number];
        let rot: number;

        if (p === 1) {
          pos = [-L.sideX, center * L.vSpacing + L.sideYOffset, i * 0.01];
          rot = Math.PI / 2;
        } else if (p === 2) {
          pos = [center * L.hSpacing, L.topY, i * 0.01];
          rot = 0;
        } else {
          pos = [L.sideX, center * L.vSpacing + L.sideYOffset, i * 0.01];
          rot = -Math.PI / 2;
        }

        result.push({
          key: card.id,
          textureId: cardTexture(card),
          position: dealt ? pos : drawPilePos,
          rotationZ: dealt ? rot : 0,
          faceUp: false,
          scale: dealt ? L.opponentScale : L.pileScale,
          shake: dealt && hand.length === 1,
        });
      });
    }

    // --- Draw pile ---
    // Top cards use real identities so their textures are preloaded.
    // When drawn into a hand, the same component persists (no Suspense blink).
    // Bottom cards use stable position-based keys for visual stack depth.
    const drawPile = game.drawPile;
    const drawCount = drawPile.length;
    const visibleCount = Math.min(drawCount, 8);
    const realCount = Math.min(drawCount, 8); // top N with real card data

    for (let i = 0; i < visibleCount; i++) {
      const depth = visibleCount > 1 ? (visibleCount - 1 - i) / (visibleCount - 1) : 0;
      // Index from top of pile: drawPile[drawCount - 1] is the top card
      const fromTop = visibleCount - 1 - i;
      const isReal = fromTop < realCount;
      const card = isReal ? drawPile[drawCount - 1 - fromTop] : null;
      result.push({
        key: card ? card.id : `draw-${i}`,
        textureId: card ? cardTexture(card) : 'back',
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
  }, [game, hoveredCard, showcaseCardId, playableSet, hoveredPickerColor, dealtSet, drawPilePos, L]);

  const activeColor = game ? getActiveColor(game.discardPile[game.discardPile.length - 1]) : 'red';

  return (
    <group>
      {/* Table surface */}
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[25, 16]} />
        <meshStandardMaterial map={feltTexture} color="#ffffff" />
      </mesh>

      {/* Active color indicator ring around discard pile */}
      {!isDealing && game && (
        <AnimatedRing
          color={COLOR_HEX[activeColor]}
          innerRadius={0.55 * L.discardScale}
          outerRadius={0.62 * L.discardScale}
          position={[L.pileX, 0, 0.49]}
        />
      )}

      {/* Turn / direction indicator */}
      {!isDealing && game && game.winner === null && (
        <TurnIndicator
          currentPlayer={game.currentPlayer}
          direction={game.direction}
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
        />
      ))}

      {/* Hit areas for player's hand */}
      {!isDealing && !showcaseCardId && game && game.currentPlayer === 0 && game.winner === null && (() => {
        const hand0 = game.hands[0];
        return hand0.map((card, i) => {
          const total = hand0.length;
          const center = (i - (total - 1) / 2);
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
              onClick={(e) => { e.stopPropagation(); if (playable) onPlayCard(card.id); }}
              onPointerEnter={(e) => {
                e.stopPropagation();
                if (playable) {
                  document.body.style.cursor = 'pointer';
                  setHoveredCard(card.id);
                }
              }}
              onPointerLeave={() => {
                document.body.style.cursor = 'auto';
                setHoveredCard(null);
              }}
            >
              <planeGeometry args={[L.playerSpacing, L.playerScale * 1.2]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          );
        });
      })()}

      {/* Color picker for wild cards */}
      {colorPickerFor && (
        <ColorPicker
          hoveredPickerColor={hoveredPickerColor}
          onPickColor={onPickColor}
          onHoverColor={setHoveredPickerColor}
        />
      )}

      {/* Winner dim overlay */}
      {game?.winner !== null && game?.winner !== undefined && (
        <mesh position={[0, 0, 3]}>
          <planeGeometry args={[25, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

/** HUD overlay — render outside Canvas as a sibling */
export function GameHud() {
  const { game, isDealing, restart } = useHudState();
  if (!game) return null;
  const winner = game.winner;
  return (
    <div className="hud">
      {game.hands.map((hand, p) => (
        <div
          key={`label-${p}`}
          className={`player-label p${p}${!isDealing && game.currentPlayer === p && winner === null ? ' active' : ''}`}
        >
          {PLAYER_NAMES[p]}
          <span className="card-count">{hand.length}</span>
        </div>
      ))}
      {winner !== null && winner !== undefined && (
        <div className="winner-overlay">
          <div className="winner-text">
            {PLAYER_NAMES[winner]} wins!
          </div>
          <button className="new-game-btn" onClick={restart}>
            New Game
          </button>
        </div>
      )}
    </div>
  );
}
