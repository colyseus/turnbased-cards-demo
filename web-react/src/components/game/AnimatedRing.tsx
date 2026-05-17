import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  const innerRef = useRef<THREE.Mesh>(null!);
  const vel = useRef({ scale: 0, inner: 0 });
  const prevColor = useRef(color);
  const target = useRef({ scale: 1, innerRatio: 1 });

  // Memoize geometries to avoid recreation on re-render
  const outerGeo = useMemo(() => new THREE.CircleGeometry(outerRadius, 32), [outerRadius]);
  const innerGeo = useMemo(() => new THREE.CircleGeometry(innerRadius, 32), [innerRadius]);

  // Cleanup
  useEffect(() => {
    return () => {
      outerGeo.dispose();
      innerGeo.dispose();
    };
  }, [outerGeo, innerGeo]);

  if (color !== prevColor.current) {
    prevColor.current = color;
    if (groupRef.current) groupRef.current.scale.setScalar(1.8);
    vel.current.scale = 0;
    vel.current.inner = 0;
    target.current.scale = 1;
    target.current.innerRatio = 1;
    if (innerRef.current) {
      innerRef.current.scale.setScalar(0.4);
    }
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;
    if (!g) return;

    const curScale = g.scale.x;
    const accScale =
      200 * (target.current.scale - curScale) - 30 * vel.current.scale;
    vel.current.scale += accScale * dt;
    g.scale.setScalar(curScale + vel.current.scale * dt);

    if (innerRef.current) {
        const curInner = innerRef.current.scale.x;
        const accInner =
          200 * (target.current.innerRatio - curInner) - 30 * vel.current.inner;
        vel.current.inner += accInner * dt;
        innerRef.current.scale.setScalar(curInner + vel.current.inner * dt);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={outerGeo}>
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={innerRef} position={[0, 0, 0.001]} geometry={innerGeo}>
        <meshBasicMaterial color="#1a7a3c" />
      </mesh>
    </group>
  );
}
