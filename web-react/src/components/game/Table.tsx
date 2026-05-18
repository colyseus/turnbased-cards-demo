import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

// Move static objects outside the component to avoid re-allocation
const TABLE_SIZE: [number, number] = [25, 16];
const TABLE_RADIUS = 2;
const TABLE_SEGMENTS = 64;

export function Table() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    
    // Gradient felt
    const grd = ctx.createRadialGradient(512, 512, 0, 512, 512, 600);
    grd.addColorStop(0, "#1a4d2e");
    grd.addColorStop(1, "#0d2617");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle noise - deterministic (avoids 50k * 3 Math.random() calls blocking main thread)
    for (let i = 0; i < 50000; i++) {
      // Seed-based hash for each component to avoid visible patterns
      const hash = (seed: number) => (Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
      const x = hash(i * 3) * 1024;
      const y = hash(i * 3 + 1) * 1024;
      const alpha = hash(i * 3 + 2) * 0.05;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);

  // Proper disposal of texture
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  // Memoize geometry to avoid recreation on every render
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const [w, h] = TABLE_SIZE;
    const x = -w / 2;
    const y = -h / 2;
    const r = TABLE_RADIUS;

    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    return new THREE.ShapeGeometry(shape, TABLE_SEGMENTS);
  }, []);

  // Proper disposal of geometry
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <group position={[0, 0, -0.1]}>
      {/* Table Surface */}
      <mesh geometry={geometry}>
        <meshStandardMaterial map={texture} roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Table Edge (Shadow) */}
      <mesh position={[0, 0, -0.05]} geometry={geometry} scale={1.02}>
        <meshBasicMaterial color="#000000" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
