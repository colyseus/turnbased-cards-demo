import { useMemo } from 'react';
import * as THREE from 'three';

interface ColorRingProps {
  color: string;
  innerRadius: number;
  outerRadius: number;
  position: [number, number, number];
}

export function AnimatedRing({ color, innerRadius, outerRadius, position }: ColorRingProps) {
  const geometries = useMemo(
    () => ({
      // Dark recessed base — the socket the jewel sits in
      baseOuter: new THREE.RingGeometry(outerRadius - 0.02, outerRadius + 0.12, 80),
      baseInner: new THREE.RingGeometry(innerRadius - 0.08, innerRadius + 0.04, 80),
      // Jewel body — colored disc with hole (the gem face)
      jewelOuter: new THREE.RingGeometry(outerRadius - 0.05, outerRadius + 0.05, 80),
      jewelInner: new THREE.RingGeometry(innerRadius - 0.04, innerRadius + 0.02, 80),
      // Thin bright ring — inner accent
      rim: new THREE.RingGeometry(innerRadius - 0.02, innerRadius + 0.06, 80),
      // Center glow
      core: new THREE.CircleGeometry(innerRadius * 0.55, 80),
    }),
    [innerRadius, outerRadius]
  );

  return (
    <group position={position}>
      {/* Dark socket — recessed base ring */}
      <mesh geometry={geometries.baseOuter}>
        <meshStandardMaterial color="#0a0a12" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Cutout fill — darker inner recess */}
      <mesh geometry={geometries.baseInner}>
        <meshStandardMaterial color="#08080f" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Colored jewel face — the main colored disc */}
      <mesh geometry={geometries.jewelOuter}>
        <meshBasicMaterial color={color} transparent opacity={0.92} />
      </mesh>

      {/* Inner hole darkening — creates depth illusion */}
      <mesh geometry={geometries.jewelInner}>
        <meshBasicMaterial color="#050508" transparent opacity={0.95} />
      </mesh>

      {/* Bright inner rim — gem facet edge highlight */}
      <mesh geometry={geometries.rim}>
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>

      {/* Center glow — bright gem core */}
      <mesh position={[0, 0, 0.002]} geometry={geometries.core}>
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Soft outer halo — ambient glow around the jewel */}
      <mesh position={[0, 0, -0.004]}>
        <ringGeometry args={[outerRadius + 0.04, outerRadius + 0.18, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>
    </group>
  );
}
