import { memo, useRef, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame, invalidate } from '@react-three/fiber';
import { damp3, dampE } from 'maath/easing';
import * as THREE from 'three';
import { useDrag } from '@use-gesture/react';

// Shared no-op raycast function to disable raycasting on decorative meshes
const noRaycast = () => { return; };

// --- Suit color lookup (precomputed) ---
const SUIT_COLORS: Record<string, string> = {
  hearts: 'hsl(354, 85%, 54%)',
  diamonds: 'hsl(354, 85%, 54%)',
  spades: 'hsl(220, 15%, 15%)',
  clubs: 'hsl(220, 15%, 15%)',
  skip: 'hsl(208, 75%, 48%)',
  reverse: 'hsl(148, 55%, 42%)',
  draw2: 'hsl(46, 88%, 50%)',
  wild: 'hsl(42, 85%, 65%)',
  wild4: 'hsl(42, 85%, 65%)',
};
const DEFAULT_SUIT_COLOR = 'hsl(220, 15%, 15%)';

// --- Display text lookup ---
const DISPLAY_TEXT: Record<string, { center: string; corner: string; icon: string }> = {
  skip: { center: '🚫', corner: 'Skip', icon: '🚫' },
  reverse: { center: '🔄', corner: 'Rev', icon: '🔄' },
  draw2: { center: '+2', corner: '+2', icon: '+2' },
  wild: { center: 'WILD', corner: 'WILD', icon: '✨' },
  wild4: { center: '+4', corner: '+4', icon: '✨' },
};

/**
 * Creates an extruded rounded rectangle geometry with the specified dimensions and radius.
 */
function createRoundedRectGeometry(width: number, height: number, depth: number, radius: number, smoothness: number = 8) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  
  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);

  const extrudeSettings = {
    steps: 1,
    depth: depth,
    bevelEnabled: false,
    curveSegments: smoothness
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  return geometry;
}

// Instantiate the 3 shared geometries exactly once on startup
const shadowGeometry = createRoundedRectGeometry(2.05, 2.85, 0.001, 0.15, 12);
const borderGeometry = createRoundedRectGeometry(2.06, 2.86, 0.002, 0.14, 12);
const bodyGeometry = createRoundedRectGeometry(2, 2.8, 0.005, 0.13, 12);

// Instantiate static materials once
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.15, depthWrite: false });
const borderMaterial = new THREE.MeshBasicMaterial({ color: '#d1d5db' });

// Global caches for reusable front materials and textures
const materialCache = new Map<string, THREE.MeshBasicMaterial>();
let sharedBackMaterial: THREE.MeshBasicMaterial | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function disposeCache() {
  materialCache.forEach((mat) => {
    if (mat.map) mat.map.dispose();
    mat.dispose();
  });
  materialCache.clear();

  if (sharedBackMaterial) {
    if (sharedBackMaterial.map) sharedBackMaterial.map.dispose();
    sharedBackMaterial.dispose();
    sharedBackMaterial = null;
  }
}

/**
 * Pre-renders the UNO card back onto a CanvasTexture and returns a shared MeshBasicMaterial.
 */
function getBackMaterial(): THREE.MeshBasicMaterial {
  if (sharedBackMaterial) return sharedBackMaterial;

  const width = 512;
  const height = 716;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fill background with dark forest green
  ctx.fillStyle = '#112a1f';
  ctx.fillRect(0, 0, width, height);

  // Draw gold rings
  ctx.strokeStyle = '#f0c66f';
  ctx.lineWidth = 6;
  
  // Ring 1 (Inner)
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ring 2 (Outer)
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 140, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Draw "UNO" text in the center
  ctx.fillStyle = '#f0c66f';
  ctx.font = 'bold 85px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('UNO', width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  sharedBackMaterial = new THREE.MeshBasicMaterial({ map: texture });
  return sharedBackMaterial;
}

/**
 * Generates and caches front face materials dynamically based on the suit, rank, and symbol.
 */
function getFrontMaterial(suit: string, rank: string, symbol: string): THREE.MeshBasicMaterial {
  const cacheKey = `${suit}_${rank}_${symbol}`;
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey)!;
  }

  const width = 512;
  const height = 716;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fill background with clean solid white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const suitColor = SUIT_COLORS[suit] || DEFAULT_SUIT_COLOR;

  // Retrieve matching text mappings
  let centerText = symbol;
  let cornerText = rank;
  let iconText = symbol;

  if (DISPLAY_TEXT[suit]) {
    centerText = DISPLAY_TEXT[suit].center;
    cornerText = DISPLAY_TEXT[suit].corner;
    iconText = DISPLAY_TEXT[suit].icon;
  }

  ctx.fillStyle = suitColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw central primary card illustration
  const isEmoji = /[\uD800-\uDFFF]./.test(centerText) || centerText === '🚫' || centerText === '🔄' || centerText === '✨';
  ctx.font = `bold ${isEmoji ? '160px' : '140px'} "Outfit", "Inter", sans-serif`;
  ctx.fillText(centerText, width / 2, height / 2);

  // Helper to draw a corner detail
  const drawCorner = (cx: number, cy: number, scaleY: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    if (scaleY < 0) {
      ctx.rotate(Math.PI);
    }
    
    // Draw Corner Rank text
    ctx.textAlign = 'center';
    const isLongRank = cornerText.length > 2;
    ctx.font = `bold ${isLongRank ? '38px' : '52px'} "Outfit", sans-serif`;
    ctx.fillText(cornerText, 0, -25);

    // Draw Mini icon underneath rank
    ctx.font = '36px "Outfit", sans-serif';
    ctx.fillText(iconText, 0, 35);
    ctx.restore();
  };

  // Top-left corner
  drawCorner(75, 95, 1);

  // Bottom-right corner (inverted)
  drawCorner(width - 75, height - 95, -1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  const material = new THREE.MeshBasicMaterial({ map: texture });
  materialCache.set(cacheKey, material);
  return material;
}

