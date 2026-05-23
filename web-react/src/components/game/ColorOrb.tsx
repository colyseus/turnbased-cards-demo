import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STIFFNESS = 200;
const DAMPING = 20;

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uTime;
  uniform float uPopIntensity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  // Layered value noise for facet slice lines
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    // Fresnel rim glow
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.5);

    // Procedural facet-slice lines — two noise frequencies
    float n1 = noise(vPosition * 4.0 + uTime * 0.15);
    float n2 = noise(vPosition * 9.0 - uTime * 0.08);
    float facetLine = smoothstep(0.45, 0.55, n1) * smoothstep(0.48, 0.52, n2);

    // Core glow — radial brightness strongest at face centers
    float coreGlow = 1.0 - length(vPosition) * 1.2;
    coreGlow = clamp(coreGlow, 0.0, 1.0);
    coreGlow = pow(coreGlow, 1.5);

    // Breathing pulse — period ~2s
    float breath = sin(uTime * 3.14159) * 0.05 + 0.95;

    // Combine: base color + fresnel rim + facet darkening + core glow
    vec3 baseColor = uColor * (0.6 + coreGlow * 0.4);
    vec3 rimColor = uColor * fresnel * 2.5;
    float facetDark = mix(0.0, 0.35, facetLine);
    vec3 finalColor = (baseColor + rimColor) * (1.0 - facetDark) * breath;

    // Pop brightness boost
    finalColor *= uPopIntensity;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

interface ColorOrbProps {
  color: string;
  isWildCard?: boolean;
  scale?: number;
  position?: [number, number, number];
}

export function ColorOrb({
  color,
  isWildCard = false,
  scale = 0.4,
  position = [0, 1.55, 0.52],
}: ColorOrbProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const scaleSpring = useRef(1.0);
  const scaleVel = useRef(0.0);
  const prevColor = useRef<string>(color);
  const popIntensity = useRef(1.0);
  const elapsed = useRef(0.0);

  const geometry = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const colorVec = useMemo(() => new THREE.Color(color), [color]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // Trigger pop animation when color changes
  useEffect(() => {
    if (color !== prevColor.current) {
      prevColor.current = color;
      colorVec.set(color);
      popIntensity.current = isWildCard ? 1.5 : 1.2;
      scaleVel.current = 0;
      scaleSpring.current = 0;
    }
  }, [color, isWildCard, colorVec]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;

    // Decay pop intensity back to 1.0
    popIntensity.current += (1.0 - popIntensity.current) * dt * 5;

    // Spring toward target scale of 1.0
    const target = 1.0;
    const deltaS = target - scaleSpring.current;
    const acc = STIFFNESS * deltaS - DAMPING * scaleVel.current;
    scaleVel.current += acc * dt;
    scaleSpring.current += scaleVel.current * dt;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(scale * scaleSpring.current);
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(color);
      materialRef.current.uniforms.uTime.value = elapsed.current;
      materialRef.current.uniforms.uPopIntensity.value = popIntensity.current;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uColor: { value: colorVec },
            uTime: { value: 0 },
            uPopIntensity: { value: 1.0 },
          }}
        />
      </mesh>
    </group>
  );
}
