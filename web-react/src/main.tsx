import "./index.css";
import { Client, Room } from "@colyseus/sdk";
import React, { Component, ReactNode, useMemo, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { canPlaySchema, cardTextureFromSchema } from "../../shared/index.ts";

type Mode = "lobby" | "joining" | "table";
type UnoColor = "red" | "yellow" | "green" | "blue";

interface CardSchema {
  id: string;
  cardType: "color" | "wild";
  color: string;
  value: string;
  chosenColor?: string;
}

interface PlayerSchema {
  sessionId: string;
  seatIndex: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  hand?: CardSchema[];
  handCount: number;
}

interface ChatMessageSchema {
  sender: string;
  text: string;
  timestamp: number;
}

interface UnoState {
  players?: Map<string, PlayerSchema> | Record<string, PlayerSchema>;
  discardPile?: CardSchema[];
  drawPileCount?: number;
  deckCount?: number;
  currentPlayer?: number;
  direction?: number;
  activeColor?: string;
  pendingDraw?: number;
  winner?: number;
  phase?: string;
  spectatorCount?: number;
  chatMessages?: ChatMessageSchema[];
  unoCaller?: number;
  rematchVotes?: number[];
  turnDeadline?: number;
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
const client = new Client(WS_URL);
const colors: UnoColor[] = ["red", "yellow", "green", "blue"];

const ATLAS_ORDER = [
  "red_0",
  "red_1",
  "red_2",
  "red_3",
  "red_4",
  "red_5",
  "red_6",
  "red_7",
  "red_8",
  "red_9",
  "red_skip",
  "red_reverse",
  "red_draw2",
  "blue_0",
  "blue_1",
  "blue_2",
  "blue_3",
  "blue_4",
  "blue_5",
  "blue_6",
  "blue_7",
  "blue_8",
  "blue_9",
  "blue_skip",
  "blue_reverse",
  "blue_draw2",
  "green_0",
  "green_1",
  "green_2",
  "green_3",
  "green_4",
  "green_5",
  "green_6",
  "green_7",
  "green_8",
  "green_9",
  "green_skip",
  "green_reverse",
  "green_draw2",
  "yellow_0",
  "yellow_1",
  "yellow_2",
  "yellow_3",
  "yellow_4",
  "yellow_5",
  "yellow_6",
  "yellow_7",
  "yellow_8",
  "yellow_9",
  "yellow_skip",
  "yellow_reverse",
  "yellow_draw2",
  "wild",
  "wild_draw4",
  "back",
];

// ── Premium Avatar Icons Design Constants ─────────────────────────────────
const AVATAR_SYMBOLS = [
  { id: "tiger", emoji: "🐯", name: "Neon Tiger" },
  { id: "dragon", emoji: "🐲", name: "Cosmic Dragon" },
  { id: "phoenix", emoji: "🦅", name: "Golden Phoenix" },
  { id: "panda", emoji: "🐼", name: "Shadow Panda" },
  { id: "wolf", emoji: "🐺", name: "Alpha Wolf" },
  { id: "owl", emoji: "🦉", name: "Cyber Owl" },
  { id: "fox", emoji: "🦊", name: "Spectral Fox" },
  { id: "shark", emoji: "🦈", name: "Deep Shark" },
];

const AVATAR_THEMES = [
  { id: "rose", name: "Neon Rose", primary: "hsl(358, 75%, 55%)", secondary: "hsl(340, 75%, 45%)" },
  {
    id: "sapphire",
    name: "Electric Sapphire",
    primary: "hsl(208, 85%, 52%)",
    secondary: "hsl(220, 80%, 42%)",
  },
  {
    id: "aurora",
    name: "Emerald Aurora",
    primary: "hsl(148, 65%, 45%)",
    secondary: "hsl(160, 60%, 35%)",
  },
  { id: "sol", name: "Golden Sol", primary: "hsl(46, 95%, 55%)", secondary: "hsl(35, 90%, 45%)" },
  {
    id: "nebula",
    name: "Purple Nebula",
    primary: "hsl(280, 75%, 55%)",
    secondary: "hsl(260, 70%, 45%)",
  },
];

// ── Pure Web Audio Synthesizer for Immersive Sounds ────────────────────────
/* global OscillatorNode, GainNode */
class SoundFX {
  private ctx: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  // eslint-disable-next-line no-undef
  private ambientOscs: OscillatorNode[] = [];
  // eslint-disable-next-line no-undef
  private ambientGain: GainNode | null = null;

  private init() {
    if (this.ctx) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  setVolume(vol: number) {
    this.volume = vol;
    this.updateAmbientVolume();
  }

  setMuted(mute: boolean) {
    this.muted = mute;
    this.updateAmbientVolume();
  }

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  private getGainMultiplier() {
    return this.muted ? 0 : this.volume;
  }

  private updateAmbientVolume() {
    if (this.ambientGain && this.ctx) {
      const mult = this.getGainMultiplier();
      this.ambientGain.gain.setTargetAtTime(0.015 * mult, this.ctx.currentTime, 0.15);
    }
  }

  startAmbientHum() {
    this.init();
    if (!this.ctx) return;
    if (this.ambientOscs.length > 0) return;

    const mult = this.getGainMultiplier();
    const now = this.ctx.currentTime;

    const gainNode = this.ctx.createGain();
    gainNode.connect(this.ctx.destination);
    gainNode.gain.setValueAtTime(0.015 * mult, now);
    this.ambientGain = gainNode;

    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(82.41, now); // E2 hum
    osc1.connect(gainNode);

    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(123.47, now); // B2 hum
    osc2.connect(gainNode);

    osc1.start(now);
    osc2.start(now);
    this.ambientOscs = [osc1, osc2];
  }

  stopAmbientHum() {
    this.ambientOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* oscillator already stopped */
      }
    });
    this.ambientOscs = [];
    this.ambientGain = null;
  }

  playShuffle() {
    this.init();
    if (!this.ctx) return;
    const mult = this.getGainMultiplier();
    if (mult <= 0) return;
    const now = this.ctx.currentTime;

    // Tactile deck riffling sequence
    for (let i = 0; i < 8; i++) {
      const start = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(170 - i * 10, start);
      osc.frequency.exponentialRampToValueAtTime(360 + i * 20, start + 0.05);

      gain.gain.setValueAtTime(0.06 * mult, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);

      osc.start(start);
      osc.stop(start + 0.05);
    }
  }

  playSwish() {
    this.init();
    if (!this.ctx) return;
    const mult = this.getGainMultiplier();
    if (mult <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);

    gain.gain.setValueAtTime(0.12 * mult, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.start();
    osc.stop(now + 0.14);
  }

  playPluck() {
    this.init();
    if (!this.ctx) return;
    const mult = this.getGainMultiplier();
    if (mult <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);

    gain.gain.setValueAtTime(0.18 * mult, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start();
    osc.stop(now + 0.1);
  }

  playChime() {
    this.init();
    if (!this.ctx) return;
    const mult = this.getGainMultiplier();
    if (mult <= 0) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now); // G5
    osc2.frequency.setValueAtTime(1046.5, now + 0.08); // C6

    gain.gain.setValueAtTime(0.14 * mult, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc1.start();
    osc2.start();
    osc1.stop(now + 0.32);
    osc2.stop(now + 0.32);
  }

  playTurnAlert() {
    this.init();
    if (!this.ctx) return;
    const mult = this.getGainMultiplier();
    if (mult <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.setValueAtTime(440.0, now + 0.08); // A4

    gain.gain.setValueAtTime(0.12 * mult, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.start();
    osc.stop(now + 0.22);
  }
}
const sfx = new SoundFX();

// Load sound volume preferences
try {
  const savedVol = localStorage.getItem("uno_volume");
  if (savedVol !== null) sfx.setVolume(parseFloat(savedVol));
  const savedMuted = localStorage.getItem("uno_muted");
  if (savedMuted === "true") sfx.setMuted(true);
} catch {
  // Ignored
}

// ── Offline Match Stats Local Storage Helpers ──────────────────────────────
interface MatchHistoryEntry {
  id: string;
  timestamp: number;
  win: boolean;
  winnerName: string;
  cardsPlayed: number;
  durationSec: number;
  opponentNames: string[];
}
interface GameStats {
  played: number;
  wins: number;
  losses: number;
  cardsPlayed: number;
  botKnockouts: number;
  history?: MatchHistoryEntry[];
}

function getStats(): GameStats {
  const defaults = { played: 0, wins: 0, losses: 0, cardsPlayed: 0, botKnockouts: 0, history: [] };
  try {
    const raw = localStorage.getItem("uno_stats");
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function updateStats(
  win: boolean,
  cards: number,
  botKills: number,
  winnerName: string = "Winner",
  durationSec: number = 0,
  opponents: string[] = [],
) {
  try {
    const curr = getStats();
    curr.played += 1;
    if (win) curr.wins += 1;
    else curr.losses += 1;
    curr.cardsPlayed += cards;
    curr.botKnockouts += botKills;

    if (!curr.history) curr.history = [];
    curr.history.unshift({
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      win,
      winnerName,
      cardsPlayed: cards,
      durationSec,
      opponentNames: opponents,
    });
    if (curr.history.length > 10) {
      curr.history = curr.history.slice(0, 10);
    }
    localStorage.setItem("uno_stats", JSON.stringify(curr));
  } catch {
    // Ignored
  }
}

// ── Avatar Name Serialization Helpers ─────────────────────────────────────
function parsePlayerName(rawName: string) {
  const match = rawName.match(/^\[av-([a-z0-9]+)-([a-z0-9]+)\](.*)$/);
  if (match) {
    return {
      symbol: match[1],
      theme: match[2],
      name: match[3],
    };
  }
  const botMatch = rawName.match(/^Bot\s+(\d+)$/i);
  if (botMatch) {
    const num = parseInt(botMatch[1], 10);
    const symbols = ["fox", "owl", "panda", "wolf"];
    const themes = ["rose", "sapphire", "aurora", "sol"];
    return {
      symbol: symbols[(num - 1) % symbols.length],
      theme: themes[(num - 1) % themes.length],
      name: rawName,
    };
  }
  return {
    symbol: "tiger",
    theme: "rose",
    name: rawName,
  };
}

// ── Deterministic Overlay Pile Rotations ────────────────────────────────────
function getDeterministicRotation(index: number) {
  const rotations = [-6, 8, -3, 5, -7, 4, -8, 2, -1, 6, -5, 3, -4, 7, -2, 9];
  return rotations[index % rotations.length];
}
function getDeterministicOffsetX(index: number) {
  const offsets = [-3, 5, -2, 3, -5, 1, -4, 2, -1, 4, -3, 0, -4, 4, -1, 2];
  return offsets[index % offsets.length];
}
function getDeterministicOffsetY(index: number) {
  const offsets = [1, -5, 3, -2, 4, -3, 5, -4, 0, -4, 2, -1, 3, -5, 1, -2];
  return offsets[index % offsets.length];
}

function schemaValues<T>(raw: unknown): T[] {
  if (!raw) return [];
  const collected: T[] = [];
  const maybeCollection = raw as {
    forEach?: Function;
    values?: () => IterableIterator<T>;
    length?: number;
  };

  if (typeof maybeCollection.forEach === "function") {
    maybeCollection.forEach((value: T) => collected.push(value));
    return collected;
  }

  if (typeof maybeCollection.values === "function") {
    return Array.from(maybeCollection.values());
  }

  if (Array.isArray(raw)) return raw as T[];

  return Object.values(raw as Record<string, T>).filter(Boolean);
}

function snapshotState(next: UnoState): UnoState {
  return {
    players: Object.fromEntries(
      schemaValues<PlayerSchema>(next.players).map((player) => [String(player.seatIndex), player]),
    ),
    discardPile: schemaValues<CardSchema>(next.discardPile),
    drawPileCount: next.drawPileCount,
    deckCount: next.deckCount,
    currentPlayer: next.currentPlayer,
    direction: next.direction,
    activeColor: next.activeColor,
    pendingDraw: next.pendingDraw,
    winner: next.winner,
    phase: next.phase,
    spectatorCount: next.spectatorCount,
    chatMessages: schemaValues<ChatMessageSchema>(next.chatMessages),
    unoCaller: next.unoCaller,
    rematchVotes: schemaValues<number>(next.rematchVotes),
    turnDeadline: next.turnDeadline,
  };
}

function statePlayers(state: UnoState | null): PlayerSchema[] {
  return schemaValues<PlayerSchema>(state?.players).sort((a, b) => a.seatIndex - b.seatIndex);
}

function localPlayer(room: Room<UnoState> | null, state: UnoState | null) {
  if (!room) return null;
  return statePlayers(state).find((player) => player.sessionId === room.sessionId) ?? null;
}

function cardLabel(card: CardSchema | null | undefined) {
  if (!card) return "Empty";
  if (card.cardType === "wild") return card.value === "wild_draw4" ? "Wild +4" : "Wild";
  const value =
    card.value === "draw2"
      ? "+2"
      : card.value === "reverse"
        ? "Reverse"
        : card.value === "skip"
          ? "Skip"
          : card.value;
  return `${card.color} ${value}`;
}

function isPlayable(card: CardSchema, state: UnoState | null, hand: CardSchema[] = []) {
  const pile = state?.discardPile ?? [];
  const top = pile[pile.length - 1];
  if (!top) return false;
  const basicPlayable = canPlaySchema(
    card,
    top,
    state?.activeColor || "red",
    state?.pendingDraw || 0,
  );
  if (!basicPlayable) return false;

  // Enforce Wild Draw Four rule: player may only play wild_draw4 if they have NO
  // other valid color cards matching activeColor, or cards matching top card's value.
  if (card.cardType === "wild" && card.value === "wild_draw4") {
    const activeColor = state?.activeColor || "red";
    const pendingDraw = state?.pendingDraw || 0;
    const hasMatchingColor = hand.some((c) => c.cardType === "color" && c.color === activeColor);
    const hasMatchingValue =
      top.cardType === "color" && hand.some((c) => c.cardType === "color" && c.value === top.value);
    // If pendingDraw > 0, draw4 stacking is valid
    const canStack = pendingDraw >= 4;
    if ((hasMatchingColor || hasMatchingValue) && !canStack) {
      return false;
    }
  }
  return true;
}

// ── Custom Card rendering Component mapping to texture atlas ──────────────
interface CardAtlasViewProps {
  card: CardSchema | null;
  isBack?: boolean;
  colorblind?: boolean;
}

function CardAtlasView({ card, isBack = false, colorblind = false }: CardAtlasViewProps) {
  const textureId = isBack || !card ? "back" : cardTextureFromSchema(card);
  const index = ATLAS_ORDER.indexOf(textureId);
  const col = index !== -1 ? index % 10 : 54;
  const row = index !== -1 ? Math.floor(index / 10) : 5;

  const isCardBack = isBack || !card;

  let symbol = "";
  let label = "";
  if (colorblind && !isCardBack && card) {
    const activeColor = (card.cardType === "wild" ? card.chosenColor : card.color)?.toLowerCase();
    if (activeColor === "red") {
      symbol = "▲";
      label = "RED";
    } else if (activeColor === "blue") {
      symbol = "■";
      label = "BLUE";
    } else if (activeColor === "green") {
      symbol = "●";
      label = "GREEN";
    } else if (activeColor === "yellow") {
      symbol = "★";
      label = "YEL";
    }
  }

  return (
    <div
      className={`card-sprite ${isCardBack ? "card-back" : ""}`}
      style={{ "--col": col, "--row": row } as React.CSSProperties}
      title={isBack ? "UNO Card Back" : cardLabel(card)}
    >
      {symbol && (
        <div className={`card-colorblind-overlay ${card?.color || card?.chosenColor || ""}`}>
          <span className="cb-symbol">{symbol}</span>
          <span className="cb-label">{label}</span>
        </div>
      )}
    </div>
  );
}

// ── Avatar Renderer Component ──────────────────────────────────────────────
interface AvatarIconProps {
  symbol: string;
  theme: string;
  size?: number;
  glow?: boolean;
}

function AvatarIcon({ symbol, theme, size = 48, glow = true }: AvatarIconProps) {
  const symInfo = AVATAR_SYMBOLS.find((s) => s.id === symbol) || AVATAR_SYMBOLS[0];
  const themeInfo = AVATAR_THEMES.find((t) => t.id === theme) || AVATAR_THEMES[0];

  return (
    <div
      className={`avatar-circle ${glow ? "avatar-glow" : ""}`}
      style={
        {
          width: `${size}px`,
          height: `${size}px`,
          "--avatar-primary": themeInfo.primary,
          "--avatar-secondary": themeInfo.secondary,
        } as React.CSSProperties
      }
    >
      <div className="avatar-background" />
      <span className="avatar-emoji" style={{ fontSize: `${size * 0.5}px` }}>
        {symInfo.emoji}
      </span>
      <svg className="avatar-ring" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={`url(#grad-${themeInfo.id})`}
          strokeWidth="4"
        />
        <defs>
          <linearGradient id={`grad-${themeInfo.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themeInfo.primary} />
            <stop offset="100%" stopColor={themeInfo.secondary} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ── SVG Circular Turn Progress Timer ────────────────────────────────────────
function TurnTimerRing({
  active,
  turnDeadline,
}: {
  active: boolean;
  turnDeadline: number | undefined;
}) {
  const [pct, setPct] = useState(100);
  const [critical, setCritical] = useState(false);

  useEffect(() => {
    if (!active || !turnDeadline) {
      setPct(0);
      setCritical(false);
      return;
    }

    const start = Date.now();
    const total = Math.max(1000, turnDeadline - start);

    let frame: number;
    const update = () => {
      const now = Date.now();
      const remaining = turnDeadline - now;
      const newPct = Math.max(0, Math.min(100, (remaining / total) * 100));
      setPct(newPct);
      setCritical(remaining < 2500);

      if (remaining > 0) {
        frame = requestAnimationFrame(update);
      }
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active, turnDeadline]);

  if (!active) return null;

  const strokeWidth = 3;
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg
      className={`turn-timer-svg ${critical ? "critical" : ""}`}
      width="52"
      height="52"
      viewBox="0 0 52 52"
    >
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        stroke={critical ? "var(--card-red)" : "var(--gold)"}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.2s ease" }}
      />
    </svg>
  );
}

// ── Audio Settings Dashboard Widget ─────────────────────────────────────────
function AudioSettingsPanel() {
  const [vol, setVol] = useState(() => sfx.getVolume());
  const [muted, setMuted] = useState(() => sfx.isMuted());

  const handleVolChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setVol(value);
    sfx.setVolume(value);
    localStorage.setItem("uno_volume", String(value));
  };

  const handleMuteToggle = () => {
    const isMutedNow = !muted;
    setMuted(isMutedNow);
    sfx.setMuted(isMutedNow);
    localStorage.setItem("uno_muted", isMutedNow ? "true" : "false");
  };

  return (
    <div className="audio-controls-panel">
      <button
        className="audio-btn-toggle"
        onClick={handleMuteToggle}
        type="button"
        aria-label="Toggle Mute"
      >
        {muted || vol === 0 ? "🔇" : "🔊"}
      </button>
      <div className="volume-slider-container">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={vol}
          onChange={handleVolChange}
          className="volume-slider"
          aria-label="Volume level"
        />
        <span>{Math.round(vol * 100)}%</span>
      </div>
      <button
        className="ghost-btn"
        style={{ height: "32px", fontSize: "11px", padding: "0 8px" }}
        onClick={() => sfx.playPluck()}
        type="button"
      >
        Test Sound
      </button>
    </div>
  );
}

// ── Connection Ping Quality Visualizer ──────────────────────────────────────
function PingVisualizer({ ping }: { ping: number | null }) {
  if (ping === null) return null;
  const status = ping < 100 ? "excellent" : ping < 250 ? "good" : "poor";
  return (
    <div className={`ping-indicator ${status}`} title={`WebSocket latency RTT: ${ping}ms`}>
      <div className="ping-bars">
        <div className="ping-bar" />
        <div className="ping-bar" />
        <div className="ping-bar" />
      </div>
      <span>{ping}ms ping</span>
    </div>
  );
}

// ── SVG Play Direction Ring spinner ───────────────────────────────────────
function PlayDirectionRing({ direction }: { direction: number }) {
  const isClockwise = direction !== -1;
  return (
    <div className="direction-ring-container">
      <svg width="100%" height="100%" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="transparent" stopOpacity="0" />
            <stop offset="90%" stopColor="var(--gold)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="url(#ringGlow)" />
        <circle
          cx="100"
          cy="100"
          r="84"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeDasharray="6 12"
          strokeOpacity="0.3"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={isClockwise ? "0 100 100" : "360 100 100"}
            to={isClockwise ? "360 100 100" : "0 100 100"}
            dur="20s"
            repeatCount="indefinite"
          />
        </circle>
        {/* Glowing Arrow pointers showing direction flow */}
        <g transform="translate(100, 100)">
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={isClockwise ? "0" : "360"}
              to={isClockwise ? "360" : "0"}
              dur="8s"
              repeatCount="indefinite"
            />
            {isClockwise ? (
              <>
                <path
                  d="M 0,-88 L 8,-80 L 0,-72"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                />
                <path d="M 88,0 L 80,8 L 72,0" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path
                  d="M 0,88 L -8,80 L 0,72"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                />
                <path
                  d="M -88,0 L -80,-8 L -72,0"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                />
              </>
            ) : (
              <>
                <path
                  d="M 0,-88 L -8,-80 L 0,-72"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                />
                <path
                  d="M 88,0 L 80,-8 L 72,0"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                />
                <path d="M 0,88 L 8,80 L 0,72" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path
                  d="M -88,0 L -80,8 L -72,0"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.5"
                />
              </>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}

// ── Lobby component ────────────────────────────────────────────────────────
interface LobbyProps {
  busy: boolean;
  error: string;
  // eslint-disable-next-line no-unused-vars
  onQuickPlay: (options: Record<string, unknown>) => void;
  // eslint-disable-next-line no-unused-vars
  onJoinCode: (roomId: string, options: Record<string, unknown>) => void;
  // eslint-disable-next-line no-unused-vars
  onWatch: (roomId: string) => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
}

function Lobby({
  busy,
  error,
  onQuickPlay,
  onJoinCode,
  onWatch,
  colorblindMode,
  onToggleColorblind,
}: LobbyProps) {
  const [name, setName] = useState(() => {
    const raw = localStorage.getItem("uno_nickname") || "";
    return parsePlayerName(raw).name;
  });
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // Custom visual avatar choices
  const [avatarSymbol, setAvatarSymbol] = useState(
    () => localStorage.getItem("uno_av_symbol") || "tiger",
  );
  const [avatarTheme, setAvatarTheme] = useState(
    () => localStorage.getItem("uno_av_theme") || "rose",
  );

  const trimmedName = name.trim();
  const validName = trimmedName.length >= 2 && trimmedName.length <= 16;

  // eslint-disable-next-line no-unused-vars
  const handleStart = (action: (options: Record<string, unknown>) => void) => {
    localStorage.setItem("uno_av_symbol", avatarSymbol);
    localStorage.setItem("uno_av_theme", avatarTheme);
    localStorage.setItem("uno_nickname", trimmedName);

    // Serialize avatar into player nickname
    const serializedName = `[av-${avatarSymbol}-${avatarTheme}]${trimmedName}`;
    action({
      name: serializedName,
      private: privateRoom,
      difficulty,
      password: password || undefined,
    });
  };

  return (
    <main className="lobby-shell">
      <section className="brand-panel" aria-label="Wild Table preview">
        <div className="table-sculpture">
          <div className="table-rail" />
          <div className="table-felt-mini" />
          <div className="lobby-hero-hand">
            {["red", "blue", "yellow", "green", "wild"].map((color, index) => {
              const fileKey = color === "wild" ? "wild" : `${color}_5`;
              const tileIdx = ATLAS_ORDER.indexOf(fileKey);
              const col = tileIdx !== -1 ? tileIdx % 10 : 52;
              const row = tileIdx !== -1 ? Math.floor(tileIdx / 10) : 5;
              return (
                <div
                  key={color}
                  className="lobby-hero-card card-sprite"
                  style={
                    {
                      "--i": index,
                      "--col": col,
                      "--row": row,
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>
        </div>
        <div className="brand-copy" style={{ zIndex: 10 }}>
          <h1>Wild Table</h1>
          <p>
            An elegant, high-fidelity real-time card table. Seamless turns, live spectators, and
            smooth glassmorphic interfaces.
          </p>
        </div>
      </section>

      <section className="join-panel" aria-label="Join game">
        <div className="panel-header">
          <span>Multiplayer Table</span>
          <strong>
            {busy ? (
              <span className="connecting-spinner">
                <span className="spinner-ring" /> Connecting...
              </span>
            ) : (
              "Ready"
            )}
          </strong>
        </div>

        <label className="field">
          <span>Player nickname</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            maxLength={16}
            autoFocus
          />
        </label>

        {/* ── Premium Avatar Creator Component ────────────────────────────── */}
        <div className="avatar-creator-panel">
          <span>Customize Avatar</span>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <AvatarIcon symbol={avatarSymbol} theme={avatarTheme} size={64} glow />
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
              <div className="avatar-grid-picker">
                {AVATAR_SYMBOLS.map((sym) => (
                  <button
                    key={sym.id}
                    className={`avatar-picker-btn ${avatarSymbol === sym.id ? "active" : ""}`}
                    onClick={() => {
                      setAvatarSymbol(sym.id);
                      sfx.playPluck();
                    }}
                    type="button"
                    title={sym.name}
                  >
                    {sym.emoji}
                  </button>
                ))}
              </div>
              <div className="theme-grid-picker">
                {AVATAR_THEMES.map((th) => (
                  <button
                    key={th.id}
                    className={`theme-picker-btn ${avatarTheme === th.id ? "active" : ""}`}
                    style={{ "--theme-color-highlight": th.primary } as React.CSSProperties}
                    onClick={() => {
                      setAvatarTheme(th.id);
                      sfx.playPluck();
                    }}
                    type="button"
                  >
                    {th.name.split(" ")[1]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="field">
          <span>Match options</span>
          <div className="control-row">
            <button
              className={privateRoom ? "chip active" : "chip"}
              onClick={() => setPrivateRoom((value) => !value)}
              type="button"
            >
              Private: {privateRoom ? "On" : "Off"}
            </button>
            {(["easy", "medium", "hard"] as const).map((level) => (
              <button
                key={level}
                className={difficulty === level ? "chip active" : "chip"}
                onClick={() => setDifficulty(level)}
                type="button"
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {privateRoom && (
          <label className="field">
            <span>Room password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Optional table password"
              type="password"
              maxLength={32}
            />
          </label>
        )}

        <button
          className={`primary-btn ${busy ? "loading" : ""}`}
          disabled={!validName || busy}
          onClick={() => handleStart(onQuickPlay)}
          type="button"
        >
          {busy ? "Connecting..." : "Create Table"}
        </button>

        <div className="join-grid">
          <label className="field compact">
            <span>Invite code</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              placeholder="Room Code"
            />
          </label>
          <button
            className="secondary-btn"
            disabled={!roomCode.trim() || !validName || busy}
            onClick={() => handleStart((opts) => onJoinCode(roomCode.trim(), opts))}
            type="button"
          >
            Enter
          </button>
          <button
            className="secondary-btn"
            disabled={!roomCode.trim() || busy}
            onClick={() => onWatch(roomCode.trim())}
            type="button"
          >
            Watch
          </button>
        </div>

        {/* ── Offline Match Stats Display ────────────────────────────────── */}
        <div style={{ marginTop: "8px" }}>
          <StatsDashboard />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "16px",
            marginTop: "6px",
            flexWrap: "wrap",
          }}
        >
          <AudioSettingsPanel />
          <button
            className={`accessibility-toggle-btn ${colorblindMode ? "active" : ""}`}
            onClick={onToggleColorblind}
            type="button"
          >
            ♿ Colorblind Mode: {colorblindMode ? "On" : "Off"}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}

// ── Roster Stats Dashboard Widget ──────────────────────────────────────────
function StatsDashboard() {
  const stats = getStats();
  if (stats.played === 0) return null;
  return (
    <div className="stats-dashboard">
      <h3>Hall of Fame Stats</h3>
      <div className="stats-grid">
        <div className="stat-badge">
          <span>Played</span>
          <strong>{stats.played}</strong>
        </div>
        <div className="stat-badge">
          <span>Wins</span>
          <strong>{stats.wins}</strong>
        </div>
        <div className="stat-badge">
          <span>Win Rate</span>
          <strong>
            {stats.played > 0 ? `${Math.round((stats.wins / stats.played) * 100)}%` : "0%"}
          </strong>
        </div>
      </div>

      {stats.history && stats.history.length > 0 && (
        <div
          className="history-section"
          style={{
            marginTop: "16px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <h4
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            Recent Matches
          </h4>
          <div
            className="history-list"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              maxHeight: "180px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {stats.history.map((entry) => (
              <div
                key={entry.id}
                className="history-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <strong
                    style={{
                      color: entry.win ? "var(--gold)" : "var(--card-red)",
                      fontSize: "12px",
                    }}
                  >
                    {entry.win ? "Victory 🏆" : "Defeat 💀"}
                  </strong>
                  <span style={{ color: "var(--text-faint)", fontSize: "10px" }}>
                    Winner: {parsePlayerName(entry.winnerName).name} •{" "}
                    {Math.round(entry.durationSec)}s
                  </span>
                  {entry.opponentNames && entry.opponentNames.length > 0 && (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "9px",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        maxWidth: "180px",
                      }}
                    >
                      VS: {entry.opponentNames.map((name) => parsePlayerName(name).name).join(", ")}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <strong>{entry.cardsPlayed} cards</strong>
                  <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Opponent strip list ──────────────────────────────────────────────────
interface PlayerStripProps {
  players: PlayerSchema[];
  activeSeat: number;
  turnDeadline: number | undefined;
}

function PlayerStrip({ players, activeSeat, turnDeadline }: PlayerStripProps) {
  return (
    <>
      {players.map((player) => {
        const active = player.seatIndex === activeSeat;
        const av = parsePlayerName(player.name);
        return (
          <article
            className={`player-pill ${active ? "active" : ""} ${player.isBot ? "is-bot" : ""}`}
            key={player.sessionId}
          >
            <div className="avatar-wrapper-pill" style={{ position: "relative" }}>
              <AvatarIcon symbol={av.symbol} theme={av.theme} size={44} glow={active} />
              <TurnTimerRing active={active} turnDeadline={turnDeadline} />
            </div>
            <div
              className="player-pill-info"
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <span>
                {player.isBot ? "Bot Seat" : "Player Seat"} {player.seatIndex + 1}
              </span>
              <strong
                style={{
                  maxWidth: "100px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {av.name}
              </strong>
              <small>{player.handCount ?? player.hand?.length ?? 0} Cards</small>
            </div>
          </article>
        );
      })}
    </>
  );
}

// ── Winner Podium Screen replacing winner-card ─────────────────────────────
interface WinnerPodiumProps {
  room: Room<UnoState> | null;
  state: UnoState | null;
  players: PlayerSchema[];
  winnerSeat: number;
  meSeatIndex: number | undefined;
}

function WinnerPodium({ room, state, players, winnerSeat, meSeatIndex }: WinnerPodiumProps) {
  const winner = players.find((p) => p.seatIndex === winnerSeat);
  const winAv = winner ? parsePlayerName(winner.name) : null;
  const votes = state?.rematchVotes ?? [];
  const humans = players.filter((p) => !p.isBot && p.connected);

  return (
    <div className="winner-podium-overlay">
      <div className="winner-podium-box">
        <div className="podium-pedestal">
          <div className="podium-crown">👑</div>
          {winAv && <AvatarIcon symbol={winAv.symbol} theme={winAv.theme} size={84} glow />}
          <h1
            style={{ marginTop: "16px", fontSize: "26px", color: "var(--gold)", fontWeight: 900 }}
          >
            {winAv?.name} Wins!
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Ultimate Card Champion
          </p>
        </div>

        <div className="rematch-voters-list">
          <h3
            style={{
              color: "var(--text-muted)",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            Rematch Votes ({votes.length} / {humans.length})
          </h3>
          {humans.map((player) => {
            const voted = votes.includes(player.seatIndex);
            return (
              <div className="rematch-voter-row" key={player.sessionId}>
                <span>
                  {parsePlayerName(player.name).name}{" "}
                  {player.seatIndex === meSeatIndex ? "(You)" : ""}
                </span>
                <strong style={{ color: voted ? "#4da66d" : "var(--text-faint)" }}>
                  {voted ? "READY ✅" : "WAITING... ⏳"}
                </strong>
              </div>
            );
          })}
        </div>

        <button
          className="primary-btn"
          style={{ width: "100%" }}
          onClick={() => room?.send("vote_rematch")}
          type="button"
        >
          Vote Rematch
        </button>
      </div>
    </div>
  );
}

// ── Ambient Floating Stardust Particle Generator ──────────────────────────
interface StardustParticle {
  id: string;
  left: string;
  delay: string;
  duration: string;
  size: string;
  color: string;
}

function AmbientStardust() {
  const [dots, setDots] = useState<StardustParticle[]>([]);

  useEffect(() => {
    const initialDots: StardustParticle[] = Array.from({ length: 18 }).map((_, i) => {
      const isViolet = Math.random() > 0.5;
      const color = isViolet ? "hsla(280, 75%, 65%, 0.15)" : "hsla(46, 95%, 65%, 0.12)";
      return {
        id: `${i}-${Math.random()}`,
        left: `${5 + Math.random() * 90}%`,
        delay: `${Math.random() * -12}s`, // pre-start so they don't pop-in together
        duration: `${8 + Math.random() * 10}s`,
        size: `${2 + Math.random() * 4}px`,
        color,
      };
    });
    setDots(initialDots);
  }, []);

  return (
    <div className="ambient-stardust-container">
      {dots.map((d) => (
        <div
          key={d.id}
          className="stardust-particle"
          style={
            {
              left: d.left,
              animationDelay: d.delay,
              animationDuration: d.duration,
              width: d.size,
              height: d.size,
              background: d.color,
              boxShadow: `0 0 10px ${d.color}`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ── Enriched HandCardItem component for mount animations & 3D tilt ────────
interface HandCardItemProps {
  card: CardSchema;
  idx: number;
  handMid: number;
  dynamicFanAngle: number;
  dynamicFanOffset: number;
  playable: boolean;
  isSelected: boolean;
  colorblindMode: boolean;
  dynamicMarginValue: string;
  // eslint-disable-next-line no-unused-vars
  setSelectedCardIdx: (idx: number) => void;
  // eslint-disable-next-line no-unused-vars
  playCard: (card: CardSchema, color?: UnoColor) => void;
}

function HandCardItem({
  card,
  idx,
  handMid,
  dynamicFanAngle,
  dynamicFanOffset,
  playable,
  isSelected,
  colorblindMode,
  dynamicMarginValue,
  setSelectedCardIdx,
  playCard,
}: HandCardItemProps) {
  const [isNew, setIsNew] = useState(true);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsNew(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diffY = touchStartY.current - e.touches[0].clientY;
    // diffY > 0 is upward drag, diffY < 0 is downward drag
    const offset = diffY > 0 ? Math.min(90, diffY) : Math.max(-40, diffY);
    setDragY(offset);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.preventDefault(); // Prevents synthesized click event on mobile touch screens!

    // Upward swipe -> Play Card
    if (dragY > 50) {
      if (playable) {
        playCard(card);
      } else {
        sfx.playPluck();
      }
    }
    // Downward swipe -> Deselect
    else if (dragY < -25) {
      if (isSelected) {
        setSelectedCardIdx(-1);
        sfx.playSwish();
      }
    }
    // Short tap -> Toggle selection / play
    else if (Math.abs(dragY) < 10) {
      if (isSelected) {
        if (playable) {
          playCard(card);
        } else {
          sfx.playPluck();
        }
      } else {
        setSelectedCardIdx(idx);
        sfx.playSwish();
      }
    }

    setDragY(0);
  };

  const rotVal = (idx - handMid) * dynamicFanAngle;
  const tyVal = Math.pow(Math.abs(idx - handMid), 1.4) * dynamicFanOffset;

  const isDragged = dragY !== 0;
  const rot = isSelected && !isDragged ? 0 : rotVal;
  const scale = isSelected ? 1.14 : isDragged ? 1.05 : 1.0;

  let yOffset = tyVal;
  if (isSelected) {
    yOffset -= 32;
  } else if (playable) {
    yOffset -= 16;
  }
  yOffset -= dragY;

  const inlineStyle = {
    transform: `rotate(${rot}deg) translateY(${yOffset}px) scale(${scale})`,
    marginLeft: dynamicMarginValue,
    zIndex: isSelected || isDragged ? 99 : idx,
    transition: isDragged
      ? "none"
      : "transform 0.28s cubic-bezier(0.25, 0.8, 0.25, 1), margin 0.28s ease",
  } as React.CSSProperties;

  return (
    <div
      className={`hand-card-wrapper ${playable ? "playable" : ""} ${isSelected ? "keyboard-focused" : ""} ${isNew ? "card-deal-in" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={(e) => {
        if (isDragged) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rx = (y / rect.height - 0.5) * -24;
        const ry = (x / rect.width - 0.5) * 24;
        e.currentTarget.style.setProperty("--rx", `${rx}deg`);
        e.currentTarget.style.setProperty("--ry", `${ry}deg`);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty("--rx", "0deg");
        e.currentTarget.style.setProperty("--ry", "0deg");
      }}
      style={inlineStyle}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isSelected) {
            if (playable) {
              playCard(card);
            } else {
              sfx.playPluck();
            }
          } else {
            setSelectedCardIdx(idx);
            sfx.playSwish();
          }
        }}
        type="button"
        style={{ width: "100%", height: "100%" }}
        aria-label={cardLabel(card)}
      >
        <CardAtlasView card={card} colorblind={colorblindMode} />
      </button>
    </div>
  );
}

// ── TableRoom principal view ──────────────────────────────────────────────
interface TableRoomProps {
  room: Room<UnoState> | null;
  state: UnoState | null;
  onLeave: () => void;
  colorblindMode: boolean;
  onToggleColorblind: () => void;
}

interface ParticleData {
  id: string;
  x: number;
  y: number;
  emoji: string;
  tx: string;
  ty: string;
  tr: string;
}

function TableRoom({ room, state, onLeave, colorblindMode, onToggleColorblind }: TableRoomProps) {
  const me = localPlayer(room, state);
  const players = statePlayers(state);
  const discardPile = state?.discardPile ?? [];
  const topCard = discardPile[discardPile.length - 1] ?? null;

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<"none" | "color" | "value">("color");
  const hand = useMemo(() => {
    const rawHand = [...(me?.hand ?? [])];
    if (sortBy === "color") {
      return rawHand.sort((a, b) => {
        if (a.cardType === "wild" && b.cardType !== "wild") return 1;
        if (b.cardType === "wild" && a.cardType !== "wild") return -1;
        if (a.color !== b.color) {
          return a.color.localeCompare(b.color);
        }
        return a.value.localeCompare(b.value);
      });
    } else if (sortBy === "value") {
      return rawHand.sort((a, b) => {
        if (a.value !== b.value) {
          return a.value.localeCompare(b.value);
        }
        return a.color.localeCompare(b.color);
      });
    }
    return rawHand;
  }, [me?.hand, sortBy]);

  const [wildFor, setWildFor] = useState<CardSchema | null>(null);
  const [chatText, setChatText] = useState("");
  const currentPlayer = players.find((player) => player.seatIndex === state?.currentPlayer);
  const isMyTurn = !!me && me.seatIndex === state?.currentPlayer && state?.winner === -1;
  const roomCode = room?.roomId ?? "Room";
  const tableReady = Boolean(topCard);

  // Ping Latency measurement
  const [ping, setPing] = useState<number | null>(null);

  // UI States
  const [showRules, setShowRules] = useState(false);
  const [cardAlert, setCardAlert] = useState<string | null>(null);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number>(-1);

  const handScrollRef = useRef<HTMLDivElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesCount = state?.chatMessages?.length ?? 0;
  const lastChatCount = useRef(0);
  const lastIsMyTurn = useRef(false);
  const matchStartTime = useRef<number | null>(null);

  // References to detect state changes for satisfying synthesized sounds!
  const lastDiscardCount = useRef(0);
  const lastHandCount = useRef(0);
  const lastWinner = useRef(-1);
  const lastUno = useRef(-1);
  const lastPending = useRef(0);

  // Particle explosion generator
  const triggerParticles = (x: number, y: number, count = 20) => {
    const emojis = ["✨", "🔥", "🎉", "🌟", "💥", "🃏"];
    const newParticles: ParticleData[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 120;
      const tx = `${Math.cos(angle) * distance}px`;
      const ty = `${Math.sin(angle) * distance}px`;
      const tr = `${-180 + Math.random() * 360}deg`;
      newParticles.push({
        id: `${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        tx,
        ty,
        tr,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1200);
  };

  // Stable card play handler callback
  const playCard = React.useCallback(
    (card: CardSchema, color?: UnoColor) => {
      if (!room) return;
      if (card.cardType === "wild" && !color) {
        setWildFor(card);
        return;
      }
      room.send("play_card", { cardId: card.id, chosenColor: color });
      setWildFor(null);
      setSelectedCardIdx(-1);
    },
    [room],
  );

  // Connection Quality Latency checker loop
  useEffect(() => {
    if (!room) return;
    let lastPingTime = 0;
    const handlePong = () => {
      setPing(Date.now() - lastPingTime);
    };

    const cleanupPong = room.onMessage("pong", handlePong);
    const interval = setInterval(() => {
      lastPingTime = Date.now();
      room.send("ping");
    }, 3000);

    lastPingTime = Date.now();
    room.send("ping");

    return () => {
      clearInterval(interval);
      cleanupPong();
    };
  }, [room]);

  // Card play visual events auditor
  useEffect(() => {
    if (!state) return;

    // Detect play card sound (discard pile grew)
    const currentDiscard = state.discardPile?.length ?? 0;
    if (currentDiscard > lastDiscardCount.current && lastDiscardCount.current > 0) {
      sfx.playPluck();

      // Spawn CSS sparks at the center-table!
      triggerParticles(window.innerWidth / 2, window.innerHeight / 2 - 50, 15);

      // Inspect cinematic overlay card alerts
      const top = state.discardPile?.[state.discardPile.length - 1];
      if (top) {
        if (top.cardType === "color") {
          if (top.value === "skip") setCardAlert("SKIP!");
          else if (top.value === "reverse") setCardAlert("REVERSE!");
          else if (top.value === "draw2") setCardAlert("+2 DRAW!");
        } else if (top.cardType === "wild") {
          if (top.value === "wild_draw4") setCardAlert("+4 DRAW!");
          else setCardAlert("WILD PLAY!");
        }
      }
    }
    lastDiscardCount.current = currentDiscard;

    // Detect UNO call warning or confirmation
    const currentUno = state.unoCaller ?? -1;
    if (currentUno !== -1 && lastUno.current === -1) {
      const uPlayer = players.find((p) => p.seatIndex === currentUno);
      if (uPlayer) {
        setCardAlert(`⚠️ ${parsePlayerName(uPlayer.name).name} HAS 1 CARD!`);
        sfx.playChime();
        triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 25);
      }
    } else if (currentUno === -1 && lastUno.current !== -1) {
      const uPlayer = players.find((p) => p.seatIndex === lastUno.current);
      if (uPlayer) {
        setCardAlert(`🎉 ${parsePlayerName(uPlayer.name).name} CALLED UNO!`);
        sfx.playChime();
        triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 35);
      }
    }
    lastUno.current = currentUno;

    // Detect penalty draw stack growth
    const currentPending = state.pendingDraw ?? 0;
    if (currentPending > lastPending.current && currentPending > 0) {
      setCardAlert(`🔥 +${currentPending} DRAW STACKED!`);
      sfx.playPluck();
      triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 20);
    }
    lastPending.current = currentPending;

    // Detect winner sound (winner changed from -1)
    const currentWinner = state.winner ?? -1;
    if (currentWinner !== -1 && lastWinner.current === -1) {
      sfx.playChime();

      // Update local storage stats
      if (me) {
        const win = me.seatIndex === currentWinner;
        const botKills = players.filter((p) => p.isBot).length;
        const winnerPlayer = players.find((p) => p.seatIndex === currentWinner);
        const winnerName = winnerPlayer ? winnerPlayer.name : "Winner";
        const durationSec = matchStartTime.current
          ? (Date.now() - matchStartTime.current) / 1000
          : 0;
        const opponentNames = players
          .filter((p) => p.sessionId !== me.sessionId)
          .map((p) => p.name);

        updateStats(
          win,
          lastDiscardCount.current,
          botKills,
          winnerName,
          durationSec,
          opponentNames,
        );
      }

      triggerParticles(window.innerWidth / 2, window.innerHeight / 2, 40);
    }
    lastWinner.current = currentWinner;

    // Detect draw card sound (current hand count grew)
    const currentHand = me?.hand?.length ?? 0;
    if (currentHand > lastHandCount.current && lastHandCount.current > 0) {
      sfx.playSwish();
    }
    lastHandCount.current = currentHand;
  }, [state, me?.hand?.length, me, players]);

  // Alert dismisser
  useEffect(() => {
    if (cardAlert) {
      const timer = setTimeout(() => setCardAlert(null), 1600);
      return () => clearTimeout(timer);
    }
  }, [cardAlert]);

  // Reset selection on turn/phase transitions
  useEffect(() => {
    setSelectedCardIdx(-1);
  }, [state?.currentPlayer, state?.phase]);

  // Turn active notify chime
  useEffect(() => {
    if (isMyTurn && !lastIsMyTurn.current) {
      sfx.playTurnAlert();
    }
    lastIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  // Chat auto scroll only when messages length changes
  useEffect(() => {
    if (chatLogRef.current && chatMessagesCount > lastChatCount.current) {
      chatLogRef.current.scrollTo({
        top: chatLogRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    lastChatCount.current = chatMessagesCount;
  }, [chatMessagesCount]);

  // Track match duration
  useEffect(() => {
    if (state?.phase === "playing" && matchStartTime.current === null) {
      matchStartTime.current = Date.now();
    } else if (state?.phase !== "playing") {
      matchStartTime.current = null;
    }
  }, [state?.phase]);

  // Keyboard navigation controller
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      const key = event.key.toLowerCase();
      if (wildFor) {
        if (key === "r") {
          playCard(wildFor, "red");
        } else if (key === "y") {
          playCard(wildFor, "yellow");
        } else if (key === "g") {
          playCard(wildFor, "green");
        } else if (key === "b") {
          playCard(wildFor, "blue");
        } else if (event.key === "Escape") {
          setWildFor(null);
        }
        return;
      }

      if (key === "arrowleft") {
        setSelectedCardIdx((prev) => Math.max(0, prev - 1));
      } else if (key === "arrowright") {
        setSelectedCardIdx((prev) => Math.min(hand.length - 1, prev + 1));
      } else if (event.key === " " || event.key === "Enter") {
        if (selectedCardIdx >= 0 && selectedCardIdx < hand.length) {
          const card = hand[selectedCardIdx];
          if (isMyTurn && isPlayable(card, state, hand)) {
            playCard(card);
          }
        }
      } else if (key === "d") {
        if (isMyTurn && tableReady) {
          room?.send("draw_card");
        }
      } else if (key === "u") {
        if (state?.unoCaller === me?.seatIndex) {
          room?.send("uno");
        }
      } else if (key === "c") {
        event.preventDefault();
        const chatInput = document.querySelector(".chat-panel input") as HTMLInputElement | null;
        chatInput?.focus();
      } else if (key === "?") {
        setShowRules((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hand, selectedCardIdx, isMyTurn, state, me, playCard, room, tableReady, wildFor]);

  // Scroll controls for overflow hand dock
  const scrollHand = (direction: "left" | "right") => {
    if (!handScrollRef.current) return;
    const amount = 200 * (direction === "left" ? -1 : 1);
    handScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Generate fan physics coordinates for fanning cards
  const handCount = hand.length;
  const handMid = (handCount - 1) / 2;

  // Dynamic fanning and margins based on hand size to prevent severe tilting and overlap unreadability
  const dynamicFanAngle = handCount > 8 ? Math.max(1.2, 40 / handCount) : 5;
  const dynamicFanOffset = handCount > 8 ? Math.max(0.8, 32 / handCount) : 4;
  const dynamicMarginValue = handCount <= 4 ? "10px" : `${Math.max(-56, -12 - handCount * 4)}px`;

  // Context-aware dealer guidance logic
  const hasPlayableCards = useMemo(() => {
    return hand.some((card) => isPlayable(card, state, hand));
  }, [hand, state]);

  const shouldDrawHint = isMyTurn && !hasPlayableCards && tableReady;

  const selectedCard =
    selectedCardIdx >= 0 && selectedCardIdx < hand.length ? hand[selectedCardIdx] : null;
  const isSelectedPlayable = selectedCard ? isPlayable(selectedCard, state, hand) : false;

  const { guidanceText, guidanceStatus } = useMemo(() => {
    if (!isMyTurn) {
      return {
        guidanceText: "Awaiting opponent's turn... Inspect your hand in the meantime.",
        guidanceStatus: "normal",
      };
    }
    if (selectedCard && !isSelectedPlayable) {
      return {
        guidanceText: `Invalid selection! ${cardLabel(selectedCard)} doesn't match discard pile.`,
        guidanceStatus: "error",
      };
    }
    if (!hasPlayableCards) {
      return {
        guidanceText: "No playable cards in hand! Click the glowing Deck Stack to Draw.",
        guidanceStatus: "warning",
      };
    }
    return {
      guidanceText: "Select a glowing playable card and click it again to play.",
      guidanceStatus: "normal",
    };
  }, [isMyTurn, selectedCard, isSelectedPlayable, hasPlayableCards]);

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="topbar-info">
          <div className="topbar-stat">
            <span>Invite code</span>
            <strong>{roomCode}</strong>
          </div>
          <div className="topbar-stat">
            <span>Turn status</span>
            <strong style={{ color: isMyTurn ? "var(--gold)" : "var(--text-primary)" }}>
              {isMyTurn
                ? "Your Turn!"
                : currentPlayer
                  ? parsePlayerName(currentPlayer.name).name
                  : "Waiting"}
            </strong>
          </div>
          <div className="topbar-stat">
            <span>Play order</span>
            <strong>{state?.direction === -1 ? "Counter-Clockwise ◀" : "Clockwise ▶"}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <PingVisualizer ping={ping} />
          <AudioSettingsPanel />
          <button
            className={`ghost-btn ${colorblindMode ? "active-acc" : ""}`}
            onClick={onToggleColorblind}
            type="button"
            title="Toggle colorblind accessibility symbols"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            ♿ {colorblindMode ? "CB: On" : "CB: Off"}
          </button>
          <button className="ghost-btn" onClick={() => setShowRules(true)} type="button">
            Rules (?)
          </button>
          <button className="ghost-btn" onClick={onLeave} type="button">
            Leave Game
          </button>
        </div>
      </header>

      <section
        className={`table-board active-${state?.activeColor || "red"}`}
        aria-label="Game table felt"
      >
        <AmbientStardust />
        <div className="player-band">
          <PlayerStrip
            players={players.filter((player) => player.sessionId !== me?.sessionId)}
            activeSeat={state?.currentPlayer ?? -1}
            turnDeadline={state?.turnDeadline}
          />
        </div>

        <div className="center-table">
          <PlayDirectionRing direction={state?.direction ?? 1} />

          {tableReady && (
            <div className="active-color-badge">
              <span className={`color-dot color-${state?.activeColor || "red"}`} />
              <span>
                {state?.activeColor}
                {colorblindMode && (
                  <span style={{ marginLeft: "6px", opacity: 0.85, fontWeight: "bold" }}>
                    {state?.activeColor === "red" && " ▲"}
                    {state?.activeColor === "blue" && " ■"}
                    {state?.activeColor === "green" && " ●"}
                    {state?.activeColor === "yellow" && " ★"}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Tangible, layered face-down Draw Stack */}
          <button
            className={`deck-stack ${shouldDrawHint ? "guidance-pulse" : ""}`}
            disabled={!isMyTurn || !tableReady}
            onClick={() => room?.send("draw_card")}
            type="button"
            aria-label="Draw card deck"
          >
            <div
              className="deck-shadow-layer"
              style={{ transform: "translate(4px, 4px)" } as React.CSSProperties}
            />
            <div
              className="deck-shadow-layer"
              style={{ transform: "translate(2px, 2px)" } as React.CSSProperties}
            />
            <CardAtlasView card={null} isBack />
            <div className="deck-count-overlay">
              <span>{state?.drawPileCount ?? state?.deckCount ?? 0}</span>
            </div>
            {shouldDrawHint && (
              <div className="draw-guidance-tooltip" role="tooltip">
                <span>Draw a card!</span>
              </div>
            )}
          </button>

          {/* Natural rotated discard Pile */}
          {tableReady ? (
            <div className="pile-container">
              {discardPile.slice(-4, -1).map((histCard, hIdx) => {
                const globalIdx = discardPile.length - 4 + hIdx;
                const rot = getDeterministicRotation(globalIdx);
                const ox = getDeterministicOffsetX(globalIdx);
                const oy = getDeterministicOffsetY(globalIdx);
                return (
                  <div
                    key={histCard.id}
                    className="discard-card"
                    style={
                      {
                        transform: `rotate(${rot}deg) translate(${ox}px, ${oy}px)`,
                        opacity: 0.5 + hIdx * 0.15,
                      } as React.CSSProperties
                    }
                  >
                    <CardAtlasView card={histCard} colorblind={colorblindMode} />
                  </div>
                );
              })}
              <div
                className="discard-card"
                style={
                  {
                    transform: `rotate(${getDeterministicRotation(discardPile.length - 1)}deg) translate(${getDeterministicOffsetX(discardPile.length - 1)}px, ${getDeterministicOffsetY(discardPile.length - 1)}px)`,
                  } as React.CSSProperties
                }
              >
                <CardAtlasView card={topCard} colorblind={colorblindMode} />
              </div>
            </div>
          ) : (
            <div className="table-empty-state">
              <span>Syncing Table</span>
              <strong>Dealing Cards...</strong>
              <small>Awaiting server synchronization deal.</small>
            </div>
          )}

          {Boolean(state?.pendingDraw) && (
            <div className="pending-draw-badge">+{state?.pendingDraw} Draw Stacked!</div>
          )}
        </div>
      </section>

      <aside className="side-panel">
        <div
          className="status-card"
          style={{ display: "flex", flexDirection: "row", gap: "12px", alignItems: "center" }}
        >
          {me && (
            <AvatarIcon
              symbol={parsePlayerName(me.name).symbol}
              theme={parsePlayerName(me.name).theme}
              size={40}
              glow
            />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>Seat Allocation</span>
            <strong>
              {me ? `${parsePlayerName(me.name).name} (Seat ${me.seatIndex + 1})` : "Spectator"}
            </strong>
            <small>{state?.spectatorCount ?? 0} Watching table</small>
          </div>
        </div>

        <div className="status-card">
          <span>Active Discard</span>
          <strong>{cardLabel(topCard)}</strong>
          <small>{state?.phase ?? "Awaiting"}</small>
        </div>

        <div className="roster-card">
          <span>Opponent Cards</span>
          <div className="roster-list">
            {players.length === 0 ? (
              <p style={{ color: "var(--text-faint)" }}>Awaiting players...</p>
            ) : (
              players.map((player) => {
                const av = parsePlayerName(player.name);
                return (
                  <div
                    className="roster-row"
                    key={player.sessionId}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <AvatarIcon
                      symbol={av.symbol}
                      theme={av.theme}
                      size={28}
                      glow={player.seatIndex === state?.currentPlayer}
                    />
                    <div className="roster-row-info" style={{ flex: 1 }}>
                      <strong>{av.name}</strong>
                      <span>
                        {player.sessionId === me?.sessionId
                          ? "You"
                          : player.isBot
                            ? "Bot"
                            : "Opponent"}
                      </span>
                    </div>
                    <div className="roster-card-count">
                      {player.handCount ?? player.hand?.length ?? 0}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <section
        className={`hand-dock ${isMyTurn ? "my-turn" : ""}`}
        aria-label="Your hand cards dock"
      >
        <div className="hand-header">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              alignItems: "flex-start",
            }}
          >
            <span>{isMyTurn ? "YOUR TURN" : "YOUR HAND"}</span>
            <strong className={`hand-guidance-text ${guidanceStatus}`}>{guidanceText}</strong>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            {/* Sorting controls */}
            <div className="sort-row">
              <button
                className={`sort-btn ${sortBy === "none" ? "active" : ""}`}
                onClick={() => setSortBy("none")}
                type="button"
              >
                Default
              </button>
              <button
                className={`sort-btn ${sortBy === "color" ? "active" : ""}`}
                onClick={() => setSortBy("color")}
                type="button"
              >
                Color
              </button>
              <button
                className={`sort-btn ${sortBy === "value" ? "active" : ""}`}
                onClick={() => setSortBy("value")}
                type="button"
              >
                Rank
              </button>
            </div>

            {state?.unoCaller === me?.seatIndex && (
              <button className="uno-btn" onClick={() => room?.send("uno")} type="button">
                UNO!
              </button>
            )}
          </div>
        </div>

        {/* Scrollable fan wrappers with indicators */}
        <div style={{ position: "relative", width: "100%" }}>
          {handCount > 5 && (
            <button
              className="scroll-indicator-btn left"
              onClick={() => scrollHand("left")}
              type="button"
            >
              ◀
            </button>
          )}
          <div className="hand-scroll-wrapper" ref={handScrollRef}>
            {handCount === 0 ? (
              <p className="empty-hand">{me ? "Dealing initial cards..." : "Spectating Table"}</p>
            ) : (
              hand.map((card, idx) => {
                const playable = isMyTurn && isPlayable(card, state, hand);
                const isSelected = idx === selectedCardIdx;
                return (
                  <HandCardItem
                    key={card.id}
                    card={card}
                    idx={idx}
                    handMid={handMid}
                    dynamicFanAngle={dynamicFanAngle}
                    dynamicFanOffset={dynamicFanOffset}
                    playable={playable}
                    isSelected={isSelected}
                    colorblindMode={colorblindMode}
                    dynamicMarginValue={dynamicMarginValue}
                    setSelectedCardIdx={setSelectedCardIdx}
                    playCard={playCard}
                  />
                );
              })
            )}
          </div>
          {handCount > 5 && (
            <button
              className="scroll-indicator-btn right"
              onClick={() => scrollHand("right")}
              type="button"
            >
              ▶
            </button>
          )}
        </div>
      </section>

      <aside className="chat-panel">
        <div className="chat-log" ref={chatLogRef}>
          {(state?.chatMessages ?? []).slice(-10).map((message) => {
            const senderAv = parsePlayerName(message.sender);
            return (
              <p key={`${message.timestamp}-${message.sender}`}>
                <strong>{senderAv.name}</strong>
                {message.text}
              </p>
            );
          })}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!chatText.trim()) return;
            room?.send("chat", { text: chatText.trim() });
            setChatText("");
          }}
        >
          <input
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
            placeholder="Type a chat message..."
            aria-label="Chat input"
          />
          <button type="submit">Send</button>
        </form>
      </aside>

      {/* ── Interactive Particle canvas overlay ─────────────────────────── */}
      <div className="particle-canvas">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={
              {
                left: `${p.x}px`,
                top: `${p.y}px`,
                "--tx": p.tx,
                "--ty": p.ty,
                "--tr": p.tr,
              } as React.CSSProperties
            }
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* ── Cinematic card alert overlays ───────────────────────────────── */}
      {cardAlert && (
        <div className="card-alert-overlay">
          <div
            className={`card-alert-banner ${
              cardAlert.includes("⚠️") || cardAlert.includes("🔥")
                ? "warning"
                : cardAlert.includes("🎉")
                  ? "success"
                  : ""
            }`}
          >
            <h2>{cardAlert}</h2>
          </div>
        </div>
      )}

      {/* ── sliding glass rules & Keyboard shortcuts drawer ────────────────── */}
      {showRules && (
        <>
          <div className="drawer-overlay" onClick={() => setShowRules(false)} />
          <div className="drawer-content" role="dialog" aria-modal="true">
            <div className="drawer-header">
              <h2>Rules & Shortcuts</h2>
              <button className="ghost-btn" onClick={() => setShowRules(false)} type="button">
                Close
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <section>
                <h3 style={{ color: "var(--gold)", marginBottom: "8px" }}>Keyboard Shortcuts</h3>
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "13px",
                  }}
                >
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      ◀
                    </kbd>{" "}
                    /{" "}
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      ▶
                    </kbd>{" "}
                    Select Cards
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      Space
                    </kbd>{" "}
                    /{" "}
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      Enter
                    </kbd>{" "}
                    Play Selected Card
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      D
                    </kbd>{" "}
                    Draw Card from deck
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      U
                    </kbd>{" "}
                    Call UNO!
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      C
                    </kbd>{" "}
                    Open & Focus Chat input
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      R
                    </kbd>{" "}
                    /{" "}
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      Y
                    </kbd>{" "}
                    /{" "}
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      G
                    </kbd>{" "}
                    /{" "}
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      B
                    </kbd>{" "}
                    Select Wild Color (Red/Yellow/Green/Blue)
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      Esc
                    </kbd>{" "}
                    Cancel Wild Color selection
                  </li>
                  <li>
                    <kbd
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        marginRight: "8px",
                      }}
                    >
                      ?
                    </kbd>{" "}
                    Open/Close Rules Drawer
                  </li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: "var(--gold)", marginBottom: "8px" }}>Wild Table UNO Rules</h3>
                <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-muted)" }}>
                  Match the top card of the discard pile by color or rank. When you have exactly one
                  card left in hand, you MUST click the <strong>UNO!</strong> button (or press{" "}
                  <kbd>U</kbd>) before playing your second-to-last card. Failing to do so triggers a{" "}
                  <strong>2-card draw penalty</strong>!
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "var(--text-muted)",
                    marginTop: "8px",
                  }}
                >
                  <strong>Draw Stacking:</strong> Draw-2 and Wild Draw-4 cards accumulate pending
                  draw values. Draw stack triggers must be drawn unless stacked further with another
                  matching draw card.
                </p>
              </section>
            </div>
          </div>
        </>
      )}

      {/* ── Full screen Victory Podium overlay ───────────────────────────── */}
      {state?.winner !== undefined && state.winner !== -1 && (
        <WinnerPodium
          room={room}
          state={state}
          players={players}
          winnerSeat={state.winner}
          meSeatIndex={me?.seatIndex}
        />
      )}

      {wildFor && (
        <div className="color-modal" role="dialog" aria-modal="true">
          <div className="color-modal-box">
            <h2>Select Wild Color</h2>
            <div className="color-grid">
              {colors.map((color) => (
                <button
                  key={color}
                  className={`color-pick color-${color}`}
                  onClick={() => playCard(wildFor, color)}
                  type="button"
                >
                  {color}
                </button>
              ))}
            </div>
            <button className="ghost-btn" onClick={() => setWildFor(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("lobby");
  const [room, setRoom] = useState<Room<UnoState> | null>(null);
  const [state, setState] = useState<UnoState | null>(null);
  const [error, setError] = useState("");

  // Persisted accessibility state
  const [colorblindMode, setColorblindMode] = useState(() => {
    return localStorage.getItem("uno_colorblind") === "true";
  });

  const toggleColorblindMode = () => {
    setColorblindMode((prev) => {
      const next = !prev;
      localStorage.setItem("uno_colorblind", String(next));
      return next;
    });
  };

  async function connect(connectRoom: Promise<Room<UnoState>>) {
    setError("");
    setMode("joining");
    try {
      const joined = await connectRoom;
      joined.onStateChange((next) => setState(snapshotState(next)));
      joined.onLeave(() => {
        setRoom(null);
        setState(null);
        setMode("lobby");
      });
      setRoom(joined);
      setState(snapshotState(joined.state));
      setMode("table");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the room.");
      setMode("lobby");
    }
  }

  function leaveRoom() {
    room?.leave();
    setRoom(null);
    setState(null);
    setMode("lobby");
  }

  if (mode === "table") {
    return (
      <ErrorBoundary onReset={leaveRoom}>
        <TableRoom
          room={room}
          state={state}
          onLeave={leaveRoom}
          colorblindMode={colorblindMode}
          onToggleColorblind={toggleColorblindMode}
        />
      </ErrorBoundary>
    );
  }

  return (
    <Lobby
      busy={mode === "joining"}
      error={error}
      onQuickPlay={(options) => connect(client.joinOrCreate("uno", options))}
      onJoinCode={(roomId, options) => connect(client.joinById(roomId, options))}
      onWatch={(roomId) => connect(client.joinById(roomId, { name: "Spectator", spectator: true }))}
      colorblindMode={colorblindMode}
      onToggleColorblind={toggleColorblindMode}
    />
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="crash-screen">
          <section>
            <h1>Table crashed rendering</h1>
            <p>
              {this.state.error instanceof Error
                ? this.state.error.message
                : "Unknown render error"}
            </p>
            <button onClick={this.props.onReset} type="button">
              Return to Lobby
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
