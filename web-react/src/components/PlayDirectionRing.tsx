import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

interface PlayDirectionRingProps {
  direction: number;
}

export function PlayDirectionRing({ direction }: PlayDirectionRingProps) {
  const isClockwise = direction !== -1;
  const [isFlipping, setIsFlipping] = useState(false);
  const prevDirection = useRef(direction);

  useEffect(() => {
    if (prevDirection.current !== direction) {
      setIsFlipping(true);
      const timer = setTimeout(() => setIsFlipping(false), 800);
      prevDirection.current = direction;
      return () => clearTimeout(timer);
    }
  }, [direction]);

  const ringStyle = {
    "--direction-current-speed": "1.5s",
    "--direction-current-stroke": "3.5px",
    "--direction-current-glow": "0 0 10px var(--gold)",
  } as CSSProperties;

  return (
    <div
      className={`direction-ring-container ${isClockwise ? "clockwise" : "counter-clockwise"} ${
        isFlipping ? "direction-flip" : ""
      }`}
      style={ringStyle}
    >
      <svg width="100%" height="100%" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="transparent" stopOpacity="0" />
            <stop offset="90%" stopColor="var(--gold)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="url(#ringGlow)" />
        <circle
          cx="100"
          cy="100"
          r="84"
          className="direction-dotted-ring"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeDasharray="6 12"
          strokeOpacity="0.3"
        />
        <circle
          cx="100"
          cy="100"
          r="84"
          className="direction-fluid-sweep"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <g transform="translate(100, 100)">
          <g className="direction-arrows-group">
            {isClockwise ? (
              <>
                <path d="M 0,-88 L 8,-80 L 0,-72" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M 88,0 L 80,8 L 72,0" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M 0,88 L -8,80 L 0,72" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M -88,0 L -80,-8 L -72,0" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
              </>
            ) : (
              <>
                <path d="M 0,-88 L -8,-80 L 0,-72" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M 88,0 L 80,-8 L 72,0" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M 0,88 L 8,80 L 0,72" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M -88,0 L -80,8 L -72,0" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
              </>
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}
