import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

interface StardustParticle {
  id: string;
  left: string;
  delay: string;
  duration: string;
  size: string;
  color: string;
}

export function AmbientStardust() {
  const [dots, setDots] = useState<StardustParticle[]>([]);
  const particleIdRef = useRef(0);

  useEffect(() => {
    const initialDots: StardustParticle[] = Array.from({ length: 18 }).map(() => {
      const isViolet = Math.random() > 0.5;
      const color = isViolet ? "hsla(280, 75%, 65%, 0.15)" : "hsla(46, 95%, 65%, 0.12)";
      return {
        id: `stardust-${particleIdRef.current++}`,
        left: `${5 + Math.random() * 90}%`,
        delay: `${Math.random() * -12}s`,
        duration: `${8 + Math.random() * 10}s`,
        size: `${2 + Math.random() * 4}px`,
        color,
      };
    });
    setDots(initialDots);
  }, []);

  return (
    <div className="ambient-stardust-container">
      {dots.map((d) => (
        <div
          key={d.id}
          className="stardust-particle"
          style={
            {
              left: d.left,
              animationDelay: d.delay,
              animationDuration: d.duration,
              width: d.size,
              height: d.size,
              background: d.color,
              boxShadow: `0 0 10px ${d.color}`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
