import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnoColor } from '../../../../server/shared/uno';

const PICKER_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
const COLOR_HEX: Record<UnoColor, string> = {
  red: '#e63946',
  blue: '#4361ee',
  green: '#2ec4b6',
  yellow: '#ffd60a',
};

interface ChipState {
  scale: number;
  scaleVel: number;
  lift: number;
  liftVel: number;
  haloRadius: number;
  haloOpacity: number;
}

interface Sparkle {
  angle: number;
  speed: number;
  radius: number;
  size: number;
  phase: number;
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
    0: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0, haloRadius: 0.5, haloOpacity: 0 },
    1: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0, haloRadius: 0.5, haloOpacity: 0 },
    2: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0, haloRadius: 0.5, haloOpacity: 0 },
    3: { scale: 0, scaleVel: 0, lift: 0, liftVel: 0, haloRadius: 0.5, haloOpacity: 0 },
  });
  const initialized = useRef(false);
  const sparkles = useRef<Sparkle[]>(
    Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.4,
      radius: 1.6 + Math.random() * 0.5,
      size: 0.03 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
    }))
  );
  const sparkleRefs = useRef<THREE.Mesh[]>([]);
  const haloRefs = useRef<THREE.Mesh[]>([]);
  const isOpen = useRef(false);

  const geometries = useMemo(
    () => ({
      overlay: new THREE.PlaneGeometry(25, 16),
      hit: new THREE.CircleGeometry(0.52, 40),
      chip: new THREE.CircleGeometry(0.4, 48),
      chipRing: new THREE.RingGeometry(0.42, 0.5, 48),
      pulseRing: new THREE.RingGeometry(0.5, 0.58, 48),
      tick: new THREE.BoxGeometry(0.08, 0.32, 0.01),
      connector: new THREE.RingGeometry(0.9, 1.02, 80, 1, 0, Math.PI * 0.34),
      sparkle: new THREE.CircleGeometry(1, 8),
      halo: new THREE.RingGeometry(0.5, 0.6, 48),
      innerAccent: new THREE.RingGeometry(0.22, 0.28, 48),
    }),
    []
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
      isOpen.current = true;
      PICKER_COLORS.forEach((_, index) => {
        chipStates.current[index].scale = 1;
        chipStates.current[index].scaleVel = 0;
      });
    }

    // Overlay with soft blur-like appearance
    if (overlayRef.current) {
      const cur = overlayRef.current.opacity;
      const targetOpacity = 0.72;
      const acc = 200 * (targetOpacity - cur) - 30 * overlayVel.current;
      overlayVel.current += acc * dt;
      overlayRef.current.opacity = Math.max(0, Math.min(targetOpacity, cur + overlayVel.current * dt));
    }

    // Slow group rotation when open
    if (groupRef.current && isOpen.current) {
      groupRef.current.rotation.z += 0.05 * dt;
    }

    // Sparkle orbit animation
    sparkles.current.forEach((sparkle, i) => {
      sparkle.angle += sparkle.speed * dt;
      const sparkleMesh = sparkleRefs.current[i];
      if (sparkleMesh) {
        const wobble = Math.sin(elapsed * 2 + sparkle.phase) * 0.15;
        sparkleMesh.position.x = Math.cos(sparkle.angle) * (sparkle.radius + wobble);
        sparkleMesh.position.y = Math.sin(sparkle.angle) * (sparkle.radius + wobble);
        sparkleMesh.position.z = 0.35;
        const pulse = 0.6 + Math.sin(elapsed * 4 + sparkle.phase) * 0.4;
        (sparkleMesh.material as THREE.MeshBasicMaterial).opacity = pulse * 0.85;
      }
    });

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

      // Halo animation: expand and fade when hovering
      if (hovered) {
        state.haloRadius = Math.min(state.haloRadius + dt * 0.8, 1.2);
        state.haloOpacity = Math.min(state.haloOpacity + dt * 3, 0.6);
      } else {
        state.haloRadius = Math.max(state.haloRadius - dt * 2, 0.5);
        state.haloOpacity = Math.max(state.haloOpacity - dt * 4, 0);
      }

      const chip = groupRef.current?.children[index + 2] as THREE.Group | undefined;
      if (chip) {
        chip.scale.setScalar(state.scale);
        chip.position.z = state.lift;
        chip.rotation.z = Math.sin(elapsed * 1.3 + index) * 0.03;
      }

      // Update halo mesh
      const haloMesh = haloRefs.current[index];
      if (haloMesh) {
        haloMesh.scale.setScalar(state.haloRadius);
        (haloMesh.material as THREE.MeshBasicMaterial).opacity = state.haloOpacity;
        haloMesh.position.z = 0.15;
      }
    });
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.08]} geometry={geometries.overlay}>
        <meshBasicMaterial ref={overlayRef} color="#0a0a14" transparent opacity={0} />
      </mesh>

      <mesh
        position={[0, 0, -0.07]}
        geometry={geometries.overlay}
        onClick={() => onHoverColor(null)}
      >
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Sparkle dots orbiting */}
      {sparkles.current.map((_, i) => (
        <mesh
          key={`sparkle-${i}`}
          ref={(el) => {
            if (el) sparkleRefs.current[i] = el;
          }}
          geometry={geometries.sparkle}
          scale={sparkles.current[i].size}
        >
          <meshBasicMaterial
            color="#00e5ff"
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
      ))}

      {PICKER_COLORS.map((color, index) => {
        const angle = (index / PICKER_COLORS.length) * Math.PI * 2 - Math.PI / 4;
        const r = 1.05;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        return (
          <group key={color} position={[x, y, 0.2]}>
            {/* Connector arc with glow */}
            <mesh rotation={[0, 0, angle]} geometry={geometries.connector}>
              <meshBasicMaterial
                color={COLOR_HEX[color]}
                transparent
                opacity={hoveredPickerColor === color ? 0.55 : 0.18}
                toneMapped={false}
              />
            </mesh>

            {/* Expanding halo ring */}
            <mesh
              ref={(el) => {
                if (el) haloRefs.current[index] = el;
              }}
              geometry={geometries.halo}
            >
              <meshBasicMaterial
                color={COLOR_HEX[color]}
                transparent
                opacity={0}
                toneMapped={false}
              />
            </mesh>

            {/* Pulsing ring on hover */}
            <mesh geometry={geometries.pulseRing}>
              <meshBasicMaterial
                color="#00e5ff"
                transparent
                opacity={hoveredPickerColor === color ? 0.5 + Math.sin(Date.now() / 150) * 0.2 : 0}
                toneMapped={false}
              />
            </mesh>

            {/* Outer glow ring */}
            <mesh geometry={geometries.chipRing}>
              <meshBasicMaterial
                color={hoveredPickerColor === color ? '#00e5ff' : '#ffffff'}
                transparent
                opacity={hoveredPickerColor === color ? 0.9 : 0.68}
              />
            </mesh>

            {/* Inner accent ring */}
            <mesh geometry={geometries.innerAccent}>
              <meshBasicMaterial
                color={COLOR_HEX[color]}
                transparent
                opacity={0.4}
                toneMapped={false}
              />
            </mesh>

            {/* Main chip */}
            <mesh position={[0, 0, 0.01]} geometry={geometries.chip}>
              <meshBasicMaterial color={COLOR_HEX[color]} />
            </mesh>

            {/* Enhanced tick marks */}
            {[0, 1, 2, 3].map((tick) => (
              <mesh
                key={tick}
                position={[
                  Math.cos((tick * Math.PI) / 2) * 0.25,
                  Math.sin((tick * Math.PI) / 2) * 0.25,
                  0.025,
                ]}
                rotation={[0, 0, (tick * Math.PI) / 2]}
                geometry={geometries.tick}
              >
                <meshBasicMaterial color="#0f0f1a" transparent opacity={0.35} />
              </mesh>
            ))}

            {/* Diagonal accent ticks */}
            {[0, 1, 2, 3].map((tick) => (
              <mesh
                key={`diag-${tick}`}
                position={[
                  Math.cos((tick * Math.PI) / 2 + Math.PI / 4) * 0.18,
                  Math.sin((tick * Math.PI) / 2 + Math.PI / 4) * 0.18,
                  0.026,
                ]}
                rotation={[0, 0, (tick * Math.PI) / 2 + Math.PI / 4]}
                scale={[0.6, 0.6, 1]}
                geometry={geometries.tick}
              >
                <meshBasicMaterial color="#0f0f1a" transparent opacity={0.25} />
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
