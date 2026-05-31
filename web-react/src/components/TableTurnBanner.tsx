import type { CSSProperties } from "react";

export interface TurnBanner {
  name: string;
  emoji: string;
  themeColor: string;
}

interface TableTurnBannerProps {
  turnBanner: TurnBanner;
}

export function TableTurnBanner({ turnBanner }: TableTurnBannerProps) {
  return (
    <div className="turn-banner-overlay">
      <div
        className="turn-banner-box"
        style={
          {
            "--banner-theme-color": turnBanner.themeColor,
          } as CSSProperties
        }
      >
        <span className="banner-emoji">{turnBanner.emoji}</span>
        <h2>{turnBanner.name}</h2>
        <p>{turnBanner.name === "Your Turn" ? "Make your move!" : "Thinking..."}</p>
      </div>
    </div>
  );
}
