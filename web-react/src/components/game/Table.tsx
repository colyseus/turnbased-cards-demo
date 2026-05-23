import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';

const SURFACE_SIZE = 1024;
const BACKDROP_SIZE = 1024;
const HASH_A = 12.9898;
const HASH_B = 78.233;
const HASH_C = 43758.5453;

function hash(seed: number) {
  const value = Math.sin(seed * HASH_A + HASH_B) * HASH_C;
  return value - Math.floor(value);
}

// eslint-disable-next-line no-unused-vars, no-undef
function createCanvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createTableSurfaceTexture() {
  return createCanvasTexture(SURFACE_SIZE, (ctx) => {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SURFACE_SIZE, SURFACE_SIZE);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14000; i++) {
      const x = hash(i * 3) * SURFACE_SIZE;
      const y = hash(i * 3 + 1) * SURFACE_SIZE;
      const alpha = hash(i * 3 + 2) * 0.035;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(512, 512, 164 + i * 72, 98 + i * 45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(512, 512, 440, 274, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function createBackdropTexture() {
  return createCanvasTexture(BACKDROP_SIZE, (ctx) => {
    const bg = ctx.createLinearGradient(0, 0, BACKDROP_SIZE, BACKDROP_SIZE);
    bg.addColorStop(0, '#1a1a2e');
    bg.addColorStop(0.46, '#0f0f1a');
    bg.addColorStop(1, '#05050d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BACKDROP_SIZE, BACKDROP_SIZE);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let x = -BACKDROP_SIZE; x < BACKDROP_SIZE * 2; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + BACKDROP_SIZE, BACKDROP_SIZE);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(157, 78, 221, 0.09)';
    ctx.beginPath();
    ctx.arc(790, 730, 210, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 229, 255, 0.11)';
    ctx.beginPath();
    ctx.arc(210, 260, 230, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createFeltNormalMap(size = 512) {
  return createCanvasTexture(size, (ctx) => {
    // Flat normal base (pointing up in tangent space = 128,128,255)
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, size, size);

    // Subtle grain bumps for felt texture
    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 8000; i++) {
      const x = hash(i * 2) * size;
      const y = hash(i * 2 + 1) * size;
      const r = hash(i * 3) * 2.5 + 0.5;
      const intensity = hash(i * 3 + 2) * 20 + 118;
      ctx.fillStyle = `rgb(${intensity}, ${intensity}, 255)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createRoundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function RoundedPlane({
  width,
  height,
  radius,
  segments = 8,
}: {
  width: number;
  height: number;
  radius: number;
  segments?: number;
}) {
  const geometry = useMemo(
    () => new THREE.ShapeGeometry(createRoundedRectShape(width, height, radius), segments),
    [height, radius, segments, width]
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return <primitive object={geometry} attach="geometry" />;
}

// Fresnel rim glow shader for table edge ring
const fresnelRingMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: new THREE.Color('#00e5ff') },
    uPower: { value: 2.8 },
    uIntensity: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uPower;
    uniform float uIntensity;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), uPower);
      gl_FragColor = vec4(uColor * fresnel * uIntensity, fresnel * 0.85);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});

function TableTray({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.012]}>
        <RoundedPlane width={1.35} height={1.9} radius={0.16} segments={12} />
        <meshStandardMaterial color="#05050d" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh>
        <RoundedPlane width={1.2} height={1.72} radius={0.14} segments={12} />
        <meshStandardMaterial color="#0f0f1a" roughness={0.25} metalness={0.15} envMapIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <RoundedPlane width={1.02} height={1.5} radius={0.12} segments={12} />
        <meshStandardMaterial
          color={accent}
          roughness={0.08}
          metalness={0.6}
          emissive={accent}
          emissiveIntensity={0.35}
          transparent
          opacity={0.55}
        />
      </mesh>
    </group>
  );
}

function SeatAnchor({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, 0, rotation]}>
      <mesh>
        <ringGeometry args={[0.24, 0.34, 32]} />
        <meshStandardMaterial
          color="#00e5ff"
          metalness={0.3}
          roughness={0.6}
          emissive="#00e5ff"
          emissiveIntensity={0.18}
          transparent
          opacity={0.82}
        />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.75, 0.045, 0.01]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.2}
          roughness={0.7}
          emissive="#ffffff"
          emissiveIntensity={0.08}
          transparent
          opacity={0.45}
        />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.75, 0.045, 0.01]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.2}
          roughness={0.7}
          emissive="#ffffff"
          emissiveIntensity={0.08}
          transparent
          opacity={0.45}
        />
      </mesh>
    </group>
  );
}

export function Table() {
  const surfaceTexture = useMemo(() => createTableSurfaceTexture(), []);
  const backdropTexture = useMemo(() => createBackdropTexture(), []);
  const feltNormalMap = useMemo(() => createFeltNormalMap(), []);
  const surfaceGeometry = useMemo(() => new THREE.CircleGeometry(7.05, 160), []);

  useEffect(() => {
    return () => {
      surfaceTexture.dispose();
      backdropTexture.dispose();
      feltNormalMap.dispose();
      surfaceGeometry.dispose();
    };
  }, [surfaceTexture, backdropTexture, feltNormalMap, surfaceGeometry]);

  return (
    <group position={[0, 0, -0.16]}>
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[32, 20]} />
        <meshStandardMaterial map={backdropTexture} roughness={0.85} metalness={0.05} />
      </mesh>

      <mesh geometry={surfaceGeometry} scale={[1.18, 0.76, 1]} position={[0, 0, -0.035]}>
        <meshStandardMaterial color="#05050d" roughness={0.5} metalness={0.08} />
      </mesh>

      <mesh geometry={surfaceGeometry} scale={[1.09, 0.69, 1]}>
        <meshStandardMaterial
          map={surfaceTexture}
          normalMap={feltNormalMap}
          normalScale={[0.6, 0.6]}
          roughness={0.92}
          metalness={0.04}
          emissive="#0f0f1a"
          emissiveIntensity={0.12}
        />
      </mesh>

      {/* Fresnel rim glow edge ring */}
      <mesh position={[0, 0, 0.01]} scale={[1.08, 0.68, 1]}>
        <ringGeometry args={[6.34, 6.46, 160]} />
        <primitive object={fresnelRingMaterial} attach="material" />
      </mesh>

      <TableTray position={[-1.5, 0, 0.03]} accent="#00e5ff" />
      <TableTray position={[1.5, 0, 0.03]} accent="#9d4edd" />

      <SeatAnchor position={[0, -4.36, 0.026]} />
      <SeatAnchor position={[0, 4.36, 0.026]} rotation={Math.PI} />
      <SeatAnchor position={[-6.82, 0, 0.026]} rotation={-Math.PI / 2} />
      <SeatAnchor position={[6.82, 0, 0.026]} rotation={Math.PI / 2} />

      <ContactShadows
        position={[0, 0, -0.3]}
        opacity={0.55}
        scale={20}
        blur={2.5}
        far={1.5}
        color="#000010"
      />
    </group>
  );
}
