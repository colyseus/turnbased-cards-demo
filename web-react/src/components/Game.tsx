import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { InstancedCards, CardData } from "./game/InstancedCards";
import { cardTextureFromSchema, canPlaySchema } from "../../../server/shared/uno";
import {
  playCardSound,
  drawCardSound,
  selectColorSound,
  wildCardSound,
} from "../sound";
import { useRoom, useRoomState } from "../colyseus";

import { Table } from "./game/Table";
import { TurnIndicator } from "./game/TurnIndicator";
import { AnimatedRing } from "./game/AnimatedRing";
import { ColorPicker } from "./game/ColorPicker";
import { useDevTools } from "./DevTools";

import { CardSchema, PlayerSchema } from "../types";
import { getVisualPosition, hashRotation, clamp } from "../utils";

// ── Types & Constants ───────────────────────────────────────────

type UnoColor = "red" | "blue" | "green" | "yellow";

const SHOWCASE_DURATION_MS = 700;

const COLOR_HEX: Record<UnoColor, string> = {
  red: "#ff625f",
  blue: "#4c8dff",
  green: "#43d47d",
  yellow: "#ffcf5a",
};

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
  const { stressTestCount } = useDevTools();

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
    const hand = [...entry.player.hand];
    if (sortByColor) {
      hand.sort((a, b) => {
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.value.localeCompare(b.value);
      });
    }
    return hand;
  }, [playersByVisualPos, sortByColor]);

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

      const playableCards = localHand.filter(c => playableSet.has(c.id));
      if (playableCards.length === 0) return;

      if (e.key === "ArrowRight") {
        onSelectCard((selectedCardIndex + 1) % playableCards.length);
      } else if (e.key === "ArrowLeft") {
        onSelectCard((selectedCardIndex - 1 + playableCards.length) % playableCards.length);
      } else if (e.key === "Enter" || e.key === " ") {
        const card = playableCards[selectedCardIndex];
        if (card) onPlayCard(card.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localHand, playableSet, selectedCardIndex, state, localSeatIndex, showcaseCardId, colorPickerFor, onSelectCard]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (invalidMoveTimer.current) clearTimeout(invalidMoveTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  // ── Callbacks ────────────────────────────────────────────────

  const onPlayCard = useCallback(
    (cardId: string) => {
      if (actionCooldown.current || !room) return;
      actionCooldown.current = true;
      setTimeout(() => { actionCooldown.current = false; }, 400);

      const card = localHand.find((c) => c.id === cardId);
      if (!card) return;

      if (card.cardType === "wild") {
        setColorPickerFor(cardId);
        selectColorSound();
      } else {
        room.send("play_card", { cardId });
        setShowcaseCardId(cardId);
        playCardSound();
      }
    },
    [room, localHand],
  );

  const onPickColor = useCallback(
    (color: UnoColor) => {
      if (!colorPickerFor || !room) return;
      room.send("play_card", { cardId: colorPickerFor, chosenColor: color });
      setShowcaseCardId(colorPickerFor);
      setColorPickerFor(null);
      wildCardSound();
    },
    [room, colorPickerFor],
  );

  // ── Layout constants ─────────────────────────────────────────

  const L = useMemo(() => {
    const isMobile = vw < 6;
    const isPortrait = vh > vw;
    const baseScale = isMobile ? 0.8 : 1.2;
    return {
      playerScale: baseScale,
      playerSpacing: isMobile ? 0.35 : 0.6,
      pileScale: baseScale * 1.1,
      discardScale: baseScale * 1.25,
      bottomY: isPortrait ? -vh * 0.42 : -vh * 0.38,
      topY: isPortrait ? vh * 0.38 : vh * 0.34,
      sideX: isPortrait ? vw * 0.4 : vw * 0.38,
      sideY: 0,
      pileX: isMobile ? 0.9 : 1.5,
    };
  }, [vw, vh]);

  // ── Sync last played card to HUD ─────────────────────────────

  useEffect(() => {
    if (!state?.discardPile || state.discardPile.length === 0) {
      onLastPlayed(null);
      return;
    }
    const top = state.discardPile[state.discardPile.length - 1];
    let playerName = "Unknown";
    for (const p of Object.values(state.players) as PlayerSchema[]) {
      if (p.seatIndex === state.lastPlayerIndex) playerName = p.name;
    }
    onLastPlayed({
      cardId: top.id,
      playerName,
      textureId: cardTextureFromSchema(top),
    });
  }, [state?.discardPile, state?.lastPlayerIndex, state?.players, onLastPlayed]);

  // ── Effect: Trigger showcase animation ──────────────────────

  useEffect(() => {
    if (showcaseCardId) {
      const timer = setTimeout(() => {
        setShowcaseCardId(null);
        onShake(); // trigger camera shake
      }, SHOWCASE_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [showcaseCardId, onShake]);

  // ── Building the card list ───────────────────────────────────

  const cards: CardData[] = useMemo(() => {
    const list: CardData[] = [];

    // 1. Stress Test Cards (background)
    if (stressTestCount > 0) {
        for (let i = 0; i < stressTestCount; i++) {
            const angle = (i / stressTestCount) * Math.PI * 2 + Date.now() * 0.0001;
            const r = 4 + Math.sin(i * 0.1) * 2;
            list.push({
                id: `stress-${i}`,
                textureId: (i % 2 === 0) ? "back" : "red_0",
                position: [Math.cos(angle) * r, Math.sin(angle) * r, -1 + (i * 0.001)],
                rotationZ: angle,
                faceUp: i % 2 !== 0,
                scale: 0.5,
            });
        }
    }

    if (!state) return list;

    // 2. Draw pile (stack of backs)
    const deckCount = clamp(state.deckCount, 0, 15);
    for (let i = 0; i < deckCount; i++) {
      list.push({
        id: `deck-${i}`,
        textureId: "back",
        position: [-L.pileX, i * 0.015, 0],
        rotationZ: 0,
        faceUp: false,
        scale: L.pileScale,
      });
    }

    // 3. Discard pile
    state.discardPile.forEach((card: CardSchema, i: number) => {
      const isTop = i === state.discardPile.length - 1;
      const isShowcase = showcaseCardId === card.id;
      if (isShowcase) return; // handled separately

      list.push({
        id: card.id,
        textureId: cardTextureFromSchema(card),
        position: [L.pileX, i * 0.01, 0.05 + i * 0.001],
        rotationZ: hashRotation(card.id, i),
        faceUp: true,
        scale: L.discardScale,
        highlight: isTop && state.currentPlayer === localSeatIndex,
      });
    });

    // 4. Showcase card (flying to pile)
    if (showcaseCardId) {
      const card = (state.discardPile as CardSchema[]).find(c => c.id === showcaseCardId);
      if (card) {
        list.push({
          id: `showcase-${card.id}`,
          textureId: cardTextureFromSchema(card),
          position: [L.pileX, 0.1, 1.5],
          rotationZ: 0,
          faceUp: true,
          scale: L.discardScale * 1.5,
          shake: true,
        });
      }
    }

    // 5. Players' hands
    playersByVisualPos.forEach(({ player, visualPos }) => {
      const isLocal = visualPos === 0;
      const count = isLocal ? localHand.length : player.handCount;
      const spacing = isLocal ? L.playerSpacing : 0.25;
      const scale = isLocal ? L.playerScale : L.playerScale * 0.7;

      for (let i = 0; i < count; i++) {
        const card = isLocal ? localHand[i] : null;
        const id = card ? card.id : `${player.sessionId}-${i}`;
        const center = i - (count - 1) / 2;

        let x = 0, y = 0, z = 0, rotZ = 0;
        if (visualPos === 0) {
          x = center * spacing;
          y = L.bottomY - Math.abs(center) * 0.03;
          z = 0.5 + i * 0.01;
          rotZ = -center * 0.03;
        } else if (visualPos === 1) {
          x = -L.sideX;
          y = center * spacing;
          z = 0.2 + i * 0.01;
          rotZ = Math.PI / 2;
        } else if (visualPos === 2) {
          x = -center * spacing;
          y = L.topY;
          z = 0.2 + i * 0.01;
          rotZ = Math.PI;
        } else if (visualPos === 3) {
          x = L.sideX;
          y = -center * spacing;
          z = 0.2 + i * 0.01;
          rotZ = -Math.PI / 2;
        }

        const isHovered = hoveredCard === id;
        const isSelected = isLocal && playableSet.has(id) && localHand.filter(c => playableSet.has(c.id)).indexOf(card!) === selectedCardIndex;

        list.push({
          id: id,
          textureId: card ? cardTextureFromSchema(card) : "back",
          position: [x, y, (isHovered || isSelected) ? z + 0.3 : z],
          rotationZ: rotZ,
          faceUp: isLocal,
          scale: (isHovered || isSelected) ? scale * 1.15 : scale,
          highlight: isLocal && playableSet.has(id),
          shake: invalidMoveCard === id,
          selected: isSelected,
        });
      }
    });

    return list;
  }, [
    state,
    L,
    localHand,
    localSeatIndex,
    playersByVisualPos,
    showcaseCardId,
    hoveredCard,
    playableSet,
    selectedCardIndex,
    invalidMoveCard,
    stressTestCount,
  ]);

  const activeColor = state
    ? (state.activeColor as UnoColor) || "red"
    : "red";

  if (!state || !room) return null;

  return (
    <group>
      <Table />

      {state.phase === "playing" && (
        <AnimatedRing
          color={COLOR_HEX[activeColor]}
          innerRadius={0.55 * L.discardScale}
          outerRadius={0.62 * L.discardScale}
          position={[L.pileX, 0, 0.49]}
        />
      )}

      {state.phase === "playing" && state.winner === -1 && (
        <TurnIndicator
          activePlayerIndex={state.activePlayerIndex}
          reverse={state.reverse}
        />
      )}

      <InstancedCards cards={cards} />

      {!showcaseCardId &&
        state.currentPlayer === localSeatIndex &&
        state.winner === -1 &&
        localHand.map((card: CardSchema, i: number) => {
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
        })}

      {!showcaseCardId &&
        !colorPickerFor &&
        state.currentPlayer === localSeatIndex &&
        state.winner === -1 && (
          <mesh
            position={[-L.pileX, 0, 0.05]}
            onClick={(e) => {
              e.stopPropagation();
              if (actionCooldown.current) return;
              actionCooldown.current = true;
              setTimeout(() => { actionCooldown.current = false; }, 300);
              drawCardSound();
              room.send("draw_card");
            }}
            onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
            onPointerLeave={() => { document.body.style.cursor = "auto"; }}
          >
            <planeGeometry args={[L.pileScale * 1.5, L.pileScale * 2.2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

      {colorPickerFor && (
        <ColorPicker
          hoveredPickerColor={hoveredPickerColor}
          onPickColor={onPickColor}
          onHoverColor={setHoveredPickerColor}
        />
      )}

      {state.winner !== -1 && (
        <mesh position={[0, 0, 3]}>
          <planeGeometry args={[25, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
