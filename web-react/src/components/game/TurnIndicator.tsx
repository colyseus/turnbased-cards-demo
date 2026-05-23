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
      orbitTick: new THREE.BoxGeometry(0.025, 0.06, 0.01),
      activeHalo: new THREE.RingGeometry(0.48, 0.55, 56),
      activePuck: new THREE.RingGeometry(0.28, 0.43, 48),
      activeCore: new THREE.CircleGeometry(0.16, 32),
      trailRing: new THREE.RingGeometry(0.32, 0.4, 48),
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
      // Breathing effect: scale oscillates 1.0 → 1.05 over 1s
      const breathe = 1 + 0.025 * Math.sin(Date.now() * 0.006);
      activeRef.current.scale.set(breathe, breathe, 1);
    }

    if (orbitRef.current) {
      orbitRef.current.rotation.z += dt * (reverse ? -0.24 : 0.24);
    }
  });

  return (
    <group position={[0, 0, 0.02]}>
      {/* Orbit arcs with directional tick marks */}
      <group ref={orbitRef}>
        {[0, 1, 2, 3].map((index) => {
          const isActive = index === activePlayerIndex;
          const arcAngle = (index / SEAT_COUNT) * Math.PI * 2;
          const tickRotation = reverse ? arcAngle + Math.PI * 0.15 : arcAngle - Math.PI * 0.15;
          return (
            <group key={index}>
              <mesh
                rotation={[0, 0, arcAngle]}
                geometry={geometries.orbitArc}
              >
                <meshBasicMaterial
                  color={ACCENT}
                  transparent
                  opacity={isActive ? 0.32 : 0.18}
                />
              </mesh>
              {/* Directional tick mark at arc start */}
              <mesh
                position={[
                  Math.sin(arcAngle + (reverse ? 0.05 : -0.05)) * ORBIT_RADIUS,
                  Math.cos(arcAngle + (reverse ? 0.05 : -0.05)) * ORBIT_RADIUS,
                  0.01,
                ]}
                rotation={[0, 0, tickRotation]}
                geometry={geometries.orbitTick}
              >
                <meshBasicMaterial color={ACCENT} transparent opacity={isActive ? 0.7 : 0.35} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Seat rings with pulsing glow */}
      {Array.from({ length: SEAT_COUNT }, (_, index) => {
        const angle = (index / SEAT_COUNT) * Math.PI * 2;
        const active = index === activePlayerIndex;
        // Pulse sync with active indicator breathing
        const pulsePhase = Date.now() * 0.006;
        const seatPulse = active ? 1 + 0.15 * Math.sin(pulsePhase) : 1;
        return (
          <group
            key={index}
            position={[Math.sin(angle) * ORBIT_RADIUS, Math.cos(angle) * ORBIT_RADIUS, 0.02]}
          >
            {/* Pulsing glow halo around active seat */}
            {active && (
              <mesh geometry={geometries.activeHalo} scale={[seatPulse, seatPulse, 1]}>
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

      {/* Active indicator with trail/afterglow */}
      <group ref={activeRef}>
        <group position={[0, ORBIT_RADIUS, 0.045]}>
          {/* Trail/afterglow rings - semi-transparent layers behind the puck */}
          <mesh geometry={geometries.trailRing} scale={[1.6, 1.6, 1]}>
            <meshBasicMaterial color={ACCENT} transparent opacity={0.06} />
          </mesh>
          <mesh geometry={geometries.trailRing} scale={[1.35, 1.35, 1]}>
            <meshBasicMaterial color={ACCENT} transparent opacity={0.1} />
          </mesh>
          <mesh geometry={geometries.trailRing} scale={[1.15, 1.15, 1]}>
            <meshBasicMaterial color={ACCENT} transparent opacity={0.16} />
          </mesh>

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
