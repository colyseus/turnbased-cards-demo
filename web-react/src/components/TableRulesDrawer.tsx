import type { RefObject } from "react";
import { CardAtlasView } from "./CardAtlasView";
import { RULE_CARD_EXAMPLES } from "./tableRoomModel";

interface TableRulesDrawerProps {
  colorblindMode: boolean;
  rulesDialogRef: RefObject<HTMLDivElement | null>;
  onReplayGuide: () => void;
  onCloseRules: () => void;
}

export function TableRulesDrawer({
  colorblindMode,
  rulesDialogRef,
  onReplayGuide,
  onCloseRules,
}: TableRulesDrawerProps) {
  return (
    <>
      <div className="drawer-overlay" onClick={onCloseRules} />
      <div
        className="drawer-content"
        ref={rulesDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-drawer-title"
        tabIndex={-1}
      >
        <div className="drawer-header">
          <h2 id="rules-drawer-title">Rules & Shortcuts</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="ghost-btn" data-testid="rules-replay-guide" onClick={onReplayGuide} type="button">
              Replay guide
            </button>
            <button className="ghost-btn" data-testid="rules-close" onClick={onCloseRules} type="button">
              Close
            </button>
          </div>
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
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>◀</kbd>
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>▶</kbd>{" "}
                Select Cards
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Space</kbd>
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Enter</kbd>{" "}
                Play Selected Card
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>D</kbd>{" "}
                Draw Card from deck
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>U</kbd>{" "}
                Call UNO!
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>C</kbd>{" "}
                Open & Focus Chat input
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>R</kbd>{" "}
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Y</kbd>{" "}
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>G</kbd>{" "}
                /{" "}
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>B</kbd>{" "}
                Select Wild Color (Red/Yellow/Green/Blue)
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>Esc</kbd>{" "}
                Cancel Wild Color selection
              </li>
              <li>
                <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>?</kbd>{" "}
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
            <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--text-muted)", marginTop: "8px" }}>
              <strong>Draw Stacking:</strong> Draw-2 and Wild Draw-4 cards accumulate pending
              draw values. Draw stack triggers must be drawn unless stacked further with another
              matching draw card.
            </p>
          </section>

          <section>
            <h3 style={{ color: "var(--gold)", marginBottom: "8px" }}>Action Card Guide</h3>
            <p className="rule-guide-intro">
              Number cards match by color or number. These illustrated cards change the turn:
            </p>
            <ul className="rule-card-grid">
              {RULE_CARD_EXAMPLES.map(({ card, title, text }) => (
                <li key={card.id}>
                  <div className="rule-card-preview" aria-hidden="true">
                    <CardAtlasView card={card} colorblind={colorblindMode} />
                  </div>
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
