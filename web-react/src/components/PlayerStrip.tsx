import type { CSSProperties } from "react";
import { AvatarIcon } from "./AvatarIcon";
import { TurnTimerRing } from "./TurnTimerRing";
import type { PlayerSchema } from "../gameTypes";
import { getCardCountClass, parsePlayerName } from "../gameHelpers";

export interface ActionBubble {
  id: string;
  seatIndex: number;
  text: string;
  themeColor: string;
}

interface PlayerStripProps {
  players: PlayerSchema[];
  activeSeat: number;
  turnDeadline: number | undefined;
  skippedSeatIndex: number;
  actionBubbles: ActionBubble[];
  botEmotions: Record<number, string>;
}

export function PlayerStrip({
  players,
  activeSeat,
  turnDeadline,
  skippedSeatIndex,
  actionBubbles,
  botEmotions,
}: PlayerStripProps) {
  return (
    <>
      {players.map((player, idx) => {
        const active = player.seatIndex === activeSeat;
        const isSkipped = player.seatIndex === skippedSeatIndex;
        const av = parsePlayerName(player.name);
        const bubble = actionBubbles.find((b) => b.seatIndex === player.seatIndex);
        const overrideEmoji = botEmotions[player.seatIndex];
        const cardCount = player.handCount ?? player.hand?.length ?? 0;

        const getPositionClass = (i: number, total: number) => {
          if (total === 1) return "position-top";
          if (total === 2) return i === 0 ? "position-left" : "position-right";
          if (i === 0) return "position-left";
          if (i === 1) return "position-top";
          return "position-right";
        };
        const posClass = getPositionClass(idx, players.length);

        return (
          <article
            className={`player-pill ${posClass} ${active ? "active" : ""} ${player.isBot ? "is-bot" : ""} ${isSkipped ? "skipped shake" : ""}`}
            key={player.sessionId}
            id={`player-pill-${player.seatIndex}`}
          >
            <div className="avatar-wrapper-pill" style={{ position: "relative" }}>
              {active && (
                <svg className="orbital-active-indicator" width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
                </svg>
              )}
              <AvatarIcon symbol={av.symbol} theme={av.theme} size={32} glow={active} overrideEmoji={overrideEmoji} />
              <TurnTimerRing active={active} turnDeadline={turnDeadline} />
              {isSkipped && (
                <div className="skip-overlay-badge" aria-label="Skipped Turn">
                  🚫
                </div>
              )}
            </div>
            <div
              className="player-pill-info"
              style={{ display: "flex", flexDirection: "column", gap: "2px", position: "relative" }}
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
              <small className={`opponent-card-gauge ${getCardCountClass(cardCount)}`}>
                {cardCount} Cards
              </small>

              {bubble && (
                <div className="avatar-action-bubble" style={{ "--bubble-color": bubble.themeColor } as CSSProperties}>
                  {bubble.text}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
