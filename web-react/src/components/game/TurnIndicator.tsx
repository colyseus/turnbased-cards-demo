import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SEAT_COUNT = 4;
const POINTER_RADIUS = 2.5;

const POINTER_SHAPE = new THREE.Shape();
POINTER_SHAPE.moveTo(0, 0.5);
POINTER_SHAPE.bezierCurveTo(0.08, 0.5, 0.12, 0.3, 0.14, 0.1);
POINTER_SHAPE.lineTo(0.14, -0.3);
POINTER_SHAPE.lineTo(-0.14, -0.3);
POINTER_SHAPE.lineTo(-0.14, 0.1);
POINTER_SHAPE.bezierCurveTo(-0.12, 0.3, -0.08, 0.5, 0, 0.5);
POINTER_SHAPE.closePath();

const DIR_ARC_SHAPE = new THREE.Shape();
DIR_ARC_SHAPE.absarc(0, 0, 1.0, 0, Math.PI * 0.35, false);
DIR_ARC_SHAPE.lineTo(0.88, 0.88);
DIR_ARC_SHAPE.lineTo(1.12, 1.12);
DIR_ARC_SHAPE.absarc(0, 0, 1.24, Math.PI * 0.35, 0, true);
DIR_ARC_SHAPE.closePath();

const POINTER_GEO = new THREE.ShapeGeometry(POINTER_SHAPE);

export function TurnIndicator({
  activePlayerIndex,
  reverse,
}: {
  activePlayerIndex: number;
  reverse: boolean;
}) {
  const pointerRef = useRef<THREE.Group>(null!);
  const dirRef = useRef<THREE.Group>(null!);
  const currentRotation = useRef(0);
  const rotationVel = useRef(0);

  const STIFFNESS = 180;
  const DAMPING = 18;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const targetAngle = -(activePlayerIndex / SEAT_COUNT) * Math.PI * 2;

    let deltaAngle = targetAngle - currentRotation.current;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    const acc = STIFFNESS * deltaAngle - DAMPING * rotationVel.current;
    rotationVel.current += acc * dt;
    currentRotation.current += rotationVel.current * dt;

    if (pointerRef.current) {
      pointerRef.current.rotation.z = currentRotation.current;
    }

    if (dirRef.current) {
      dirRef.current.rotation.z = reverse ? Math.PI : 0;
    }
  });

  return (
    <group position={[0, 0, 0.01]}>
      <group ref={pointerRef}>
        <mesh position={[0, 0, -0.005]}>
          <shapeGeometry args={[POINTER_SHAPE]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.2} />
        </mesh>
        <mesh geometry={POINTER_GEO}>
          <meshStandardMaterial color="#252540" roughness={0.85} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0, 0.002]} geometry={POINTER_GEO}>
          <meshStandardMaterial color="#8b5e34" roughness={0.8} metalness={0.05} side={THREE.BackSide} />
        </mesh>
      </group>

      {Array.from({ length: SEAT_COUNT }, (_, i) => {
        const angle = (i / SEAT_COUNT) * Math.PI * 2;
        const x = Math.sin(angle) * POINTER_RADIUS;
        const y = Math.cos(angle) * POINTER_RADIUS;
        return (
          <mesh key={i} position={[x, y, 0.02]}>
            <circleGeometry args={[0.18, 24]} />
            <meshStandardMaterial
              color={i === activePlayerIndex ? '#00e5ff' : '#252540'}
              roughness={0.7}
              metalness={0.05}
            />
          </mesh>
        );
      })}

      <group ref={dirRef}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={`dir-${i}`}
            position={[0, 0, 0]}
            rotation={[0, 0, (i / SEAT_COUNT) * Math.PI * 2]}
          >
            <shapeGeometry args={[DIR_ARC_SHAPE]} />
            <meshStandardMaterial
              color="#00e5ff"
              transparent
              opacity={0.55}
              roughness={0.7}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
