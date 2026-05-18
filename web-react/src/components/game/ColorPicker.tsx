import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnoColor } from '../../../../server/shared/uno';

const CARD_W = 240 / 375 * 0.55;
const CARD_H = 0.55;
const PICKER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const COLOR_HEX: Record<UnoColor, string> = {
  red: "#ff3333",
  blue: "#3377ff",
  green: "#33bb44",
  yellow: "#ffcc00",
};

interface CardState {
  scale: number;
  scaleVel: number;
  zOffset: number;
  zVel: number;
}

export function ColorPicker({
  hoveredPickerColor,
  onPickColor,
  onHoverColor,
}: {
  hoveredPickerColor: UnoColor | null;
  onPickColor: (_: UnoColor) => void;
  onHoverColor: (_: UnoColor | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null!);
  const overlayVel = useRef(0);
  const cardStates = useRef<Record<number, CardState>>({
    0: { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
    1: { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
    2: { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
    3: { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
  });
  const initialized = useRef(false);

  const STIFFNESS = 280;
  const DAMPING = 22;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = Date.now() / 1000;

    // Initialize card scales to 1 on first frame (spring in)
    if (!initialized.current && groupRef.current) {
      initialized.current = true;
      PICKER_COLORS.forEach((_, i) => {
        cardStates.current[i].scale = 1;
        cardStates.current[i].scaleVel = 0;
      });
    }

    // Overlay spring in
    if (overlayRef.current) {
      const cur = overlayRef.current.opacity;
      const acc = 200 * (0.55 - cur) - 30 * overlayVel.current;
      overlayVel.current += acc * dt;
      overlayRef.current.opacity = Math.max(0, Math.min(0.55, cur + overlayVel.current * dt));
    }

    PICKER_COLORS.forEach((color, i) => {
      const state = cardStates.current[i];
      const isHovered = hoveredPickerColor === color;
      const targetScale = isHovered ? 1.3 : 1.0;
      const targetZ = isHovered ? 0.08 : 0;

      const accScale = STIFFNESS * (targetScale - state.scale) - DAMPING * state.scaleVel;
      state.scaleVel += accScale * dt;
      state.scale += state.scaleVel * dt;

      const accZ = STIFFNESS * (targetZ - state.zOffset) - DAMPING * state.zVel;
      state.zVel += accZ * dt;
      state.zOffset += state.zVel * dt;

      const group = groupRef.current?.children[i + 2] as THREE.Group | undefined;
      if (group) {
        group.scale.setScalar(state.scale);
        const floatY = Math.sin(elapsed * 1.2 + i * 1.57) * 0.015;
        group.position.z = state.zOffset;
        group.position.y = Math.sin((i / 4) * Math.PI * 2 - Math.PI / 4) * 0.6 + floatY;
      }
    });
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 1.5]}>
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial ref={overlayRef} color="#0a1408" transparent opacity={0} />
      </mesh>

      <mesh position={[0, 0, 1.4]} onClick={() => onHoverColor(null)}>
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {PICKER_COLORS.map((color, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
        const r = 0.6;
        return (
          <group
            key={color}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
            scale={1}
          >
            {/* Front face — color */}
            <mesh position={[0, 0, 0.012]}>
              <boxGeometry args={[CARD_W, CARD_H, 0.02]} />
              <meshBasicMaterial color={COLOR_HEX[color]} />
            </mesh>
            {/* Back face — cream */}
            <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
              <boxGeometry args={[CARD_W, CARD_H, 0.025]} />
              <meshBasicMaterial color="#f5e6c8" />
            </mesh>
            {/* Hit area */}
            <mesh
              position={[0, 0, 0.03]}
              onClick={(e) => { e.stopPropagation(); onPickColor(color); }}
              onPointerEnter={() => onHoverColor(color)}
              onPointerLeave={() => onHoverColor(null)}
            >
              <boxGeometry args={[CARD_W, CARD_H, 0.01]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
