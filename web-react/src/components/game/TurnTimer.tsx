import { useRef, useEffect } from 'react';

const HUMAN_TURN_MS = 7000;
const BOT_TURN_MS = 800;

export function TurnTimer({ deadline, isBot }: { deadline: number; isBot: boolean }) {
  const svgRef = useRef<SVGCircleElement>(null!);
  const duration = isBot ? BOT_TURN_MS : HUMAN_TURN_MS;

  useEffect(() => {
    let raf: number;
    function tick() {
      const remaining = Math.max(0, deadline - Date.now());
      const progress = Math.min(1, remaining / duration);
      const circle = svgRef.current;
      if (circle) {
        const circumference = 2 * Math.PI * 9;
        circle.style.strokeDashoffset = String(
          circumference * (1 - progress),
        );
        // Color: calm accent -> warning -> danger.
        if (progress > 0.5) {
          circle.style.stroke = "#00e5ff";
        } else if (progress > 0.2) {
          circle.style.stroke = "#ffd60a";
        } else {
          circle.style.stroke = "#e63946";
        }
      }
      if (remaining > 0) raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [deadline, duration]);

  const circumference = 2 * Math.PI * 9;

  return (
    <svg className="turn-timer" width="22" height="22" viewBox="0 0 22 22">
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="2.5"
      />
      <circle
        ref={svgRef}
        cx="11"
        cy="11"
        r="9"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset="0"
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}
