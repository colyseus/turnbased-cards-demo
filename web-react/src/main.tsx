import "./index.css";
import { Client, Room } from "@colyseus/sdk";
import { Component, ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Lobby } from "./components/Lobby";
import { TableRoom } from "./components/TableRoom";
import type {
  CardSchema,
  ChatMessageSchema,
  Mode,
  PlayerSchema,
  Toast,
  UnoState,
} from "./gameTypes";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
const client = new Client(WS_URL);
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

function App() {
  const [mode, setMode] = useState<Mode>("lobby");
  const [room, setRoom] = useState<Room<UnoState> | null>(null);
  const [state, setState] = useState<UnoState | null>(null);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

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

  const showToast = (message: string, kind: Toast["kind"] = "info", duration = 2500) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [mode]);

  async function connect(connectRoom: Promise<Room<UnoState>>) {
    setError("");
    setMode("joining");
    try {
      const joined = await connectRoom;
      joined.onStateChange((next) => setState(snapshotState(next)));
      joined.onMessage("error", () => {
        // Silent capture to prevent Colyseus SDK from printing default console warnings
      });
      joined.onLeave((code) => {
        setRoom(null);
        setState(null);
        setMode("lobby");
        if (code !== 1000 && code !== 1001) {
          // Abnormal close — show toast but don't override error
        }
      });
      joined.onError((code) => {
        if (code === 1000) {
          // Normal close
          setDisconnected(false);
        } else {
          // Abnormal disconnect
          setDisconnected(true);
        }
      });
      setRoom(joined);
      setState(snapshotState(joined.state));
      setMode("table");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Colyseus match-make error codes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const colyseusErr = err as { code?: number; message?: string };
      if (
        colyseusErr.code === 1 ||
        errorMessage.includes("not found") ||
        errorMessage.includes("No such room")
      ) {
        setError("Room not found. Check the invite code and try again.");
      } else if (colyseusErr.code === 2 || errorMessage.includes("full")) {
        setError("Room is full. The table already has the maximum number of players.");
      } else if (
        colyseusErr.code === 3 ||
        errorMessage.includes("password") ||
        errorMessage.includes("invalid")
      ) {
        setError("Wrong password. Please check the room password and try again.");
      } else if (
        errorMessage.includes("fetch") ||
        errorMessage.includes("network") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("WebSocket")
      ) {
        setError("Server unreachable. Make sure the game server is running.");
      } else {
        setError(`Could not join the room: ${errorMessage}`);
      }
      setMode("lobby");
    }
  }

  function leaveRoom() {
    // Confirm mid-match departure to prevent accidental leaves
    if (mode === "table" && (state?.phase === "playing" || state?.phase === "ended")) {
      const confirmLeave = window.confirm(
        "Leave the game? You will forfeit this match if you leave mid-game.",
      );
      if (!confirmLeave) return;
    }
    room?.leave();
    setRoom(null);
    setState(null);
    setMode("lobby");
    setDisconnected(false);
  }

  return (
    <>
      {mode === "table" ? (
        <ErrorBoundary onReset={leaveRoom}>
          <TableRoom
            room={room}
            state={state}
            onLeave={leaveRoom}
            colorblindMode={colorblindMode}
            onToggleColorblind={toggleColorblindMode}
            showToast={showToast}
            disconnected={disconnected}
          />
        </ErrorBoundary>
      ) : (
        <Lobby
          busy={mode === "joining"}
          error={error}
          onQuickPlay={(options) => connect(client.joinOrCreate("uno", options))}
          onJoinCode={(roomId, options) => connect(client.joinById(roomId, options))}
          onWatch={(roomId) =>
            connect(client.joinById(roomId, { name: "Spectator", spectator: true }))
          }
          colorblindMode={colorblindMode}
          onToggleColorblind={toggleColorblindMode}
        />
      )}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
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

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Register PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] registered", reg.scope))
      .catch((err) => console.warn("[SW] registration failed", err));
  });
}
