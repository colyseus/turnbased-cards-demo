import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SEAT_COUNT = 4;
const ORBIT_RADIUS = 2.86;
const STIFFNESS = 180;
const DAMPING = 18;
const ACCENT = '#00e5ff';
const SURFACE = '#0f0f1a';
const ELEVATED = '#252540';
const MUTED = '#888899';
const WHITE = '#ffffff';

export function TurnIndicator({
  activePlayerIndex,
  reverse,
}: {
  activePlayerIndex: number;
  reverse: boolean;
}) {
  const activeRef = useRef<THREE.Group>(null!);
  const orbitRef = useRef<THREE.Group>(null!);
  const currentRotation = useRef(0);
  const rotationVel = useRef(0);

  const geometries = useMemo(
    () => ({
      seatRing: new THREE.RingGeometry(0.13, 0.26, 36),
      seatCore: new THREE.CircleGeometry(0.1, 32),
      orbitArc: new THREE.RingGeometry(
        ORBIT_RADIUS - 0.02,
        ORBIT_RADIUS + 0.03,
        96,
        1,
        0.05,
        Math.PI * 0.28
      ),
      activeHalo: new THREE.RingGeometry(0.48, 0.55, 56),
      activePuck: new THREE.RingGeometry(0.28, 0.43, 48),
      activeCore: new THREE.CircleGeometry(0.16, 32),
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
    const targetAngle = -(activePlayerIndex / SEAT_COUNT) * Math.PI * 2;

    let deltaAngle = targetAngle - currentRotation.current;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    const acc = STIFFNESS * deltaAngle - DAMPING * rotationVel.current;
    rotationVel.current += acc * dt;
    currentRotation.current += rotationVel.current * dt;

    if (activeRef.current) {
      activeRef.current.rotation.z = currentRotation.current;
    }

    if (orbitRef.current) {
      orbitRef.current.rotation.z += dt * (reverse ? -0.24 : 0.24);
    }
  });

  return (
    <group position={[0, 0, 0.02]}>
      <group ref={orbitRef}>
        {[0, 1, 2, 3].map((index) => (
          <mesh
            key={index}
            rotation={[0, 0, (index * Math.PI * 2) / SEAT_COUNT]}
            geometry={geometries.orbitArc}
          >
            <meshBasicMaterial color={ACCENT} transparent opacity={0.18} />
          </mesh>
        ))}
      </group>

      {Array.from({ length: SEAT_COUNT }, (_, index) => {
        const angle = (index / SEAT_COUNT) * Math.PI * 2;
        const active = index === activePlayerIndex;
        return (
          <group
            key={index}
            position={[Math.sin(angle) * ORBIT_RADIUS, Math.cos(angle) * ORBIT_RADIUS, 0.02]}
          >
            {active && (
              <mesh geometry={geometries.activeHalo}>
                <meshBasicMaterial color={ACCENT} transparent opacity={0.14} />
              </mesh>
            )}
            <mesh geometry={geometries.seatRing}>
              <meshBasicMaterial
                color={active ? ACCENT : MUTED}
                transparent
                opacity={active ? 0.52 : 0.18}
              />
            </mesh>
            <mesh geometry={geometries.seatCore}>
              <meshBasicMaterial
                color={active ? ACCENT : ELEVATED}
                transparent
                opacity={active ? 0.58 : 0.62}
              />
            </mesh>
          </group>
        );
      })}

      <group ref={activeRef}>
        <group position={[0, ORBIT_RADIUS, 0.045]}>
          <mesh geometry={geometries.activePuck}>
            <meshBasicMaterial color={ACCENT} transparent opacity={0.3} />
          </mesh>
          <mesh geometry={geometries.activeCore}>
            <meshBasicMaterial color={WHITE} transparent opacity={0.78} />
          </mesh>
          <mesh scale={[0.62, 0.62, 1]} geometry={geometries.activeCore}>
            <meshBasicMaterial color={SURFACE} transparent opacity={0.86} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
