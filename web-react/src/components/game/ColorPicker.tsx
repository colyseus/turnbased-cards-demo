import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { UnoColor } from "../../../../server/shared/uno";

const PICKER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const COLOR_HEX: Record<UnoColor, string> = {
  red: "#e63946",
  blue: "#4361ee",
  green: "#2ec4b6",
  yellow: "#ffd60a",
};

interface ChipState {
  scale: number;
  scaleVel: number;
  lift: number;
  liftVel: number;
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
  const chipStates = useRef<Record<number, ChipState>>({
    0: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0 },
    1: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0 },
    2: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0 },
    3: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0 },
  });
  const initialized = useRef(false);

  const geometries = useMemo(
    () => ({
      overlay: new THREE.PlaneGeometry(25, 16),
      hit: new THREE.CircleGeometry(0.52, 40),
      chip: new THREE.CircleGeometry(0.4, 48),
      chipRing: new THREE.RingGeometry(0.42, 0.5, 48),
      tick: new THREE.BoxGeometry(0.08, 0.32, 0.01),
      connector: new THREE.RingGeometry(0.9, 1.02, 80, 1, 0, Math.PI * 0.34),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    };
  }, [geometries]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = Date.now() / 1000;

    if (!initialized.current && groupRef.current) {
      initialized.current = true;
      PICKER_COLORS.forEach((_, index) => {
        chipStates.current[index].scale = 1;
        chipStates.current[index].scaleVel = 0;
      });
    }

    if (overlayRef.current) {
      const cur = overlayRef.current.opacity;
      const acc = 200 * (0.58 - cur) - 30 * overlayVel.current;
      overlayVel.current += acc * dt;
      overlayRef.current.opacity = Math.max(0, Math.min(0.58, cur + overlayVel.current * dt));
    }

    PICKER_COLORS.forEach((color, index) => {
      const state = chipStates.current[index];
      const hovered = hoveredPickerColor === color;
      const targetScale = hovered ? 1.22 : 1;
      const targetLift = hovered ? 0.14 : 0;

      const scaleAcc = 260 * (targetScale - state.scale) - 22 * state.scaleVel;
      state.scaleVel += scaleAcc * dt;
      state.scale += state.scaleVel * dt;

      const liftAcc = 260 * (targetLift - state.lift) - 22 * state.liftVel;
      state.liftVel += liftAcc * dt;
      state.lift += state.liftVel * dt;

      const chip = groupRef.current?.children[index + 2] as THREE.Group | undefined;
      if (chip) {
        chip.scale.setScalar(state.scale);
        chip.position.z = state.lift;
        chip.rotation.z = Math.sin(elapsed * 1.3 + index) * 0.03;
      }
    });
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.08]} geometry={geometries.overlay}>
        <meshBasicMaterial ref={overlayRef} color="#05050d" transparent opacity={0} />
      </mesh>

      <mesh position={[0, 0, -0.07]} geometry={geometries.overlay} onClick={() => onHoverColor(null)}>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {PICKER_COLORS.map((color, index) => {
        const angle = (index / PICKER_COLORS.length) * Math.PI * 2 - Math.PI / 4;
        const r = 1.05;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        return (
          <group key={color} position={[x, y, 0.2]}>
            <mesh rotation={[0, 0, angle]} geometry={geometries.connector}>
              <meshBasicMaterial color={COLOR_HEX[color]} transparent opacity={0.18} />
            </mesh>
            <mesh geometry={geometries.chipRing}>
              <meshBasicMaterial color={hoveredPickerColor === color ? "#00e5ff" : "#ffffff"} transparent opacity={hoveredPickerColor === color ? 0.9 : 0.68} />
            </mesh>
            <mesh position={[0, 0, 0.01]} geometry={geometries.chip}>
              <meshBasicMaterial color={COLOR_HEX[color]} />
            </mesh>
            {[0, 1, 2, 3].map((tick) => (
              <mesh
                key={tick}
                position={[
                  Math.cos((tick * Math.PI) / 2) * 0.31,
                  Math.sin((tick * Math.PI) / 2) * 0.31,
                  0.025,
                ]}
                rotation={[0, 0, (tick * Math.PI) / 2]}
                geometry={geometries.tick}
              >
                <meshBasicMaterial color="#0f0f1a" transparent opacity={0.3} />
              </mesh>
            ))}
            <mesh
              position={[0, 0, 0.05]}
              geometry={geometries.hit}
              onClick={(event) => {
                event.stopPropagation();
                onPickColor(color);
              }}
              onPointerEnter={() => onHoverColor(color)}
              onPointerLeave={() => onHoverColor(null)}
            >
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
