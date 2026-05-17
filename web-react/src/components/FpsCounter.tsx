import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Simple FPS counter displayed in the top-right corner of the canvas. */
export function FpsCounter() {
  const frames = useRef(0);
  const last = useRef(performance.now());
  const fps = useRef(0);

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const delta = now - last.current;
    if (delta >= 1000) {
      fps.current = Math.round((frames.current * 1000) / delta);
      frames.current = 0;
      last.current = now;
    }
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 100,
        fontFamily: "monospace",
        fontSize: 12,
        color: "#fff",
        background: "rgba(0,0,0,0.5)",
        padding: "2px 6px",
        borderRadius: 4,
        pointerEvents: "none",
      }}
    >
      FPS: {fps.current}
    </div>
  );
}
