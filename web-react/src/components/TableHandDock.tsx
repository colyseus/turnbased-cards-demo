import type { CSSProperties, RefObject } from "react";
import { HandCardItem } from "./HandCardItem";
import type { CardSchema, UnoColor, UnoState } from "../gameTypes";
import { isPlayable } from "../gameHelpers";

type ActionCallout =
  | {
      kind: "uno";
      title: string;
      text: string;
    }
  | {
      kind: "penalty";
      title: string;
      text: string;
    }
  | null;

interface HandDockProps {
  room: { send: (type: string, payload?: unknown) => void } | null;
  state: UnoState | null;
  meSeatIndex: number | undefined;
  isMyTurn: boolean;
  actionCallout: ActionCallout;
  guidanceText: string;
  guidanceStatus: string;
  sortBy: "none" | "color" | "value";
  setSortBy: (value: "none" | "color" | "value") => void;
  actionBubbleLocal: { text: string; themeColor: string } | undefined;
  hand: CardSchema[];
  handCount: number;
  handMid: number;
  dynamicFanAngle: number;
  dynamicFanOffset: number;
  dynamicMarginValue: string;
  selectedCardIdx: number;
  setSelectedCardIdx: (idx: number) => void;
  playCard: (card: CardSchema, color?: UnoColor) => void;
  onUnplayableTap: (card: CardSchema) => void;
  scrollHand: (direction: "left" | "right") => void;
  handScrollRef: RefObject<HTMLDivElement | null>;
  showToast: (message: string, kind?: "info" | "success" | "warning" | "error") => void;
  colorblindMode: boolean;
}

export function TableHandDock({
  room,
  state,
  meSeatIndex,
  isMyTurn,
  actionCallout,
  guidanceText,
  guidanceStatus,
  sortBy,
  setSortBy,
  actionBubbleLocal,
  hand,
  handCount,
  handMid,
  dynamicFanAngle,
  dynamicFanOffset,
  dynamicMarginValue,
  selectedCardIdx,
  setSelectedCardIdx,
  playCard,
  onUnplayableTap,
  scrollHand,
  handScrollRef,
  showToast,
  colorblindMode,
}: HandDockProps) {
  return (
    <section
      id="hand-dock"
      className={`hand-dock ${isMyTurn ? "my-turn" : ""}`}
      aria-label="Your hand cards dock"
    >
      {actionCallout && (
        <div
          className={`turn-action-callout ${actionCallout.kind}`}
          data-action-kind={actionCallout.kind}
          role="status"
        >
          <span>{actionCallout.kind === "uno" ? "Action required" : "Draw penalty active"}</span>
          <strong>{actionCallout.title}</strong>
          <small>{actionCallout.text}</small>
        </div>
      )}

      <div className="hand-header hand-header-layout">
        <div className="hand-header-copy">
          <span>{isMyTurn ? "YOUR TURN" : "YOUR HAND"}</span>
          <strong className={`hand-guidance-text ${guidanceStatus}`}>{guidanceText}</strong>
        </div>

        {actionBubbleLocal && (
          <div className="avatar-action-bubble local" style={{ "--bubble-color": actionBubbleLocal.themeColor } as CSSProperties}>
            {actionBubbleLocal.text}
          </div>
        )}

        <div className="hand-header-actions">
          <div className="sort-row">
            <button className={`sort-btn ${sortBy === "none" ? "active" : ""}`} onClick={() => setSortBy("none")} type="button">
              Default
            </button>
            <button className={`sort-btn ${sortBy === "color" ? "active" : ""}`} onClick={() => setSortBy("color")} type="button">
              Color
            </button>
            <button className={`sort-btn ${sortBy === "value" ? "active" : ""}`} onClick={() => setSortBy("value")} type="button">
              Rank
            </button>
          </div>

          {state?.unoCaller === meSeatIndex && (
            <button
              className="uno-btn"
              onClick={() => {
                room?.send("uno");
                showToast("UNO called successfully!", "success");
              }}
              type="button"
            >
              UNO!
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        {handCount > 5 && (
          <button className="scroll-indicator-btn left" onClick={() => scrollHand("left")} type="button">
            ◀
          </button>
        )}
        <div className="hand-scroll-wrapper" ref={handScrollRef}>
          {handCount === 0 ? (
            <p className="empty-hand">{state ? "Dealing initial cards..." : "Spectating Table"}</p>
          ) : (
            hand.map((card, idx) => {
              const playable = isMyTurn && isPlayable(card, state);
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
                  onUnplayableTap={onUnplayableTap}
                />
              );
            })
          )}
        </div>
        {handCount > 5 && (
          <button className="scroll-indicator-btn right" onClick={() => scrollHand("right")} type="button">
            ▶
          </button>
        )}
      </div>
    </section>
  );
}
