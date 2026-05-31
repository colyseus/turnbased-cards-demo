import type { CSSProperties } from "react";
import { cardTextureFromSchema } from "../../../shared/index.ts";
import type { CardSchema } from "../gameTypes";
import { ATLAS_ORDER } from "../tableConfig";
import { cardLabel } from "../gameHelpers";

interface CardAtlasViewProps {
  card: CardSchema | null;
  isBack?: boolean;
  colorblind?: boolean;
  skin?: string;
}

export function CardAtlasView({
  card,
  isBack = false,
  colorblind = false,
  skin = "classic",
}: CardAtlasViewProps) {
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

  if (isCardBack && skin === "classic") {
    return (
      <div className="card-sprite card-back skin-classic" title="UNO Card Back">
        <svg className="classic-back-svg" viewBox="0 0 100 156" width="100%" height="100%">
          <defs>
            <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d43f3f" />
              <stop offset="35%" stopColor="#9b1a1a" />
              <stop offset="100%" stopColor="#1c0505" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffe699" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#aa7c11" />
            </linearGradient>
            <filter id="centerGlow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect x="0" y="0" width="100" height="156" rx="10" fill="url(#backGrad)" />
          <rect x="5" y="5" width="90" height="146" rx="7" fill="none" stroke="url(#goldGrad)" strokeWidth="1.5" />
          <rect x="7" y="7" width="86" height="142" rx="6" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />

          <path d="M 10,16 L 16,10" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.65" />
          <path d="M 90,16 L 84,10" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.65" />
          <path d="M 10,140 L 16,146" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.65" />
          <path d="M 90,140 L 84,146" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.65" />

          <ellipse cx="50" cy="78" rx="28" ry="18" fill="rgba(17, 14, 25, 0.45)" stroke="url(#goldGrad)" strokeWidth="1.25" />
          <polygon points="50,66 62,78 50,90 38,78" fill="rgba(17, 14, 25, 0.75)" stroke="url(#goldGrad)" strokeWidth="1" />
          <circle cx="50" cy="72" r="2.5" fill="#d45444" />
          <circle cx="56" cy="78" r="2.5" fill="#378cc6" />
          <circle cx="50" cy="84" r="2.5" fill="#4da66d" />
          <circle cx="44" cy="78" r="2.5" fill="#edc84e" />
          <circle cx="50" cy="78" r="1.5" fill="#ffffff" filter="url(#centerGlow)" />
        </svg>
        <div className="card-holo-shine" />
      </div>
    );
  }

  if (isCardBack && skin === "cyber") {
    return (
      <div className="card-sprite card-back skin-cyber" title="Cyber Card Back">
        <div className="cyber-carbon-pattern" />
        <svg className="cyber-circuit-svg" viewBox="0 0 100 156" width="100%" height="100%">
          <rect x="4" y="4" width="92" height="148" rx="6" fill="none" stroke="rgba(242, 169, 0, 0.25)" strokeWidth="1.5" />
          <path d="M 10,20 L 25,20 L 35,30 L 35,55 L 45,65" fill="none" stroke="#f2a900" strokeWidth="1.5" className="cyber-path path-1" />
          <path d="M 90,20 L 75,20 L 65,30 L 65,55 L 55,65" fill="none" stroke="#f2a900" strokeWidth="1.5" className="cyber-path path-2" />
          <path d="M 10,136 L 25,136 L 35,126 L 35,101 L 45,91" fill="none" stroke="#f2a900" strokeWidth="1.5" className="cyber-path path-3" />
          <path d="M 90,136 L 75,136 L 65,126 L 65,101 L 55,91" fill="none" stroke="#f2a900" strokeWidth="1.5" className="cyber-path path-4" />
          <rect x="40" y="68" width="20" height="20" rx="3" fill="#110e19" stroke="#f2a900" strokeWidth="2" className="cyber-chip" />
          <circle cx="50" cy="78" r="4" fill="#f2a900" className="cyber-node" />
        </svg>
      </div>
    );
  }

  if (isCardBack && skin === "cosmic") {
    return (
      <div className="card-sprite card-back skin-cosmic" title="Cosmic Card Back">
        <div className="cosmic-nebula-bg" />
        <div className="cosmic-dust-overlay" />
        <svg className="cosmic-stars-svg" viewBox="0 0 100 156" width="100%" height="100%">
          <rect x="4" y="4" width="92" height="148" rx="6" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <line x1="20" y1="30" x2="35" y2="55" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.75" />
          <line x1="35" y1="55" x2="65" y2="40" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.75" />
          <line x1="65" y1="40" x2="80" y2="70" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.75" />
          <line x1="80" y1="70" x2="50" y2="105" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.75" />
          <line x1="50" y1="105" x2="25" y2="125" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.75" />
          <circle cx="20" cy="30" r="1.5" fill="#fff" className="cosmic-star star-1" />
          <circle cx="35" cy="55" r="2.2" fill="#80e5ff" className="cosmic-star star-2" />
          <circle cx="65" cy="40" r="1.8" fill="#fff" className="cosmic-star star-3" />
          <circle cx="80" cy="70" r="2.5" fill="#ff99e6" className="cosmic-star star-4" />
          <circle cx="50" cy="105" r="3" fill="#fff" className="cosmic-star star-5" />
          <circle cx="25" cy="125" r="1.5" fill="#80e5ff" className="cosmic-star star-6" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`card-sprite ${isCardBack ? "card-back" : ""}`}
      style={{ "--col": col, "--row": row } as CSSProperties}
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
