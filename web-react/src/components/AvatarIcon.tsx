import type { CSSProperties } from "react";
import { AVATAR_SYMBOLS, AVATAR_THEMES } from "../tableConfig";

interface AvatarIconProps {
  symbol: string;
  theme: string;
  size?: number;
  glow?: boolean;
  overrideEmoji?: string;
}

export function AvatarIcon({ symbol, theme, size = 48, glow = true, overrideEmoji }: AvatarIconProps) {
  const symInfo = AVATAR_SYMBOLS.find((s) => s.id === symbol) || AVATAR_SYMBOLS[0];
  const themeInfo = AVATAR_THEMES.find((t) => t.id === theme) || AVATAR_THEMES[0];
  const emojiToRender = overrideEmoji || symInfo.emoji;

  return (
    <div
      className={`avatar-circle ${glow ? "avatar-glow" : ""}`}
      style={
        {
          "--avatar-size": `${size}px`,
          "--avatar-primary": themeInfo.primary,
          "--avatar-secondary": themeInfo.secondary,
        } as CSSProperties
      }
    >
      <div className="avatar-background" />
      <span className="avatar-emoji" style={{ fontSize: `${size * 0.5}px` }}>
        {emojiToRender}
      </span>
      <svg className="avatar-ring" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={`url(#grad-${themeInfo.id})`}
          strokeWidth="4"
        />
        <defs>
          <linearGradient id={`grad-${themeInfo.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themeInfo.primary} />
            <stop offset="100%" stopColor={themeInfo.secondary} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
