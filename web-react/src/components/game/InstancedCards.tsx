import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCardAtlas } from '../Preloader';
import { useDevTools } from '../DevTools';

const CARD_ASPECT = 240 / 375;
const STIFFNESS = 200;
const DAMPING = 30;
const MAX_CARDS = 5000;

export interface CardData {
  id: string;
  textureId: string;
  position: [number, number, number];
  rotationZ: number;
  faceUp: boolean;
  scale: number;
  shake?: boolean;
  highlight?: boolean;
  selected?: boolean;
}

interface InstancedCardsProps {
  cards: CardData[];
}

const vertexShader = `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  attribute mat4 instanceMatrix;
  attribute vec4 uvOffsetScale;
  
  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  
  varying vec2 vUv;
  
  void main() {
    vUv = uv * uvOffsetScale.zw + uvOffsetScale.xy;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  precision highp float;
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 texelColor = texture2D(map, vUv);
    if (texelColor.a < 0.5) discard;
    gl_FragColor = texelColor;
  }
`;

const highlightFragmentShader = `
  precision highp float;
  uniform vec3 color;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(color, opacity);
  }
`;

// Shared scratch objects to avoid allocations in useFrame
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

export function InstancedCards({ cards }: InstancedCardsProps) {
  const { atlas, getUVs } = useCardAtlas();
  const { wireframe } = useDevTools();

  const meshFrontRef = useRef<THREE.InstancedMesh>(null!);
  const meshBackRef = useRef<THREE.InstancedMesh>(null!);
  const meshHighlightRef = useRef<THREE.InstancedMesh>(null!);
  const meshSelectedRef = useRef<THREE.InstancedMesh>(null!);

  // Animation state
  const states = useRef<Map<string, {
    pos: THREE.Vector3;
    rotZ: number;
    flipY: number;
    scale: number;
    vel: { x: number; y: number; z: number; rotZ: number; flipY: number; scale: number };
  }>>(new Map());

  // Contiguous index counters for highlight/selected instance meshes
  const highlightIdx = useRef(0);
  const selectedIdx = useRef(0);

  // Memory Management: Cleanup removed cards from states Map
  useEffect(() => {
    const cardIds = new Set(cards.map(c => c.id));
    for (const id of states.current.keys()) {
      if (!cardIds.has(id)) {
        states.current.delete(id);
      }
    }
  }, [cards]);

  // UV Offset & Scale Attributes (vec4: u, v, w, h)
  const uvFrontAttr = useMemo(() => new Float32Array(MAX_CARDS * 4), []);
  const uvBackAttr = useMemo(() => {
    const arr = new Float32Array(MAX_CARDS * 4);
    const uvs = getUVs('back');
    for (let i = 0; i < MAX_CARDS; i++) {
        const idx = i * 4;
        arr[idx] = uvs.u; arr[idx+1] = uvs.v;
        arr[idx+2] = uvs.w; arr[idx+3] = uvs.h;
    }
    return arr;
  }, [getUVs]);

  const uniforms = useMemo(() => ({
    map: { value: atlas }
  }), [atlas]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const count = cards.length;

    // Reset contiguous index counters for highlight/selected
    highlightIdx.current = 0;
    selectedIdx.current = 0;

    // NO MORE GLOBAL MATRIX RESET LOOP. 
    // We only update the instances that are actually in use.

    for (let i = 0; i < count; i++) {
      if (i >= MAX_CARDS) break;
      const card = cards[i];

      let s = states.current.get(card.id);
      if (!s) {
        s = {
          pos: new THREE.Vector3(...card.position),
          rotZ: card.rotationZ,
          flipY: card.faceUp ? 0 : Math.PI,
          scale: card.scale,
          vel: { x: 0, y: 0, z: 0, rotZ: 0, flipY: 0, scale: 0 }
        };
        states.current.set(card.id, s);
      }

      // Spring helper (inline for speed, avoiding closure allocation)
      const spring = (cur: number, tgt: number, velocity: number) => {
        const acc = STIFFNESS * (tgt - cur) - DAMPING * velocity;
        const newVel = velocity + acc * dt;
        return [cur + newVel * dt, newVel];
      };

      [s.pos.x, s.vel.x] = spring(s.pos.x, card.position[0], s.vel.x);
      [s.pos.y, s.vel.y] = spring(s.pos.y, card.position[1], s.vel.y);

      if (card.position[2] > s.pos.z) {
        s.pos.z = card.position[2];
        s.vel.z = 0;
      } else {
        [s.pos.z, s.vel.z] = spring(s.pos.z, card.position[2], s.vel.z);
      }

      [s.rotZ, s.vel.rotZ] = spring(s.rotZ, card.rotationZ, s.vel.rotZ);
      [s.flipY, s.vel.flipY] = spring(s.flipY, card.faceUp ? 0 : Math.PI, s.vel.flipY);
      [s.scale, s.vel.scale] = spring(s.scale, card.scale, s.vel.scale);

      let finalRotZ = s.rotZ;
      if (card.shake) {
        const t = Date.now() / 1000;
        finalRotZ += Math.sin(t * 22) * 0.06 + Math.sin(t * 37) * 0.03;
      }

      _pos.copy(s.pos);
      _euler.set(0, s.flipY, finalRotZ);
      _quat.setFromEuler(_euler);
      _scale.setScalar(s.scale);
      
      // Front Matrix
      _pos.z += 0.005;
      _matrix.compose(_pos, _quat, _scale);
      meshFrontRef.current.setMatrixAt(i, _matrix);

      // Back Matrix
      _pos.z -= 0.01;
      _matrix.compose(_pos, _quat, _scale);
      meshBackRef.current.setMatrixAt(i, _matrix);

      // Highlight Matrix
      if (card.highlight) {
          _pos.copy(s.pos);
          _pos.z -= 0.01;
          _euler.set(0, 0, finalRotZ);
          _quat.setFromEuler(_euler);
          _scale.set(s.scale * 1.05, s.scale * 1.05, 1);
          _matrix.compose(_pos, _quat, _scale);
          meshHighlightRef.current.setMatrixAt(highlightIdx.current, _matrix);
          highlightIdx.current++;
      }

      // Selected Matrix
      if (card.selected) {
          _pos.copy(s.pos);
          _pos.z -= 0.015;
          _euler.set(0, 0, finalRotZ);
          _quat.setFromEuler(_euler);
          _scale.set(s.scale * 1.1, s.scale * 1.1, 1);
          _matrix.compose(_pos, _quat, _scale);
          meshSelectedRef.current.setMatrixAt(selectedIdx.current, _matrix);
          selectedIdx.current++;
      }

      // Update Front UVs
      const uvs = getUVs(card.textureId);
      const idx = i * 4;
      uvFrontAttr[idx] = uvs.u; uvFrontAttr[idx+1] = uvs.v;
      uvFrontAttr[idx+2] = uvs.w; uvFrontAttr[idx+3] = uvs.h;
    }

    meshFrontRef.current.count = count;
    meshBackRef.current.count = count;
    meshHighlightRef.current.count = highlightIdx.current;
    meshSelectedRef.current.count = selectedIdx.current;

    meshFrontRef.current.instanceMatrix.needsUpdate = true;
    meshBackRef.current.instanceMatrix.needsUpdate = true;
    meshHighlightRef.current.instanceMatrix.needsUpdate = true;
    meshSelectedRef.current.instanceMatrix.needsUpdate = true;
    
    if (meshFrontRef.current.geometry.attributes.uvOffsetScale) {
        (meshFrontRef.current.geometry.attributes.uvOffsetScale as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={meshFrontRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]}>
          <instancedBufferAttribute
            args={[uvFrontAttr, 4]}
            name="uvOffsetScale"
            attach="attributes-uvOffsetScale"
            count={MAX_CARDS}
            array={uvFrontAttr}
            itemSize={4}
          />
        </planeGeometry>
        <rawShaderMaterial 
          uniforms={uniforms} 
          vertexShader={vertexShader} 
          fragmentShader={fragmentShader} 
          transparent 
          wireframe={wireframe}
        />
      </instancedMesh>
      
      <instancedMesh ref={meshBackRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]}>
          <instancedBufferAttribute
            args={[uvBackAttr, 4]}
            name="uvOffsetScale"
            attach="attributes-uvOffsetScale"
            count={MAX_CARDS}
            array={uvBackAttr}
            itemSize={4}
          />
        </planeGeometry>
        <rawShaderMaterial 
          uniforms={uniforms} 
          vertexShader={vertexShader} 
          fragmentShader={fragmentShader} 
          transparent 
          side={THREE.BackSide}
          wireframe={wireframe}
        />
      </instancedMesh>

      <instancedMesh ref={meshHighlightRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]} />
        <rawShaderMaterial 
          uniforms={{ color: { value: new THREE.Color("#ffcc00") }, opacity: { value: 0.25 } }}
          vertexShader={vertexShader.replace('vUv = uv * uvOffsetScale.zw + uvOffsetScale.xy;', 'vUv = uv;')}
          fragmentShader={highlightFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>

      <instancedMesh ref={meshSelectedRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]} />
        <rawShaderMaterial 
          uniforms={{ color: { value: new THREE.Color("#00e5ff") }, opacity: { value: 0.35 } }}
          vertexShader={vertexShader.replace('vUv = uv * uvOffsetScale.zw + uvOffsetScale.xy;', 'vUv = uv;')}
          fragmentShader={highlightFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>
    </>
  );
}
