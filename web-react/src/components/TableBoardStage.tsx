import type { CSSProperties, ReactNode } from "react";

interface TableBoardStageProps {
  activeColor: string;
  spotlightPos: string;
  activePlayerThemeColor: string;
  children: ReactNode;
}

export function TableBoardStage({
  activeColor,
  spotlightPos,
  activePlayerThemeColor,
  children,
}: TableBoardStageProps) {
  return (
    <section
      className={`table-board active-${activeColor} spotlight-${spotlightPos}`}
      style={
        {
          "--active-player-color": activePlayerThemeColor,
        } as CSSProperties
      }
      aria-label="Game table felt"
    >
      {children}
    </section>
  );
}
