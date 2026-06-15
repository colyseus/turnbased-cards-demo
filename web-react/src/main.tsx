import "./index.css";
import { Client, Room } from "@colyseus/sdk";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Lobby } from "./components/Lobby";
import { TableRoom } from "./components/TableRoom";
import type { Mode, Toast, UnoState } from "./gameTypes";
import { snapshotState } from "./stateSnapshot";
import { readStorage, writeStorage } from "./storage";
import { ErrorBoundary } from "./sentry";
import "./sentry";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:2567";
const client = new Client(WS_URL);

function App() {
  const [mode, setMode] = useState<Mode>("lobby");
  const [room, setRoom] = useState<Room<UnoState> | null>(null);
  const [state, setState] = useState<UnoState | null>(null);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const connectGeneration = useRef(0);
  const toastTimers = useRef<Set<number>>(new Set());

  // Persisted accessibility state
  const [colorblindMode, setColorblindMode] = useState(() => {
    return readStorage("uno_colorblind") === "true";
  });

  const toggleColorblindMode = () => {
    setColorblindMode((prev) => {
      const next = !prev;
      writeStorage("uno_colorblind", String(next));
      return next;
    });
  };

  const showToast = (message: string, kind: Toast["kind"] = "info", duration = 2500) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    const timerId = window.setTimeout(() => {
      toastTimers.current.delete(timerId);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    toastTimers.current.add(timerId);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [mode]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimers.current.clear();
    };
  }, []);

  async function connect(connectRoom: Promise<Room<UnoState>>) {
    const generation = ++connectGeneration.current;
    setError("");
    setMode("joining");
    try {
      const joined = await connectRoom;
      if (generation !== connectGeneration.current) {
        void joined.leave().catch(() => undefined);
        return;
      }
      joined.onStateChange((next) => setState(snapshotState(next)));
      joined.onMessage("error", () => {
        // Silent capture to prevent Colyseus SDK from printing default console warnings
      });
      joined.onLeave((code) => {
        if (generation !== connectGeneration.current) return;
        setRoom(null);
        setState(null);
        setMode("lobby");
        if (code !== 1000 && code !== 1001) {
          // Abnormal close — show toast but don't override error
        }
      });
      joined.onError((code) => {
        if (generation !== connectGeneration.current) return;
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
      if (generation !== connectGeneration.current) return;
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Colyseus match-make error codes
      const colyseusErr = err as Error & { code?: number };
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
    if (mode === "table" && state?.phase === "playing") {
      const confirmLeave = window.confirm(
        "Leave the game? You will forfeit this match if you leave mid-game.",
      );
      if (!confirmLeave) return;
    }
    connectGeneration.current += 1;
    void room?.leave().catch(() => undefined);
    setRoom(null);
    setState(null);
    setMode("lobby");
    setDisconnected(false);
  }

  return (
    <>
      {mode === "table" ? (
        <ErrorBoundary
          fallback={({ resetError }) => (
            <main className="crash-screen">
              <section>
                <h1>Table crashed rendering</h1>
                <button onClick={resetError} type="button">
                  Return to Lobby
                </button>
              </section>
            </main>
          )}
          onReset={leaveRoom}
        >
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

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary fallback={<main className="crash-screen"><section><h1>Something went wrong</h1></section></main>}>
    <App />
  </ErrorBoundary>,
);

// Register PWA service worker
if ("serviceWorker" in navigator) {
  const registerServiceWorker = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] registered", reg.scope))
      .catch((err) => console.warn("[SW] registration failed", err));
  };

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker, { once: true });
  }
}
