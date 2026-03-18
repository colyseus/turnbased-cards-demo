import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCardTexture } from './Preloader';

const CARD_ASPECT = 240 / 375; // width / height

const STIFFNESS = 200;
const DAMPING = 30;

interface CardProps {
  textureId: string;
  position: [number, number, number];
  rotationZ: number;
  faceUp: boolean;
  scale: number;
  shake?: boolean;
  /** When set, the card starts here on first mount and springs to `position`. */
  initialPosition?: [number, number, number];
}

export function Card({
  textureId,
  position,
  rotationZ,
  faceUp,
  scale: targetScale,
  shake,
  initialPosition,
}: CardProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const flipRef = useRef<THREE.Group>(null!);
  const mounted = useRef(false);

  const target = useRef({
    pos: new THREE.Vector3(),
    rotZ: 0,
    flipY: 0,
    scale: 1,
  });
  target.current.pos.set(...position);
  target.current.rotZ = rotationZ;
  target.current.flipY = faceUp ? 0 : Math.PI;
  target.current.scale = targetScale;

  const vel = useRef({ x: 0, y: 0, z: 0, rotZ: 0, flipY: 0, scale: 0 });
  const shakeTime = useRef(0);

  // Textures come from context — no useLoader, no Suspense triggers
  const backTex = useCardTexture('back');
  const frontTex = useCardTexture(textureId);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;
    const f = flipRef.current;
    const t = target.current;
    const v = vel.current;

    if (!mounted.current) {
      mounted.current = true;
      if (initialPosition) {
        // Start at the given position and let spring animate to target
        g.position.set(...initialPosition);
        f.rotation.y = Math.PI; // start face-down
      } else {
        // Snap to target (no animation)
        g.position.copy(t.pos);
        f.rotation.y = t.flipY;
      }
      g.rotation.z = t.rotZ;
      g.scale.setScalar(t.scale);
      return;
    }

    function spring(cur: number, tgt: number, velocity: number): [number, number] {
      const acc = STIFFNESS * (tgt - cur) - DAMPING * velocity;
      const newVel = velocity + acc * dt;
      return [cur + newVel * dt, newVel];
    }

    [g.position.x, v.x] = spring(g.position.x, t.pos.x, v.x);
    [g.position.y, v.y] = spring(g.position.y, t.pos.y, v.y);

    if (t.pos.z > g.position.z) {
      g.position.z = t.pos.z;
      v.z = 0;
    } else {
      [g.position.z, v.z] = spring(g.position.z, t.pos.z, v.z);
    }

    [g.rotation.z, v.rotZ] = spring(g.rotation.z, t.rotZ, v.rotZ);

    // Shake: add a continuous wobble on top of the spring rotation
    if (shake) {
      shakeTime.current += dt;
      const t1 = shakeTime.current;
      g.rotation.z += Math.sin(t1 * 22) * 0.06 + Math.sin(t1 * 37) * 0.03;
    }

    [f.rotation.y, v.flipY] = spring(f.rotation.y, t.flipY, v.flipY);

    let newScale: number;
    [newScale, v.scale] = spring(g.scale.x, t.scale, v.scale);
    g.scale.setScalar(newScale);
  });

  return (
    <group ref={groupRef}>
      <group ref={flipRef}>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[CARD_ASPECT, 1]} />
          <meshBasicMaterial map={frontTex} alphaTest={0.5} />
        </mesh>
        <mesh position={[0, 0, -0.005]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[CARD_ASPECT, 1]} />
          <meshBasicMaterial map={backTex} alphaTest={0.5} />
        </mesh>
      </group>
    </group>
  );
}
