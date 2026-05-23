import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

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
  const sweepRef = useRef<THREE.Group>(null!);
  const vel = useRef({ scale: 0 });
  const prevColor = useRef(color);
  const target = useRef({ scale: 1 });
  const currentScale = useRef(1);

  const geometries = useMemo(
    () => ({
      outerHalo: new THREE.RingGeometry(outerRadius + 0.1, outerRadius + 0.18, 96),
      outerFrame: new THREE.RingGeometry(outerRadius - 0.02, outerRadius + 0.08, 96),
      innerFrame: new THREE.RingGeometry(innerRadius - 0.05, innerRadius + 0.015, 96),
      colorCore: new THREE.CircleGeometry(innerRadius * 0.9, 96),
      sweep: new THREE.RingGeometry(outerRadius + 0.2, outerRadius + 0.29, 96, 1, 0, Math.PI * 0.34),
      notch: new THREE.BoxGeometry(0.1, 0.34, 0.01),
    }),
    [innerRadius, outerRadius],
  );

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    };
  }, [geometries]);

  if (color !== prevColor.current) {
    prevColor.current = color;
    target.current.scale = 1.7;
    vel.current.scale = 0;
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;
    const sweep = sweepRef.current;
    if (!g) return;

    const cur = currentScale.current;
    const acc = STIFFNESS * (target.current.scale - cur) - DAMPING * vel.current.scale;
    vel.current.scale += acc * dt;
    currentScale.current = cur + vel.current.scale * dt;
    g.scale.setScalar(currentScale.current);

    if (sweep) {
      sweep.rotation.z += dt * 0.58;
    }

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
      <mesh geometry={geometries.outerHalo}>
        <meshBasicMaterial color={color} transparent opacity={0.16} />
      </mesh>
      <mesh geometry={geometries.outerFrame}>
        <meshStandardMaterial color="#252540" roughness={0.5} metalness={0.18} />
      </mesh>
      <mesh geometry={geometries.innerFrame}>
        <meshStandardMaterial color="#00e5ff" roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.001]} geometry={geometries.colorCore}>
        <meshBasicMaterial color={color} transparent opacity={0.88} />
      </mesh>

      <group ref={sweepRef}>
        {[0, 1, 2].map((index) => (
          <mesh key={index} rotation={[0, 0, (index * Math.PI * 2) / 3]} geometry={geometries.sweep}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
          </mesh>
        ))}
      </group>

      {[0, 1, 2, 3].map((index) => (
        <mesh
          key={index}
          position={[
            Math.cos((index * Math.PI) / 2) * (outerRadius + 0.15),
            Math.sin((index * Math.PI) / 2) * (outerRadius + 0.15),
            0.01,
          ]}
          rotation={[0, 0, (index * Math.PI) / 2]}
          geometry={geometries.notch}
        >
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.36} />
        </mesh>
      ))}
    </group>
  );
}
