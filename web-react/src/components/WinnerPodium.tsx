import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { Room } from "@colyseus/sdk";
import { AvatarIcon } from "./AvatarIcon";
import type { PlayerSchema, UnoState } from "../gameTypes";
import { parsePlayerName } from "../gameHelpers";

interface WinnerPodiumProps {
  room: Room<UnoState> | null;
  state: UnoState | null;
  players: PlayerSchema[];
  winnerSeat: number;
  meSeatIndex: number | undefined;
}

export function WinnerPodium({ room, state, players, winnerSeat, meSeatIndex }: WinnerPodiumProps) {
  const winner = players.find((p) => p.seatIndex === winnerSeat);
  const winAv = winner ? parsePlayerName(winner.name) : null;
  const votes = state?.rematchVotes ?? [];
  const humans = players.filter((p) => !p.isBot && p.connected);

  const coins = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: `coin-${i}`,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 4}s`,
        duration: `${3 + Math.random() * 3}s`,
        size: `${14 + Math.random() * 16}px`,
      })),
    [],
  );

  return (
    <div className="winner-podium-overlay">
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="gold-coin-particle"
          style={
            {
              left: coin.left,
              animationDelay: coin.delay,
              animationDuration: coin.duration,
              fontSize: coin.size,
            } as CSSProperties
          }
        >
          🪙
        </div>
      ))}

      <div className="winner-podium-box">
        <div className="podium-pedestal">
          <div className="podium-crown">👑</div>
          <div className="championship-avatar-container">
            <svg className="championship-laurels" viewBox="0 0 100 100" width="130" height="130">
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffe066" />
                  <stop offset="50%" stopColor="#f5af19" />
                  <stop offset="100%" stopColor="#e65c00" />
                </linearGradient>
              </defs>
              <path
                d="M 38,78 C 22,68 18,45 30,25 C 22,38 24,55 36,66"
                fill="none"
                stroke="url(#goldGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M 30,25 L 34,29 L 28,31 Z" fill="url(#goldGrad)" />
              <path d="M 23,38 L 28,40 L 24,45 Z" fill="url(#goldGrad)" />
              <path d="M 22,50 L 27,51 L 24,56 Z" fill="url(#goldGrad)" />
              <path d="M 24,61 L 29,60 L 27,66 Z" fill="url(#goldGrad)" />
              <path
                d="M 62,78 C 78,68 82,45 70,25 C 78,38 76,55 64,66"
                fill="none"
                stroke="url(#goldGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M 70,25 L 66,29 L 72,31 Z" fill="url(#goldGrad)" />
              <path d="M 77,38 L 72,40 L 76,45 Z" fill="url(#goldGrad)" />
              <path d="M 78,50 L 73,51 L 76,56 Z" fill="url(#goldGrad)" />
              <path d="M 76,61 L 71,60 L 73,66 Z" fill="url(#goldGrad)" />
            </svg>
            {winAv && <AvatarIcon symbol={winAv.symbol} theme={winAv.theme} size={84} glow />}
          </div>
          <h1 style={{ marginTop: "16px", fontSize: "26px", color: "var(--gold)", fontWeight: 900 }}>
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
                  {parsePlayerName(player.name).name} {player.seatIndex === meSeatIndex ? "(You)" : ""}
                </span>
                <strong style={{ color: voted ? "#4da66d" : "var(--text-faint)" }}>
                  {voted ? "READY ✅" : "WAITING... ⏳"}
                </strong>
              </div>
            );
          })}
        </div>

        <button className="primary-btn" style={{ width: "100%" }} onClick={() => room?.send("vote_rematch")} type="button">
          Vote Rematch
        </button>
      </div>
    </div>
  );
}
