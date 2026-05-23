import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

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

function TableTray({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.012]}>
        <RoundedPlane width={1.35} height={1.9} radius={0.16} segments={12} />
        <meshBasicMaterial color="#05050d" transparent opacity={0.72} />
      </mesh>
      <mesh>
        <RoundedPlane width={1.2} height={1.72} radius={0.14} segments={12} />
        <meshBasicMaterial color="#0f0f1a" transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <RoundedPlane width={1.02} height={1.5} radius={0.12} segments={12} />
        <meshBasicMaterial color={accent} transparent opacity={0.18} />
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
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.75, 0.045, 0.01]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.75, 0.045, 0.01]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export function Table() {
  const surfaceTexture = useMemo(() => createTableSurfaceTexture(), []);
  const backdropTexture = useMemo(() => createBackdropTexture(), []);
  const surfaceGeometry = useMemo(() => new THREE.CircleGeometry(7.05, 160), []);

  useEffect(() => {
    return () => {
      surfaceTexture.dispose();
      backdropTexture.dispose();
      surfaceGeometry.dispose();
    };
  }, [surfaceTexture, backdropTexture, surfaceGeometry]);

  return (
    <group position={[0, 0, -0.16]}>
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[32, 20]} />
        <meshBasicMaterial map={backdropTexture} />
      </mesh>

      <mesh geometry={surfaceGeometry} scale={[1.18, 0.76, 1]} position={[0, 0, -0.035]}>
        <meshBasicMaterial color="#05050d" transparent opacity={0.78} />
      </mesh>

      <mesh geometry={surfaceGeometry} scale={[1.09, 0.69, 1]}>
        <meshStandardMaterial
          map={surfaceTexture}
          roughness={0.9}
          metalness={0.03}
          emissive="#0f0f1a"
          emissiveIntensity={0.12}
        />
      </mesh>

      <mesh position={[0, 0, 0.01]} scale={[1.08, 0.68, 1]}>
        <ringGeometry args={[6.34, 6.46, 160]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.28} />
      </mesh>

      {/* DirectionLane and inner ring removed — non-functional decorative elements */}

      <TableTray position={[-1.5, 0, 0.03]} accent="#00e5ff" />
      <TableTray position={[1.5, 0, 0.03]} accent="#9d4edd" />

      <SeatAnchor position={[0, -4.36, 0.026]} />
      <SeatAnchor position={[0, 4.36, 0.026]} rotation={Math.PI} />
      <SeatAnchor position={[-6.82, 0, 0.026]} rotation={-Math.PI / 2} />
      <SeatAnchor position={[6.82, 0, 0.026]} rotation={Math.PI / 2} />
    </group>
  );
}
