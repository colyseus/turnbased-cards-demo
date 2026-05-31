import type { RefObject } from "react";
import { colors } from "./tableRoomModel";
import type { UnoColor } from "../gameTypes";

interface TableWildColorModalProps {
  wildDialogRef: RefObject<HTMLDivElement | null>;
  onCloseWild: () => void;
  onSelectWildColor: (color: UnoColor) => void;
}

export function TableWildColorModal({
  wildDialogRef,
  onCloseWild,
  onSelectWildColor,
}: TableWildColorModalProps) {
  return (
    <div
      className="color-modal"
      ref={wildDialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wild-color-title"
      tabIndex={-1}
    >
      <div className="color-wheel-overlay-bg" onClick={onCloseWild} />
      <div className="color-wheel-container">
        <h2 id="wild-color-title">Select Wild Color</h2>
        <div className="circular-color-wheel">
          {colors.map((color) => (
            <button
              key={color}
              className={`color-wheel-slice color-${color}`}
              data-testid={`wild-color-${color}`}
              onClick={() => onSelectWildColor(color)}
              type="button"
              aria-label={`Select color ${color}`}
            >
              <span className="slice-text">{color}</span>
            </button>
          ))}
          <div className="color-wheel-center-nub">
            <span>🌈</span>
          </div>
        </div>
        <button className="ghost-btn cancel-wheel-btn" data-testid="wild-cancel" onClick={onCloseWild} type="button">
          Cancel Selection
        </button>
      </div>
    </div>
  );
}
