import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnoColor } from '../../../../server/shared/uno';

const PICKER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const PICKER_STAGGER_MS = 80;
const COLOR_HEX: Record<UnoColor, string> = {
  red: "#ff3333",
  blue: "#3377ff",
  green: "#33bb44",
  yellow: "#ffcc00",
};

export function ColorPicker({
  hoveredPickerColor,
  onPickColor,
  onHoverColor,
}: {
  hoveredPickerColor: UnoColor | null;
  onPickColor: (_: UnoColor) => void;
  onHoverColor: (_: UnoColor | null) => void;
}) {
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null!);
  const circleRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const circleVels = useRef([0, 0, 0, 0]);
  const elapsed = useRef(0);
  const overlayVel = useRef(0);

  // Memoize geometries
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(25, 16), []);
  const circleGeo = useMemo(() => new THREE.CircleGeometry(0.35, 32), []);

  // Cleanup
  useEffect(() => {
    return () => {
      planeGeo.dispose();
      circleGeo.dispose();
    };
  }, [planeGeo, circleGeo]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;

    if (overlayRef.current) {
        const curOpacity = overlayRef.current.opacity;
        const accO = 200 * (0.5 - curOpacity) - 30 * overlayVel.current;
        overlayVel.current += accO * dt;
        overlayRef.current.opacity = curOpacity + overlayVel.current * dt;
    }

    for (let i = 0; i < 4; i++) {
      const mesh = circleRefs.current[i];
      if (!mesh) continue;
      const delay = ((i + 1) * PICKER_STAGGER_MS) / 1000;
      const target =
        elapsed.current > delay
          ? hoveredPickerColor === PICKER_COLORS[i]
            ? 1.3
            : 1
          : 0;
      const cur = mesh.scale.x;
      const acc = 200 * (target - cur) - 30 * circleVels.current[i];
      circleVels.current[i] += acc * dt;
      mesh.scale.setScalar(Math.max(0, cur + circleVels.current[i] * dt));
    }
  });

  return (
    <>
      <mesh position={[0, 0, 1.9]} geometry={planeGeo}>
        <meshBasicMaterial
          ref={overlayRef}
          color="#000000"
          transparent
          opacity={0}
        />
      </mesh>
      {PICKER_COLORS.map((color, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
        const r = 0.6;
        return (
          <mesh
            key={`picker-${color}`}
            ref={(el) => {
              circleRefs.current[i] = el;
            }}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 2]}
            scale={0}
            onClick={(e) => {
              e.stopPropagation();
              onPickColor(color);
            }}
            onPointerEnter={() => {
              document.body.style.cursor = "pointer";
              onHoverColor(color);
            }}
            onPointerLeave={() => {
              document.body.style.cursor = "auto";
              onHoverColor(null);
            }}
            geometry={circleGeo}
          >
            <meshBasicMaterial color={COLOR_HEX[color]} />
          </mesh>
        );
      })}
    </>
  );
}
