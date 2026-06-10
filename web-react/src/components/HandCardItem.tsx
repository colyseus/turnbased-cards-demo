import type { CSSProperties, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { CardAtlasView } from "./CardAtlasView";
import { sfx } from "../audio/sfx";
import { cardLabel } from "../gameHelpers";
import type { CardSchema, UnoColor } from "../gameTypes";

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
  setSelectedCardIdx: (idx: number) => void;
  playCard: (card: CardSchema, color?: UnoColor) => void;
  onUnplayableTap: (card: CardSchema) => void;
}

export function HandCardItem({
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
  onUnplayableTap,
}: HandCardItemProps) {
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const cardRectRef = useRef<DOMRect | null>(null);
  const isNewRef = useRef(true);
  const isNew = isNewRef.current;

  useEffect(() => {
    if (!isNewRef.current) return;
    isNewRef.current = false;
  }, []);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const diffY = touchStartY.current - e.touches[0].clientY;
    const offset = diffY > 0 ? Math.min(90, diffY) : Math.max(-40, diffY);
    setDragY(offset);
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    e.preventDefault();

    if (dragY > 50) {
      if (playable) {
        playCard(card);
      } else {
        sfx.playPluck();
        onUnplayableTap(card);
      }
    } else if (dragY < -25) {
      if (isSelected) {
        setSelectedCardIdx(-1);
        sfx.playSwish();
      }
    } else if (Math.abs(dragY) < 10) {
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
  } as CSSProperties;

  return (
    <div
      className={`hand-card-wrapper ${playable ? "playable" : ""} ${isSelected ? "keyboard-focused" : ""} ${isNew ? "card-deal-in" : ""} ${card.color || ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={(e) => {
        if (isDragged) return;
        let rect = cardRectRef.current;
        if (!rect) {
          rect = e.currentTarget.getBoundingClientRect();
          cardRectRef.current = rect;
        }
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rx = (y / rect.height - 0.5) * -24;
        const ry = (x / rect.width - 0.5) * 24;
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        e.currentTarget.style.setProperty("--rx", `${rx}deg`);
        e.currentTarget.style.setProperty("--ry", `${ry}deg`);
        e.currentTarget.style.setProperty("--mx", `${px}%`);
        e.currentTarget.style.setProperty("--my", `${py}%`);
      }}
      onMouseLeave={(e) => {
        cardRectRef.current = null;
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
              onUnplayableTap(card);
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
        <div className="card-holo-shine" />
      </button>
    </div>
  );
}
