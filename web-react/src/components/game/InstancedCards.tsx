import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCardAtlas } from '../Preloader';
import { useDevTools } from '../DevTools';
import { CARD_ASPECT } from '../../cards/cardAtlas';

const STIFFNESS = 200;
const DAMPING = 30;
const MAX_CARDS = 5000;

// ── Vertex shader with GPU-driven orbital animation ──────────────────────────
const vertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 position;
  attribute vec2 uv;
  attribute mat4 instanceMatrix;
  attribute vec4 uvOffsetScale;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uCardCount;
  uniform bool uAnimated;

  varying vec2 vUv;

  void main() {
    vUv = vec2(uv.x, 1.0 - uv.y) * uvOffsetScale.zw + uvOffsetScale.xy;

    // Decompose instanceMatrix to get base transform
    // instanceMatrix = T(parent_pos) * R * S (we store base world pos in translation)
    vec3 basePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    mat3 instRotScale = mat3(instanceMatrix);

    // Extract base scale from column lengths of rotation/scale part
    vec3 baseScale = vec3(length(vec3(instanceMatrix[0][0], instanceMatrix[1][0], instanceMatrix[2][0])),
                           length(vec3(instanceMatrix[0][1], instanceMatrix[1][1], instanceMatrix[2][1])),
                           length(vec3(instanceMatrix[0][2], instanceMatrix[1][2], instanceMatrix[2][2])));

    // Orbital animation computed entirely on GPU from instance index
    vec3 animPos = basePos;
    vec3 animScale = baseScale;
    float animRotZ = 0.0;

    if (uAnimated) {
      // Reconstruct rotation angle from instanceMatrix's rotation columns
      // For our cards, instanceMatrix is: T * Rz(angle) * S
      float baseAngle = atan(instRotScale[0][1], instRotScale[0][0]);

      // Instance index derived from position uniqueness (x coordinate)
      float idx = basePos.x * 1000.0 + basePos.y * 100.0 + basePos.z * 10.0;
      idx = fract(idx * 0.317) * uCardCount; // deterministic 0..cardCount
      float fi = floor(idx);

      float angle = (fi / max(uCardCount, 1.0)) * 6.28318530718 + uTime * 0.2;
      float r = 3.0 + sin(uTime * 0.5 + fi * 0.1) * 2.0;
      float zOff = sin(uTime + fi * 0.05) * 0.5;

      // Build offset in world space (no local rotation)
      vec3 offset = vec3(cos(angle) * r - basePos.x,
                          sin(angle) * r - basePos.y,
                          zOff);

      animPos = basePos + offset;
      animRotZ = angle + 1.57079632718; // PI/2
      animScale = baseScale;
    }

    // Compose final matrix: T * Rz(animRotZ) * S
    float ca = cos(animRotZ);
    float sa = sin(animRotZ);
    mat3 rotZMat = mat3(ca, -sa, 0.0, sa, ca, 0.0, 0.0, 0.0, 1.0);
    mat3 finalRotScale = rotZMat * mat3(animScale.x, 0.0, 0.0, 0.0, animScale.y, 0.0, 0.0, 0.0, animScale.z);

    mat4 finalInstance = mat4(
      vec4(finalRotScale[0], 0.0),
      vec4(finalRotScale[1], 0.0),
      vec4(finalRotScale[2], 0.0),
      vec4(animPos, 1.0)
    );

    vec4 worldPosition = modelMatrix * finalInstance * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 texelColor = texture2D(map, vUv);
    if (texelColor.a < 0.5) discard;
    gl_FragColor = texelColor;
  }
`;

const highlightFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 color;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(color, opacity);
  }
`;

// ── Highlight/selected shader (no animation, use instanceMatrix directly) ─────
const simpleVertexShader = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  attribute mat4 instanceMatrix;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

// ── Shared scratch objects (module scope = no per-frame allocations) ─────────
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

// Spring physics helper
const spring = (cur: number, tgt: number, velocity: number, dt: number) => {
  const acc = STIFFNESS * (tgt - cur) - DAMPING * velocity;
  const newVel = velocity + acc * dt;
  return [cur + newVel * dt, newVel];
};

// ── Per-card animation state (kept for game cards with shake/highlight/select)
interface CardState {
  pos: THREE.Vector3;
  rotZ: number;
  scale: number;
  vel: { x: number; y: number; z: number; rotZ: number; scale: number };
}

const states = new Map<string, CardState>();

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

export function InstancedCards({ cards }: InstancedCardsProps) {
  const { atlas, getUVs } = useCardAtlas();
  const { wireframe } = useDevTools();

  const meshCardRef = useRef<THREE.InstancedMesh>(null!);
  const meshHighlightRef = useRef<THREE.InstancedMesh>(null!);
  const meshSelectedRef = useRef<THREE.InstancedMesh>(null!);

  const highlightIdx = useRef(0);
  const selectedIdx = useRef(0);

  // Whether cards need spring animation (any card has shake/highlight/selected)
  const needsSpring = useRef(false);

  // UV Offset & Scale Attributes
  const uvCardAttr = useMemo(() => new Float32Array(MAX_CARDS * 4), []);

  // Time uniform ref for GPU animation
  const timeRef = useRef(0);

  // Uniforms object — same reference, mutating uTime each frame
  const uniforms = useMemo(
    () => ({
      map: { value: atlas },
      uTime: { value: 0 },
      uCardCount: { value: 0 },
      uAnimated: { value: true },
    }),
    [atlas]
  );

  // ── Precompute instance matrices when cards change ──────────────────────
  useEffect(() => {
    if (!meshCardRef.current) return;
    needsSpring.current = cards.some(
      (c) => c.shake || c.highlight || c.selected
    );

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

    uniforms.uCardCount.value = count;

    // Reset state map to match new cards
    states.clear();
  }, [cards, getUVs, uvCardAttr, uniforms]);

  // Cleanup removed cards from states Map
  useEffect(() => {
    const cardIds = new Set(cards.map((c) => c.id));
    for (const id of states.keys()) {
      if (!cardIds.has(id)) states.delete(id);
    }
  }, [cards]);

  // ── Per-frame: GPU path (no springs) or spring path ─────────────────────
  useFrame((_, delta) => {
    if (!meshCardRef.current) return;

    const count = meshCardRef.current.count;
    const dt = Math.min(delta, 0.05);
    timeRef.current += dt;

    // Update GPU animation time uniform (cheap — just a float)
    uniforms.uTime.value = timeRef.current;

    // If no spring-needed cards, GPU handles animation — skip CPU loop entirely
    if (!needsSpring.current) return;

    // Spring path for game cards with shake/highlight/selected
    highlightIdx.current = 0;
    selectedIdx.current = 0;

    for (let i = 0; i < count; i++) {
      const card = cards[i];

      let s = states.get(card.id);
      if (!s) {
        s = {
          pos: new THREE.Vector3(...card.position),
          rotZ: card.rotationZ,
          scale: card.scale,
          vel: { x: 0, y: 0, z: 0, rotZ: 0, scale: 0 },
        };
        states.set(card.id, s);
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
        const t = timeRef.current;
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
    }

    meshHighlightRef.current.count = highlightIdx.current;
    meshSelectedRef.current.count = selectedIdx.current;
    meshCardRef.current.instanceMatrix.needsUpdate = true;
    meshHighlightRef.current.instanceMatrix.needsUpdate = true;
    meshSelectedRef.current.instanceMatrix.needsUpdate = true;
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
          vertexShader={simpleVertexShader}
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
          vertexShader={simpleVertexShader}
          fragmentShader={highlightFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>
    </>
  );
}
