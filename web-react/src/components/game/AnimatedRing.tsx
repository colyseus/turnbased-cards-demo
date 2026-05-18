import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STIFFNESS = 200;
const DAMPING = 25;

export function AnimatedRing({
  color,
  innerRadius,
  outerRadius,
  position,
}: {
  color: string;
  innerRadius: number;
  outerRadius: number;
  position: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const vel = useRef({ scale: 0 });
  const prevColor = useRef(color);
  const target = useRef({ scale: 1 });
  const currentScale = useRef(1);

  const outerRingGeo = useMemo(
    () => new THREE.RingGeometry(innerRadius, outerRadius, 48),
    [innerRadius, outerRadius]
  );
  const innerFillGeo = useMemo(
    () => new THREE.CircleGeometry(innerRadius * 0.97, 48),
    [innerRadius]
  );
  const inlayGeo = useMemo(
    () => new THREE.RingGeometry(innerRadius + 0.01, innerRadius + 0.03, 48),
    [innerRadius]
  );

  useEffect(() => {
    return () => {
      outerRingGeo.dispose();
      innerFillGeo.dispose();
      inlayGeo.dispose();
    };
  }, [outerRingGeo, innerFillGeo, inlayGeo]);

  if (color !== prevColor.current) {
    prevColor.current = color;
    target.current.scale = 1.8;
    vel.current.scale = 0;
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;
    if (!g) return;

    const cur = currentScale.current;
    const acc = STIFFNESS * (target.current.scale - cur) - DAMPING * vel.current.scale;
    vel.current.scale += acc * dt;
    currentScale.current = cur + vel.current.scale * dt;
    g.scale.setScalar(currentScale.current);

    if (
      Math.abs(currentScale.current - target.current.scale) < 0.01 &&
      vel.current.scale < 0.5 &&
      target.current.scale !== 1
    ) {
      target.current.scale = 1;
      vel.current.scale = 0;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={outerRingGeo}>
        <meshStandardMaterial
          color="#3d2010"
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>

      <mesh geometry={inlayGeo}>
        <meshStandardMaterial
          color="#8b5e34"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[0, 0, 0.001]} geometry={innerFillGeo}>
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
