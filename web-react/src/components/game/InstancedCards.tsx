import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCardAtlas } from '../Preloader';
import { useDevTools } from '../DevTools';
import { CARD_ASPECT } from '../../cards/cardAtlas';

const STIFFNESS = 200;
const DAMPING = 30;
const MAX_CARDS = 2000;

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

// Use rawShaderMaterial with glslVersion THREE.GLSL3.
// Three.js prepends #version 300 es, we provide GLSL 3.00 syntax (in/out).
// DO NOT redeclare position, uv, instanceMatrix - Three.js injects these.
const vertexShader = /* glsl */ `
  in vec4 uvOffsetScale;

  uniform float uTime;
  uniform float uCardCount;
  uniform bool uUseGpuAnimation;

  out vec2 vUv;

  void main() {
    vUv = vec2(uv.x, 1.0 - uv.y) * uvOffsetScale.zw + uvOffsetScale.xy;

    // Extract base position from instanceMatrix (translation column)
    vec3 basePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

    vec3 finalPos = basePos;

    // GPU-driven orbital animation: deterministic from instanceIndex + uTime
    float angle = 0.0;
    if (uUseGpuAnimation) {
      // gl_InstanceID is available in GLSL ES 3.00
      float fi = float(gl_InstanceID);
      float total = max(uCardCount, 1.0);
      angle = (fi / total) * 6.28318530718 + uTime * 0.2;
      // Simple circular orbit
      float r = 3.0 + sin(angle) * 1.5;
      finalPos = vec3(cos(angle) * r, sin(angle) * r, sin(angle * 2.0) * 0.5);
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

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  in vec2 vUv;
  out vec4 fragColor;

  void main() {
    vec4 texelColor = texture(map, vUv);
    if (texelColor.a < 0.5) discard;
    fragColor = texelColor;
  }
`;

// Radial glow fragment shader for highlight mesh — soft falloff from card center
const highlightFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 color;
  uniform float opacity;
  in vec2 vUv;
  out vec4 fragColor;

  void main() {
    // Compute radial distance from card center using UV coordinates
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    // Soft radial falloff: 1.0 at center, 0.0 at edges
    float glow = 1.0 - smoothstep(0.0, 0.7, dist);
    glow = pow(glow, 1.5);
    fragColor = vec4(color, opacity * glow);
  }
`;

// Pulsing fragment shader for selected mesh — opacity oscillates 0.25-0.45 over 0.8s
const selectedFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 color;
  uniform float uTime;
  uniform float baseOpacity;
  in vec2 vUv;
  out vec4 fragColor;

  void main() {
    // Radial glow for selected too
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    float glow = 1.0 - smoothstep(0.0, 0.7, dist);
    glow = pow(glow, 1.5);
    // Pulse: 0.25 to 0.45 (range 0.1, center 0.35) over 0.8s period
    float pulse = 0.35 + sin(uTime * 7.85398163397) * 0.1;
    fragColor = vec4(color, baseOpacity * glow * pulse);
  }
`;

// Ghost fragment shader — very faint (0.08 opacity) with subtle glow
const ghostFragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 color;
  in vec2 vUv;
  out vec4 fragColor;

  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    float glow = 1.0 - smoothstep(0.0, 0.7, dist);
    glow = pow(glow, 2.0);
    fragColor = vec4(color, 0.08 * glow);
  }