interface Card3DProps {
  id: string;
  suit: string;
  rank: string;
  symbol: string;
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  ry: number;
  rz: number;
  zIndex?: number;
  location: string;
  isVisible?: boolean;
  onDrop?: (id: string, tx: number, ty: number) => void;
}

export const Card3D = memo(function Card3D({ id, suit, rank, symbol, tx: ptx, ty: pty, tz: ptz, rx: prx, ry: pry, rz: prz, zIndex = 0, location, isVisible = true, onDrop }: Card3DProps) {
  const meshRef = useRef<THREE.Group>(null);
  const hovered = useRef(false);
  const dragged = useRef(false);
  const dragPos = useRef(new THREE.Vector3());
  const atRest = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  // Prop coordinate change detection ref to wake up the canvas loop on updates
  const lastTarget = useRef({ ptx, pty, ptz, prx, pry, prz });
  if (
    lastTarget.current.ptx !== ptx ||
    lastTarget.current.pty !== pty ||
    lastTarget.current.ptz !== ptz ||
    lastTarget.current.prx !== prx ||
    lastTarget.current.pry !== pry ||
    lastTarget.current.prz !== prz
  ) {
    lastTarget.current = { ptx, pty, ptz, prx, pry, prz };
    atRest.current = false;
  }

  const bind = useDrag(({ active, movement: [x, y], event }) => {
    if (event) event.stopPropagation();
    dragged.current = active;
    atRest.current = false;
    invalidate();
    if (active) {
      dragPos.current.set(
        ptx + x * 0.05,
        pty - y * 0.05,
        ptz + 2
      );
    } else {
      if (onDropRef.current) {
        onDropRef.current(id, dragPos.current.x, dragPos.current.y);
      }
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    hovered.current = true;
    atRest.current = false;
    invalidate();
  };

  const handlePointerOut = () => {
    hoverTimer.current = setTimeout(() => {
      hovered.current = false;
      hoverTimer.current = null;
      atRest.current = false;
      invalidate();
    }, 16);
  };

  useFrame((_state, delta) => {
    if (!meshRef.current || !isVisible) return;
    
    // Skip calculations if the card is already at rest
    if (atRest.current && !dragged.current && !hovered.current) return;
    
    const mesh = meshRef.current;
    const dt = Math.min(delta, 0.05);

    let tx = ptx;
    let ty = pty;
    let tz = ptz + zIndex * 0.01;
    let rx = prx;
    let ry = pry;
    const rz = prz;

    if (dragged.current) {
      tx = dragPos.current.x;
      ty = dragPos.current.y;
      tz = dragPos.current.z;
      ry += (mesh.position.x - tx) * 0.2;
      rx -= (mesh.position.y - ty) * 0.2;
    } else if (hovered.current && location !== 'deck') {
      ty += 0.5;
      tz += 0.5;
      rx += 0.1;
    }

    damp3(mesh.position, [tx, ty, tz], 0.12, dt);

    if (location === 'hand' && !dragged.current && !hovered.current) {
      const isFlipping = Math.abs(mesh.rotation.y - ry) > 0.1;
      dampE(mesh.rotation, [rx, ry, rz], isFlipping ? 0.2 + (zIndex || 0) * 0.02 : 0.12, dt);
    } else {
      dampE(mesh.rotation, [rx, ry, rz], 0.12, dt);
    }

    // Determine if motion limits are reached and put the mesh to rest
    const posDiff =
      (tx - mesh.position.x) ** 2 +
      (ty - mesh.position.y) ** 2 +
      (tz - mesh.position.z) ** 2;
    const rotDiff =
      (rx - mesh.rotation.x) ** 2 +
      (ry - mesh.rotation.y) ** 2 +
      (rz - mesh.rotation.z) ** 2;

    if (!dragged.current && !hovered.current && posDiff < 0.0001 && rotDiff < 0.0001) {
      mesh.position.set(tx, ty, tz);
      mesh.rotation.set(rx, ry, rz);
      atRest.current = true;
    } else {
      invalidate();
    }
  });

  const frontMaterial = useMemo(() => getFrontMaterial(suit, rank, symbol), [suit, rank, symbol]);
  const backMaterial = useMemo(() => getBackMaterial(), []);

  if (!isVisible) return null;

  return (
    <group
      ref={meshRef}
      position={[ptx, pty, ptz]}
      rotation={[prx, pry, prz]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...((bind as any)())}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Reusable drop shadow mesh */}
      <mesh geometry={shadowGeometry} material={shadowMaterial} position={[0.04, -0.04, -0.008]} raycast={noRaycast} />

      {/* Reusable grey border mesh */}
      <mesh geometry={borderGeometry} material={borderMaterial} position={[0, 0, 0]} raycast={noRaycast} />

      {/* Reusable back face mesh with UNO emblem baked texture */}
      <mesh geometry={bodyGeometry} material={backMaterial} position={[0, 0, -0.0025]} rotation={[0, Math.PI, 0]} raycast={noRaycast} />

      {/* Reusable front face mesh with dynamic HSL suit color and text baked texture */}
      <mesh geometry={bodyGeometry} material={frontMaterial} position={[0, 0, 0.0025]} />
    </group>
  );
});
