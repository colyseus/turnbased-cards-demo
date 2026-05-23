import { useEffect, useMemo } from "react";
import * as THREE from "three";

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
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createTableSurfaceTexture() {
  return createCanvasTexture(SURFACE_SIZE, (ctx) => {
    const g = ctx.createRadialGradient(512, 460, 20, 512, 512, 600);
    g.addColorStop(0, "#163f4e");
    g.addColorStop(0.42, "#0d2530");
    g.addColorStop(0.76, "#09141c");
    g.addColorStop(1, "#05070b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SURFACE_SIZE, SURFACE_SIZE);

    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 18000; i++) {
      const x = hash(i * 3) * SURFACE_SIZE;
      const y = hash(i * 3 + 1) * SURFACE_SIZE;
      const alpha = hash(i * 3 + 2) * 0.045;
      ctx.fillStyle = `rgba(140, 255, 245, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(75, 212, 200, 0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(512, 512, 170 + i * 70, 104 + i * 44, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(247, 247, 242, 0.055)";
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(512 + i * 72, 190);
      ctx.lineTo(512 + i * 72, 834);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(190, 512 + i * 42);
      ctx.lineTo(834, 512 + i * 42);
      ctx.stroke();
    }
  });
}

function createBackdropTexture() {
  return createCanvasTexture(BACKDROP_SIZE, (ctx) => {
    const bg = ctx.createRadialGradient(450, 300, 0, 512, 512, 710);
    bg.addColorStop(0, "#133844");
    bg.addColorStop(0.36, "#101824");
    bg.addColorStop(0.72, "#090b10");
    bg.addColorStop(1, "#040506");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BACKDROP_SIZE, BACKDROP_SIZE);

    ctx.strokeStyle = "rgba(75, 212, 200, 0.055)";
    ctx.lineWidth = 1;
    for (let x = -BACKDROP_SIZE; x < BACKDROP_SIZE * 2; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + BACKDROP_SIZE, BACKDROP_SIZE);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 98, 95, 0.08)";
    ctx.beginPath();
    ctx.arc(790, 730, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(75, 212, 200, 0.1)";
    ctx.beginPath();
    ctx.arc(210, 260, 250, 0, Math.PI * 2);
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
    [height, radius, segments, width],
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return <primitive object={geometry} attach="geometry" />;
}

function TableTray({
  position,
  accent,
}: {
  position: [number, number, number];
  accent: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.012]}>
        <RoundedPlane width={1.35} height={1.9} radius={0.16} segments={12} />
        <meshBasicMaterial color="#05070b" transparent opacity={0.68} />
      </mesh>
      <mesh>
        <RoundedPlane width={1.2} height={1.72} radius={0.14} segments={12} />
        <meshBasicMaterial color="#111923" transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <RoundedPlane width={1.02} height={1.5} radius={0.12} segments={12} />
        <meshBasicMaterial color={accent} transparent opacity={0.16} />
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
        <meshBasicMaterial color="#4bd4c8" transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.75, 0.045, 0.01]} />
        <meshBasicMaterial color="#f7f7f2" transparent opacity={0.18} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.75, 0.045, 0.01]} />
        <meshBasicMaterial color="#f7f7f2" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function DirectionLane() {
  return (
    <group position={[0, 0, 0.018]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <ringGeometry args={[2.35, 2.43, 72, 1, 0.1, Math.PI * 0.32]} />
          <meshBasicMaterial color="#4bd4c8" transparent opacity={0.22} />
        </mesh>
      ))}
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
        <meshBasicMaterial color="#020304" transparent opacity={0.68} />
      </mesh>

      <mesh geometry={surfaceGeometry} scale={[1.09, 0.69, 1]}>
        <meshStandardMaterial
          map={surfaceTexture}
          roughness={0.9}
          metalness={0.03}
          emissive="#07161d"
          emissiveIntensity={0.18}
        />
      </mesh>

      <mesh position={[0, 0, 0.01]} scale={[1.08, 0.68, 1]}>
        <ringGeometry args={[6.34, 6.46, 160]} />
        <meshBasicMaterial color="#4bd4c8" transparent opacity={0.28} />
      </mesh>

      <mesh position={[0, 0, 0.014]} scale={[1.08, 0.68, 1]}>
        <ringGeometry args={[3.55, 3.6, 128]} />
        <meshBasicMaterial color="#f7f7f2" transparent opacity={0.09} />
      </mesh>

      <DirectionLane />

      <TableTray position={[-1.5, 0, 0.03]} accent="#4c8dff" />
      <TableTray position={[1.5, 0, 0.03]} accent="#ff625f" />

      <SeatAnchor position={[0, -4.36, 0.026]} />
      <SeatAnchor position={[0, 4.36, 0.026]} rotation={Math.PI} />
      <SeatAnchor position={[-6.82, 0, 0.026]} rotation={-Math.PI / 2} />
      <SeatAnchor position={[6.82, 0, 0.026]} rotation={Math.PI / 2} />
    </group>
  );
}