`;

// Simple vertex shader for highlight/selected meshes — passes UV for radial glow
const simpleVertexShader = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
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
  const meshGhostRef = useRef<THREE.InstancedMesh>(null!);

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

  // Contiguous index counters for highlight/selected/ghost instance meshes
  const highlightIdx = useRef(0);
  const selectedIdx = useRef(0);
  const ghostIdx = useRef(0);
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
    // TEMP: force CPU path for debugging
    needsSpring.current = true; // cards.some((c) => c.shake || c.highlight || c.selected);

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
    meshGhostRef.current.count = 0;
    meshCardRef.current.instanceMatrix.needsUpdate = true;
    if (meshCardRef.current.geometry.attributes.uvOffsetScale) {
      (meshCardRef.current.geometry.attributes.uvOffsetScale as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }, [cards, getUVs]);

  // UV Offset & Scale Attributes (vec4: u, v, w, h)
  const uvCardAttr = useMemo(() => new Float32Array(MAX_CARDS * 4), []);

  const uniforms = useMemo(() => ({
  map: { value: atlas },
  uTime: { value: 0 },
  uCardCount: { value: 0 },
  uUseGpuAnimation: { value: false },
}), [atlas]);

  useFrame((_, delta) => {
    if (!meshCardRef.current) return;

    // Always update time — cheap single float assignment
    // Cap at 1000 to prevent unbounded growth that could cause GPU precision/timeout issues
    const elapsed = Math.min(uniforms.uTime.value + Math.min(delta, 0.05), 1000);
    uniforms.uTime.value = elapsed;

    // Update selected mesh pulsing via its material uniforms
    const selectedMat = meshSelectedRef.current?.material as THREE.ShaderMaterial | undefined;
    if (selectedMat?.uniforms?.uTime) {
      selectedMat.uniforms.uTime.value = elapsed;
    }

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
    ghostIdx.current = 0;

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
      let shakeZ = 0;
      if (card.shake) {
        const t = performance.now() / 1000;
        // Primary shake: two-frequency rotation
        finalRotZ += Math.sin(t * 22) * 0.06 + Math.sin(t * 37) * 0.03;
        // Secondary damped Z oscillation — starts at 0.1 amplitude, decays exponentially
        shakeZ = Math.sin(t * 18) * 0.1 * Math.exp(-t * 0.5);
      }

      _pos.copy(s.pos);
      _euler.set(0, 0, finalRotZ);
      _quat.setFromEuler(_euler);
      _scale.setScalar(s.scale);
      _matrix.compose(_pos, _quat, _scale);
      meshCardRef.current.setMatrixAt(i, _matrix);

      if (card.highlight) {
        _pos.copy(s.pos);
        _pos.z -= 0.01 + shakeZ;
        _euler.set(0, 0, finalRotZ);
        _quat.setFromEuler(_euler);
        _scale.set(s.scale * 1.05, s.scale * 1.05, 1);
        _matrix.compose(_pos, _quat, _scale);
        meshHighlightRef.current.setMatrixAt(highlightIdx.current, _matrix);
        highlightIdx.current++;

        // Ghost: larger, very faint, behind highlight
        _pos.copy(s.pos);
        _pos.z -= 0.008 + shakeZ * 0.5;
        _euler.set(0, 0, finalRotZ);
        _quat.setFromEuler(_euler);
        _scale.set(s.scale * 1.15, s.scale * 1.15, 1);
        _matrix.compose(_pos, _quat, _scale);
        meshGhostRef.current.setMatrixAt(ghostIdx.current, _matrix);
        ghostIdx.current++;
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
    meshGhostRef.current.count = ghostIdx.current;
    meshCardRef.current.instanceMatrix.needsUpdate = true;
    meshHighlightRef.current.instanceMatrix.needsUpdate = true;
    meshSelectedRef.current.instanceMatrix.needsUpdate = true;
    meshGhostRef.current.instanceMatrix.needsUpdate = true;

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
        </planeGeometry>
        <shaderMaterial
          glslVersion={THREE.GLSL3}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          wireframe={wireframe}
        />
      </instancedMesh>

      <instancedMesh ref={meshHighlightRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]} />
        <shaderMaterial
          glslVersion={THREE.GLSL3}
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
        <shaderMaterial
          glslVersion={THREE.GLSL3}
          uniforms={{ color: { value: new THREE.Color('#00e5ff') }, uTime: { value: 0 }, baseOpacity: { value: 1.0 } }}
          vertexShader={simpleVertexShader}
          fragmentShader={selectedFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>

      <instancedMesh ref={meshGhostRef} args={[null!, null!, MAX_CARDS]}>
        <planeGeometry args={[CARD_ASPECT, 1]} />
        <shaderMaterial
          glslVersion={THREE.GLSL3}
          uniforms={{ color: { value: new THREE.Color('#ffffff') } }}
          vertexShader={simpleVertexShader}
          fragmentShader={ghostFragmentShader}
          transparent
          depthWrite={false}
          wireframe={wireframe}
        />
      </instancedMesh>
    </>
  );
}
