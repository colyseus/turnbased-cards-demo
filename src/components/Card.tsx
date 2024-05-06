import React, { useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

export function Card() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotationY, setRotationY] = useState(0);
  const [scale, setScale] = useState(2);
  const [isHover, setHover] = useState(false);

  const backMap = useLoader(THREE.TextureLoader, 'kenney_playing-cards-pack/PNG/Cards (large)/card_back.png');
  const colorMap = useLoader(THREE.TextureLoader, 'kenney_playing-cards-pack/PNG/Cards (large)/card_spades_A.png');

  backMap.minFilter = THREE.NearestFilter;
  backMap.magFilter = THREE.NearestFilter;

  colorMap.minFilter = THREE.NearestFilter;
  colorMap.magFilter = THREE.NearestFilter;
  // backMap.generateMipmaps = false;

  useFrame(() => {
    setRotationY(rotationY + 0.009);

    if (isHover) {
      setScale((scale) => THREE.MathUtils.lerp(scale, 2.5, 0.1));

    } else {
      setScale((scale) => THREE.MathUtils.lerp(scale, 2, 0.1));
    }
  });

  function onPointerEnter(e: ThreeEvent<PointerEvent>) {
    setHover(true);
  }

  function onPointerLeave(e: ThreeEvent<PointerEvent>) {
    setHover(false);
  }

  return (
    <group
      rotation={[0, rotationY, 0]}
      scale={scale}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <mesh receiveShadow={true}>
        <planeGeometry args={[1, 1]}  />
        <meshStandardMaterial map={colorMap} transparent={true} />
      </mesh>
      <mesh receiveShadow={true}>
        <planeGeometry args={[-1, 1]} />
        <meshStandardMaterial map={backMap} transparent={true} />
      </mesh>
    </group>
  );
}
