import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCardAtlas } from '../Preloader';
import { useDevTools } from '../DevTools';
import { CARD_ASPECT } from '../../cards/cardAtlas';

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

const vertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 position;
  attribute vec2 uv;
  attribute mat4 instanceMatrix;
  attribute vec4 uvOffsetScale;
  attribute float instanceIndex;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uCardCount;
  uniform bool uUseGpuAnimation;

  varying vec2 vUv;

  void main() {
    vUv = vec2(uv.x, 1.0 - uv.y) * uvOffsetScale.zw + uvOffsetScale.xy;

    // Extract base position from instanceMatrix (translation column)
    vec3 basePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

    vec3 finalPos = basePos;

    // GPU-driven orbital animation: deterministic from instanceIndex + uTime
    // No spring physics — runs entirely in vertex shader
    float angle = 0.0;
    float r = 0.0;
    float zOff = 0.0;
    if (uUseGpuAnimation) {
      float fi = instanceIndex;
      float total = max(uCardCount, 1.0);
      angle = (fi / total) * 6.28318530718 + uTime * 0.2;
      r = 3.0 + sin(uTime * 0.5 + fi * 0.1) * 2.0;
      zOff = sin(uTime + fi * 0.05) * 0.5;

      finalPos = vec3(
        cos(angle) * r,
        sin(angle) * r,
        zOff
      );
    }

    // Compose: T(finalPos) * Rz(angle+PI/2) * S(0.5)
    float animAngle = uUseGpuAnimation ? (angle + 1.57079632679) : 0.0;
    float ca = cos(animAngle);
    float sa = sin(animAngle);
    mat3 rotZ = mat3(ca, -sa, 0.0, sa, ca, 0.0, 0.0, 0.0, 1.0);
    mat3 scaleMat = mat3(0.5, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 1.0);
    mat3 rotScale = rotZ * scaleMat;
    vec4 worldPos = modelMatrix * vec4(finalPos + rotScale * position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
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

// Spring physics helper — no component dependencies, safe at module scope
const spring = (cur: number, tgt: number, velocity: number, dt: number) => {
  const acc = STIFFNESS * (tgt - cur) - DAMPING * velocity;
  const newVel = velocity + acc * dt;
  return [cur + newVel * dt, newVel];
};

export function InstancedCards({ cards }: InstancedCardsProps) {
  const { atlas, getUVs } = useCardAtlas();
  const { wireframe } = useDevTools();

  const meshCardRef = useRef<THREE.InstancedMesh>(null!);
  const meshHighlightRef = useRef<THREE.InstancedMesh>(null!);
  const meshSelectedRef = useRef<THREE.InstancedMesh>(null!);

  // Animation state
  const states = useRef<
    Map<
      string,
      {
        pos: THREE.Vector3;
        rotZ: number;
        scale: number;
        vel: { x: number; y: number; z: number; rotZ: number; scale: number };
      }
    >
  >(new Map());

  // Contiguous index counters for highlight/selected instance meshes
  const highlightIdx = useRef(0);
  const selectedIdx = useRef(0);
  const needsSpring = useRef(false);

  // Memory Management: Cleanup removed cards from states Map
  // and initialize GPU uniforms + instance matrices when cards change
  useEffect(() => {
    const cardIds = new Set(cards.map((c) => c.id));
    for (const id of states.current.keys()) {
      if (!cardIds.has(id)) {
        states.current.delete(id);
      }
    }

    if (!meshCardRef.current) return;

    // Detect whether any card needs spring physics
    needsSpring.current = cards.some((c) => c.shake || c.highlight || c.selected);

    // Update GPU uniforms
    uniforms.uCardCount.value = cards.length;
    uniforms.uUseGpuAnimation.value = !needsSpring.current;

    // Initialize instance matrices and UVs
    const count = Math.min(cards.length, MAX_CARDS);
    for (let i = 0; i < count; i++) {
      const card = cards[i];
      _pos.set(card.position[0], card.position[1], card.position[2]);
      _euler.set(0, 0, card.rotationZ);
      _quat.setFromEuler(_euler);
      _scale.setScalar(card.scale);
      _matrix.compose(_pos, _quat, _scale);
      meshCardRef.current.setMatrixAt(i, _matrix);

      const uvs = getUVs(card.faceUp ? card.textureId : 'back');
      const idx = i * 4;
      uvCardAttr[idx] = uvs.u;
      uvCardAttr[idx + 1] = uvs.v;
      uvCardAttr[idx + 2] = uvs.w;
      uvCardAttr[idx + 3] = uvs.h;
    }

    meshCardRef.current.count = count;
    meshHighlightRef.current.count = 0;
    meshSelectedRef.current.count = 0;
    meshCardRef.current.instanceMatrix.needsUpdate = true;
    if (meshCardRef.current.geometry.attributes.uvOffsetScale) {
      (meshCardRef.current.geometry.attributes.uvOffsetScale as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }, [cards, getUVs]);

  // UV Offset & Scale Attributes (vec4: u, v, w, h)
  const uvCardAttr = useMemo(() => new Float32Array(MAX_CARDS * 4), []);

  // Instance index — used by GPU shader to compute orbital animation deterministically
  const instanceIndexAttr = useMemo(() => {
    const arr = new Float32Array(MAX_CARDS);
    for (let i = 0; i < MAX_CARDS; i++) arr[i] = i;
    return arr;
  }, []);

  const uniforms = useMemo(() => ({
  map: { value: atlas },
  uTime: { value: 0 },
  uCardCount: { value: 0 },
  uUseGpuAnimation: { value: false },
}), [atlas]);

  useFrame((_, delta) => {
    if (!meshCardRef.current) return;

    // Always update time — cheap single float assignment
    uniforms.uTime.value += Math.min(delta, 0.05);

    // FAST PATH: pure animated cards — GPU handles all position animation.
    // CPU only sets count once; matrices already set by useEffect init.
    if (!needsSpring.current) {
      meshCardRef.current.count = cards.length;
      return;
    }

    // SPRING PATH: game cards with shake/highlight/selected
    const dt = Math.min(delta, 0.05);
    const count = cards.length;

    highlightIdx.current = 0;
    selectedIdx.current = 0;

    for (let i = 0; i < count; i++) {
      if (i >= MAX_CARDS) break;
      const card = cards[i];

      let s = states.current.get(card.id);
      if (!s) {
        s = {
          pos: new THREE.Vector3(...card.position),
          rotZ: card.rotationZ,
          scale: card.scale,
          vel: { x: 0, y: 0, z: 0, rotZ: 0, scale: 0 },
        };
        states.current.set(card.id, s);
      }

      [s.pos.x, s.vel.x] = spring(s.pos.x, card.position[0], s.vel.x, dt);
      [s.pos.y, s.vel.y] = spring(s.pos.y, card.position[1], s.vel.y, dt);

      if (card.position[2] > s.pos.z) {
        s.pos.z = card.position[2];
        s.vel.z = 0;
      } else {
        [s.pos.z, s.vel.z] = spring(s.pos.z, card.position[2], s.vel.z, dt);
      }

      [s.rotZ, s.vel.rotZ] = spring(s.rotZ, card.rotationZ, s.vel.rotZ, dt);
      [s.scale, s.vel.scale] = spring(s.scale, card.scale, s.vel.scale, dt);

      let finalRotZ = s.rotZ;
      if (card.shake) {
        const t = performance.now() / 1000;
        finalRotZ += Math.sin(t * 22) * 0.06 + Math.sin(t * 37) * 0.03;
      }

      _pos.copy(s.pos);
      _euler.set(0, 0, finalRotZ);
      _quat.setFromEuler(_euler);
      _scale.setScalar(s.scale);
      _matrix.compose(_pos, _quat, _scale);
      meshCardRef.current.setMatrixAt(i, _matrix);

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

      const uvs = getUVs(card.faceUp ? card.textureId : 'back');
      const idx = i * 4;
      uvCardAttr[idx] = uvs.u;
      uvCardAttr[idx + 1] = uvs.v;
      uvCardAttr[idx + 2] = uvs.w;
      uvCardAttr[idx + 3] = uvs.h;
    }

    meshCardRef.current.count = count;
    meshHighlightRef.current.count = highlightIdx.current;
    meshSelectedRef.current.count = selectedIdx.current;
    meshCardRef.current.instanceMatrix.needsUpdate = true;
    meshHighlightRef.current.instanceMatrix.needsUpdate = true;
    meshSelectedRef.current.instanceMatrix.needsUpdate = true;

    if (meshCardRef.current.geometry.attributes.uvOffsetScale) {
      (meshCardRef.current.geometry.attributes.uvOffsetScale as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={meshCardRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]}>
          <instancedBufferAttribute
            args={[uvCardAttr, 4]}
            name="uvOffsetScale"
            attach="attributes-uvOffsetScale"
            count={MAX_CARDS}
            array={uvCardAttr}
            itemSize={4}
          />
          <instancedBufferAttribute
            args={[instanceIndexAttr, 1]}
            name="instanceIndex"
            attach="attributes-instanceIndex"
            count={MAX_CARDS}
            array={instanceIndexAttr}
            itemSize={1}
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

      <instancedMesh ref={meshHighlightRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]} />
        <rawShaderMaterial
          uniforms={{ color: { value: new THREE.Color('#ffcc00') }, opacity: { value: 0.25 } }}
          vertexShader={vertexShader.replace(
            'vUv = vec2(uv.x, 1.0 - uv.y) * uvOffsetScale.zw + uvOffsetScale.xy;',
            'vUv = uv;'
          )}
          fragmentShader={highlightFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>

      <instancedMesh ref={meshSelectedRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]} />
        <rawShaderMaterial
          uniforms={{ color: { value: new THREE.Color('#00e5ff') }, opacity: { value: 0.35 } }}
          vertexShader={vertexShader.replace(
            'vUv = vec2(uv.x, 1.0 - uv.y) * uvOffsetScale.zw + uvOffsetScale.xy;',
            'vUv = uv;'
          )}
          fragmentShader={highlightFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>
    </>
  );
}
