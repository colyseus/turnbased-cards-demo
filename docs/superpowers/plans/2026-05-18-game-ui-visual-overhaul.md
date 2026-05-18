# Game UI Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Classic Lounge visual overhaul to all in-game UI — wood/felt/cream/gold palette, pill HUD buttons, stacked color cards, carved wood pointer, beveled wood ring, felt card overlays.

**Architecture:** Pure CSS + R3F component changes. No state changes, no game logic. Changes are layered on top of existing game state.

**Tech Stack:** React 19, Three.js 0.183, React Three Fiber 9, CSS custom properties

---

## Design Palette (CSS Custom Properties)

These vars go at the top of `index.css :root`:

```css
--felt-green:    #1a5c38;
--felt-dark:     #0d3d22;
--wood-dark:     #3d2010;
--wood-medium:   #6b3d1f;
--wood-light:    #8b5e34;
--cream:         #f5e6c8;
--cream-dark:    #d4c4a0;
--gold:          #c9a84c;
--gold-glow:     #e8c96a;
```

---

## Task 1: CSS Custom Properties & Root Background

**Files:**
- Modify: `web-react/src/index.css:1-13`

- [ ] **Step 1: Update `:root` with new color palette**

Find the existing `:root` block at line 1. Replace it entirely with:

```css
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: dark;
  background-color: var(--felt-green);

  /* Classic Lounge palette */
  --felt-green:    #1a5c38;
  --felt-dark:     #0d3d22;
  --wood-dark:     #3d2010;
  --wood-medium:   #6b3d1f;
  --wood-light:    #8b5e34;
  --cream:         #f5e6c8;
  --cream-dark:    #d4c4a0;
  --gold:          #c9a84c;
  --gold-glow:     #e8c96a;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2: Add slideUp keyframe animation**

Find the `@media (prefers-reduced-motion)` block at the end of the file. Before it, add:

```css
/* Spring entrance for info chips */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Spring exit for info chips */
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

- [ ] **Step 3: Type check and build**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/index.css
git commit -m "feat: add Classic Lounge CSS palette and keyframe animations"
```

---

## Task 2: Pill HUD Buttons

**Files:**
- Modify: `web-react/src/index.css:543-572` (the `.hud-btn` block)

- [ ] **Step 1: Replace `.hud-btn` styles**

Find `.hud-btn {` around line 543 in `index.css`. Replace the entire `.hud-btn`, `.hud-btn:hover`, and `.hud-btn:focus-visible` blocks with:

```css
/* HUD action buttons */
.hud-actions {
  position: absolute;
  top: 12px;
  right: 16px;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.hud-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1.5px solid rgba(201, 168, 76, 0.3);
  background: rgba(20, 10, 5, 0.7);
  color: #f5e6c8;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: monospace;
  backdrop-filter: blur(4px);
}

.hud-btn:hover {
  border-color: #c9a84c;
  background: rgba(40, 20, 10, 0.78);
  color: #f5e6c8;
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(201, 168, 76, 0.25);
}

.hud-btn:focus-visible {
  border-color: #c9a84c;
  background: rgba(40, 20, 10, 0.78);
  outline: 2px solid #c9a84c;
  outline-offset: 1px;
  transform: scale(1.05);
}
```

- [ ] **Step 2: Verify build**

Run: `cd web-react && npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add web-react/src/index.css
git commit -m "feat: pill-style HUD buttons with gold border and spring hover"
```

---

## Task 3: Felt Card Overlay CSS

**Files:**
- Modify: `web-react/src/index.css:574-650` (`.rules-overlay`, `.rules-card`, `.rules-header`, `.rules-body`, `.rules-close`)

- [ ] **Step 1: Replace overlay styles**

Find `.rules-overlay` (~line 574). Replace everything from `.rules-overlay` through `.rules-close:hover` with:

```css
/* Rules overlay */
.rules-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 20, 10, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  animation: fadeIn 0.25s ease-out;
  z-index: 10;
  backdrop-filter: blur(8px);
}

.rules-card,
.options-card,
.chat-card,
.rematch-card {
  background: #f5e6c8;
  border-radius: 12px;
  border-top: 4px solid #c9a84c;
  padding: 28px 32px;
  max-width: 460px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.08);
  color: #2d1810;
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.rules-header h2 {
  font-family: Georgia, 'Times New Roman', serif;
  color: #3d2010;
  font-size: 22px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.rules-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(60, 30, 10, 0.2);
  background: rgba(60, 30, 10, 0.08);
  color: #3d2010;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.rules-close:hover {
  background: rgba(201, 168, 76, 0.35);
  color: #3d2010;
}

.rules-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rules-body section h3 {
  font-size: 13px;
  font-weight: 700;
  color: #6b3d1f;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  font-family: Inter, system-ui, sans-serif;
}

.rules-body section p,
.rules-body section li {
  font-family: Georgia, 'Times New Roman', serif;
  color: #2d1810;
  line-height: 1.6;
}

.rules-body section li strong {
  color: #3d2010;
}

/* Warm scrollbar for overlays */
.rules-card::-webkit-scrollbar,
.options-card::-webkit-scrollbar,
.chat-card::-webkit-scrollbar,
.rematch-card::-webkit-scrollbar {
  width: 6px;
}
.rules-card::-webkit-scrollbar-track,
.options-card::-webkit-scrollbar-track,
.chat-card::-webkit-scrollbar-track,
.rematch-card::-webkit-scrollbar-track {
  background: rgba(61, 32, 16, 0.1);
  border-radius: 3px;
}
.rules-card::-webkit-scrollbar-thumb,
.options-card::-webkit-scrollbar-thumb,
.chat-card::-webkit-scrollbar-thumb,
.rematch-card::-webkit-scrollbar-thumb {
  background: rgba(61, 32, 16, 0.3);
  border-radius: 3px;
}
```

- [ ] **Step 2: Verify build**

Run: `cd web-react && npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add web-react/src/index.css
git commit -m "feat: felt card style overlays with cream panels and wood accents"
```

---

## Task 4: Last Played Info Chip

**Files:**
- Modify: `web-react/src/index.css`
- Modify: `web-react/src/components/game/GameHud.tsx:91-97`

- [ ] **Step 1: Add `.last-played-info` CSS**

Find the end of `index.css` (before `@media (prefers-reduced-motion)`). Add:

```css
/* Last Played Info Chip */
.last-played-info {
  position: absolute;
  bottom: 22%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(245, 230, 200, 0.95);
  border-left: 3px solid #c9a84c;
  border-radius: 6px;
  padding: 8px 16px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  color: #2d1810;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
  backdrop-filter: blur(4px);
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  white-space: nowrap;
  z-index: 5;
}

.last-played-info .player-name {
  font-family: Inter, system-ui, sans-serif;
  font-weight: 700;
  color: #3d2010;
  margin-right: 4px;
}

.last-played-info .card-name {
  font-style: italic;
  color: #6b3d1f;
}
```

- [ ] **Step 2: Update GameHud.tsx to wrap content in spans**

In `GameHud.tsx`, find the last-played div (around line 91). Replace it with:

```tsx
<div className="last-played-info">
  <span className="player-name">{lastPlayed.playerName}</span>
  {" played "}
  <span className="card-name">{lastPlayed.cardId.replace(/_/g, " ")}</span>
</div>
```

- [ ] **Step 3: Verify build**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/index.css web-react/src/components/game/GameHud.tsx
git commit -m "feat: felt-style last-played info chip with slideUp animation"
```

---

## Task 5: Player Label Badges

**Files:**
- Modify: `web-react/src/index.css` (`.player-label` block)

- [ ] **Step 1: Replace `.player-label` styles**

Find `.player-label` in `index.css` (around line 86). Replace its styles with:

```css
.player-label {
  position: absolute;
  color: #3d2010;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(245, 230, 200, 0.8);
  transition: color 0.3s, transform 0.3s, text-shadow 0.3s;
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: Inter, system-ui, sans-serif;
  background: rgba(245, 230, 200, 0.88);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(201, 168, 76, 0.4);
}
```

- [ ] **Step 2: Commit**

```bash
git add web-react/src/index.css
git commit -m "feat: cream player label badges with wood-dark text"
```

---

## Task 6: ColorPicker — Stacked Color Cards

**Files:**
- Modify: `web-react/src/components/game/ColorPicker.tsx` (full rewrite)

- [ ] **Step 1: Read the current file to understand the API**

The component receives:
- `hoveredPickerColor: UnoColor | null`
- `onPickColor: (_: UnoColor) => void`
- `onHoverColor: (_: UnoColor | null) => void`

The `Game.tsx` passes these. No prop changes needed — keep same interface.

- [ ] **Step 2: Write the new stacked color cards implementation**

Read the current `ColorPicker.tsx` first. Then overwrite it entirely with:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnoColor } from '../../../../server/shared/uno';

const CARD_ASPECT = 240 / 375;
const PICKER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const COLOR_HEX: Record<UnoColor, string> = {
  red: "#ff3333",
  blue: "#3377ff",
  green: "#33bb44",
  yellow: "#ffcc00",
};

interface CardMesh {
  mesh: THREE.Mesh;
  targetScale: number;
  targetZ: number;
  currentScale: number;
  currentZ: number;
  velScale: number;
  velZ: number;
}

export function ColorPicker({
  hoveredPickerColor,
  onPickColor,
  onHoverColor,
}: {
  hoveredPickerColor: UnoColor | null;
  onPickColor: (_: UnoColor) => void;
  onHoverColor: (_: UnoColor | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null!);
  const overlayVel = useRef(0);

  // One card mesh per color, pre-created
  const cards = useRef<CardMesh[]>([]);

  // Build card meshes on first render (stable refs, never recreated)
  if (cards.current.length === 0) {
    const cardGeo = new THREE.BoxGeometry(CARD_ASPECT * 0.55, 0.55, 0.02);
    const backGeo = new THREE.BoxGeometry(CARD_ASPECT * 0.55, 0.55, 0.025);

    PICKER_COLORS.forEach((color, i) => {
      const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
      const r = 0.6;

      const frontMat = new THREE.MeshBasicMaterial({ color: COLOR_HEX[color] });
      const backMat = new THREE.MeshBasicMaterial({ color: '#f5e6c8' });

      const group = new THREE.Group();
      group.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);

      const front = new THREE.Mesh(cardGeo, frontMat);
      front.position.z = 0.001;
      const back = new THREE.Mesh(backGeo, backMat);
      back.position.z = -0.001;
      back.rotation.y = Math.PI;

      group.add(front);
      group.add(back);
      group.rotation.z = angle + Math.PI / 2;

      // Start scaled to 0 (invisible)
      group.scale.setScalar(0);

      cards.current.push({
        mesh: group as any,
        targetScale: 1,
        targetZ: 0,
        currentScale: 0,
        currentZ: 0,
        velScale: 0,
        velZ: 0,
      });

      groupRef.current?.add(group);
    });
  }

  // Spring constants
  const STIFFNESS = 280;
  const DAMPING = 22;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;
    if (!g) return;

    // Animate overlay fade-in on mount
    if (overlayRef.current) {
      const cur = overlayRef.current.opacity;
      const acc = 200 * (0.55 - cur) - 30 * overlayVel.current;
      overlayVel.current += acc * dt;
      const next = cur + overlayVel.current * dt;
      overlayRef.current.opacity = Math.max(0, Math.min(0.55, next));
    }

    const elapsed = (Date.now() / 1000);

    cards.current.forEach((card, i) => {
      const color = PICKER_COLORS[i];
      const isHovered = hoveredPickerColor === color;

      // Target based on hover state
      card.targetScale = isHovered ? 1.3 : 1.0;
      card.targetZ = isHovered ? 0.08 : 0;

      // Float animation (idle sin wave)
      const floatOffset = Math.sin(elapsed * 1.2 + i * 1.57) * 0.015;
      const baseY = card.mesh.position.y;

      // Spring scale
      const accScale = STIFFNESS * (card.targetScale - card.currentScale) - DAMPING * card.velScale;
      card.velScale += accScale * dt;
      card.currentScale += card.velScale * dt;
      card.mesh.scale.setScalar(card.currentScale);

      // Spring z (bring to front on hover)
      const accZ = STIFFNESS * (card.targetZ - card.currentZ) - DAMPING * card.velZ;
      card.velZ += accZ * dt;
      card.currentZ += card.velZ * dt;

      // Update card group z (using children[0] for front face)
      const frontMesh = card.mesh.children[0] as THREE.Mesh;
      const backMesh = card.mesh.children[1] as THREE.Mesh;
      if (frontMesh) frontMesh.position.z = 0.001 + card.currentZ;
      if (backMesh) backMesh.position.z = -0.001 + card.currentZ - 0.01;

      // Subtle float
      card.mesh.position.y = baseY + floatOffset;
    });
  });

  return (
    <group ref={groupRef}>
      {/* Dark overlay behind */}
      <mesh position={[0, 0, 1.5]}>
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial
          ref={overlayRef}
          color="#0a1408"
          transparent
          opacity={0}
        />
      </mesh>

      {/* Click plane to dismiss */}
      <mesh
        position={[0, 0, 1.4]}
        onClick={() => onHoverColor(null)}
      >
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}
```

**Note:** The `groupRef.current?.add(group)` in the `if (cards.current.length === 0)` block needs the groupRef to exist. In R3F, we can't add meshes to `groupRef.current` before it's mounted. Instead, render cards via JSX.

- [ ] **Step 3: Fix the card creation approach to use JSX**

Replace the entire file with a JSX-based approach:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { UnoColor } from '../../../../server/shared/uno';

const CARD_W = 240 / 375 * 0.55;
const CARD_H = 0.55;
const PICKER_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const COLOR_HEX: Record<UnoColor, string> = {
  red: "#ff3333",
  blue: "#3377ff",
  green: "#33bb44",
  yellow: "#ffcc00",
};

interface CardState {
  scale: number;
  scaleVel: number;
  zOffset: number;
  zVel: number;
}

export function ColorPicker({
  hoveredPickerColor,
  onPickColor,
  onHoverColor,
}: {
  hoveredPickerColor: UnoColor | null;
  onPickColor: (_: UnoColor) => void;
  onHoverColor: (_: UnoColor | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const overlayRef = useRef<THREE.MeshBasicMaterial>(null!);
  const overlayVel = useRef(0);
  const cardStates = useRef<Record<UnoColor, CardState>>({
    red:    { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
    yellow: { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
    green:  { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
    blue:   { scale: 0, scaleVel: 0, zOffset: 0, zVel: 0 },
  });

  const STIFFNESS = 280;
  const DAMPING = 22;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = Date.now() / 1000;

    // Overlay spring in
    if (overlayRef.current) {
      const cur = overlayRef.current.opacity;
      const acc = 200 * (0.55 - cur) - 30 * overlayVel.current;
      overlayVel.current += acc * dt;
      overlayRef.current.opacity = Math.max(0, Math.min(0.55, cur + overlayVel.current * dt));
    }

    PICKER_COLORS.forEach((color, i) => {
      const state = cardStates.current[color];
      const isHovered = hoveredPickerColor === color;
      const targetScale = isHovered ? 1.3 : 1.0;
      const targetZ = isHovered ? 0.08 : 0;

      const accScale = STIFFNESS * (targetScale - state.scale) - DAMPING * state.scaleVel;
      state.scaleVel += accScale * dt;
      state.scale += state.scaleVel * dt;

      const accZ = STIFFNESS * (targetZ - state.zOffset) - DAMPING * state.zVel;
      state.zVel += accZ * dt;
      state.zOffset += state.zVel * dt;

      // Apply to group via ref (set at mount)
      const group = (groupRef.current as any)?.children?.[i + 2] as THREE.Group | undefined;
      if (group) {
        group.scale.setScalar(state.scale);
        const floatY = Math.sin(elapsed * 1.2 + i * 1.57) * 0.015;
        group.position.z = state.zOffset;
        // y is set by JSX, but we add float offset
        (group as any)._floatY = floatY;
      }
    });
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 1.5]}>
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial ref={overlayRef} color="#0a1408" transparent opacity={0} />
      </mesh>

      <mesh position={[0, 0, 1.4]} onClick={() => onHoverColor(null)}>
        <planeGeometry args={[25, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {PICKER_COLORS.map((color, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
        const r = 0.6;
        return (
          <group
            key={color}
            position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
            scale={0}
          >
            {/* Front face — color */}
            <mesh position={[0, 0, 0.012]}>
              <boxGeometry args={[CARD_W, CARD_H, 0.02]} />
              <meshBasicMaterial color={COLOR_HEX[color]} />
            </mesh>
            {/* Back face — cream */}
            <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
              <boxGeometry args={[CARD_W, CARD_H, 0.025]} />
              <meshBasicMaterial color="#f5e6c8" />
            </mesh>
            {/* Hit area */}
            <mesh
              position={[0, 0, 0.03]}
              onClick={(e) => { e.stopPropagation(); onPickColor(color); }}
              onPointerEnter={() => onHoverColor(color)}
              onPointerLeave={() => onHoverColor(null)}
            >
              <boxGeometry args={[CARD_W, CARD_H, 0.01]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 4: Type check**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors (or fix any import/JSX type errors)

- [ ] **Step 5: Build**

Run: `cd web-react && npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add web-react/src/components/game/ColorPicker.tsx
git commit -m "feat: stacked color cards picker with spring animations"
```

---

## Task 7: TurnIndicator — Carved Wood Pointer

**Files:**
- Modify: `web-react/src/components/game/TurnIndicator.tsx`

- [ ] **Step 1: Read current file**

Current file uses `ARROW_SHAPE` (a simple arrow). Replace the geometry with a carved wooden finger shape and update materials.

- [ ] **Step 2: Write the new TurnIndicator**

Overwrite `TurnIndicator.tsx` entirely with:

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SEAT_COUNT = 4;
const POINTER_RADIUS = 2.5;

// Carved wood finger pointer shape
const POINTER_SHAPE = new THREE.Shape();
POINTER_SHAPE.moveTo(0, 0.5);
POINTER_SHAPE.bezierCurveTo(0.08, 0.5, 0.12, 0.3, 0.14, 0.1);
POINTER_SHAPE.lineTo(0.14, -0.3);
POINTER_SHAPE.lineTo(-0.14, -0.3);
POINTER_SHAPE.lineTo(-0.14, 0.1);
POINTER_SHAPE.bezierCurveTo(-0.12, 0.3, -0.08, 0.5, 0, 0.5);
POINTER_SHAPE.closePath();

// Direction arc shape
const DIR_ARC_SHAPE = new THREE.Shape();
DIR_ARC_SHAPE.absarc(0, 0, 1.0, 0, Math.PI * 0.35, false);
DIR_ARC_SHAPE.lineTo(0.88, 0.88);
DIR_ARC_SHAPE.lineTo(1.12, 1.12);
DIR_ARC_SHAPE.absarc(0, 0, 1.24, Math.PI * 0.35, 0, true);
DIR_ARC_SHAPE.closePath();

const POINTER_GEO = new THREE.ShapeGeometry(POINTER_SHAPE);
const DIR_ARC_GEO = new THREE.ShapeGeometry(DIR_ARC_SHAPE);

// Wood materials (dark walnut + lighter edge)
const WOOD_DARK_MAT = new THREE.MeshStandardMaterial({
  color: '#5c3317',
  roughness: 0.85,
  metalness: 0.05,
});
const WOOD_LIGHT_MAT = new THREE.MeshStandardMaterial({
  color: '#8b5e34',
  roughness: 0.8,
  metalness: 0.05,
});

export function TurnIndicator({
  activePlayerIndex,
  reverse,
}: {
  activePlayerIndex: number;
  reverse: boolean;
}) {
  const pointerRef = useRef<THREE.Group>(null!);
  const dirRef = useRef<THREE.Group>(null!);
  const currentRotation = useRef(0);
  const rotationVel = useRef(0);

  const STIFFNESS = 180;
  const DAMPING = 18;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const targetAngle = -(activePlayerIndex / SEAT_COUNT) * Math.PI * 2;

    let deltaAngle = targetAngle - currentRotation.current;
    // Wrap to [-PI, PI]
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    const acc = STIFFNESS * deltaAngle - DAMPING * rotationVel.current;
    rotationVel.current += acc * dt;
    currentRotation.current += rotationVel.current * dt;

    if (pointerRef.current) {
      pointerRef.current.rotation.z = currentRotation.current;
    }

    if (dirRef.current) {
      dirRef.current.rotation.z = reverse ? Math.PI : 0;
    }
  });

  return (
    <group position={[0, 0, 0.01]}>
      {/* Carved wood pointer — rotates to active player */}
      <group ref={pointerRef}>
        {/* Shadow beneath */}
        <mesh position={[0, 0, -0.005]} rotation={[0, 0, 0]}>
          <shapeGeometry args={[POINTER_SHAPE]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.2} />
        </mesh>
        {/* Main pointer */}
        <mesh geometry={POINTER_GEO}>
          <meshStandardMaterial color="#5c3317" roughness={0.85} metalness={0.05} />
        </mesh>
        {/* Lighter wood edge highlight */}
        <mesh position={[0, 0, 0.002]} geometry={POINTER_GEO}>
          <meshStandardMaterial color="#8b5e34" roughness={0.8} metalness={0.05} side={THREE.BackSide} />
        </mesh>
      </group>

      {/* Seat number circles — positioned at each seat */}
      {Array.from({ length: SEAT_COUNT }, (_, i) => {
        const angle = (i / SEAT_COUNT) * Math.PI * 2;
        const x = Math.sin(angle) * POINTER_RADIUS;
        const y = Math.cos(angle) * POINTER_RADIUS;
        return (
          <mesh key={i} position={[x, y, 0.02]}>
            <circleGeometry args={[0.18, 24]} />
            <meshStandardMaterial
              color={i === activePlayerIndex ? '#c9a84c' : '#f5e6c8'}
              roughness={0.7}
              metalness={0.05}
            />
          </mesh>
        );
      })}

      {/* Direction arc */}
      <group ref={dirRef}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={`dir-${i}`}
            position={[0, 0, 0]}
            rotation={[0, 0, (i / SEAT_COUNT) * Math.PI * 2]}
          >
            <shapeGeometry args={[DIR_ARC_SHAPE]} />
            <meshStandardMaterial
              color="#c9a84c"
              transparent
              opacity={0.55}
              roughness={0.7}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
```

- [ ] **Step 3: Type check and build**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/components/game/TurnIndicator.tsx
git commit -m "feat: carved wood pointer with spring rotation and gold seat markers"
```

---

## Task 8: AnimatedRing — Beveled Wood Ring

**Files:**
- Modify: `web-react/src/components/game/AnimatedRing.tsx`

- [ ] **Step 1: Read current file**

The current `AnimatedRing.tsx` uses two `CircleGeometry` meshes. Replace with `RingGeometry` for a beveled wood inlay look.

- [ ] **Step 2: Write the new AnimatedRing**

Overwrite `AnimatedRing.tsx` with:

```tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STIFFNESS = 200;
const DAMPING = 25;

export function AnimatedRing({
  color,
  innerRadius,
  outerRadius,
  position,
}: {
  color: string;
  innerRadius: number;
  outerRadius: number;
  position: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const vel = useRef({ scale: 0 });
  const prevColor = useRef(color);
  const target = useRef({ scale: 1 });
  const currentScale = useRef(1);

  // Geometries (radii derived from props)
  const outerRingGeo = useMemo(
    () => new THREE.RingGeometry(innerRadius, outerRadius, 48),
    [innerRadius, outerRadius]
  );
  const innerFillGeo = useMemo(
    () => new THREE.CircleGeometry(innerRadius * 0.97, 48),
    [innerRadius]
  );
  const inlayGeo = useMemo(
    () => new THREE.RingGeometry(innerRadius + 0.01, innerRadius + 0.03, 48),
    [innerRadius]
  );

  // Spring-pop when color changes
  if (color !== prevColor.current) {
    prevColor.current = color;
    target.current.scale = 1.8; // pop outward
    vel.current.scale = 0;
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = groupRef.current;
    if (!g) return;

    // Spring scale
    const cur = currentScale.current;
    const acc = STIFFNESS * (target.current.scale - cur) - DAMPING * vel.current.scale;
    vel.current.scale += acc * dt;
    currentScale.current = cur + vel.current.scale * dt;
    g.scale.setScalar(currentScale.current);

    // When spring settles near target, reset target to 1
    if (
      Math.abs(currentScale.current - target.current.scale) < 0.01 &&
      vel.current.scale < 0.5 &&
      target.current.scale !== 1
    ) {
      target.current.scale = 1;
      vel.current.scale = 0;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Outer wood ring — dark walnut */}
      <mesh geometry={outerRingGeo}>
        <meshStandardMaterial
          color="#3d2010"
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>

      {/* Wood inlay detail line — lighter wood */}
      <mesh geometry={inlayGeo}>
        <meshStandardMaterial
          color="#8b5e34"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* Inner felt fill — active color */}
      <mesh position={[0, 0, 0.001]} geometry={innerFillGeo}>
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 3: Type check and build**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/components/game/AnimatedRing.tsx
git commit -m "feat: beveled wood ring with spring-pop color transitions"
```

---

## Task 9: Rematch & Options Button Polish

**Files:**
- Modify: `web-react/src/components/game/RematchOverlay.tsx`
- Modify: `web-react/src/components/game/OptionsOverlay.tsx`
- Modify: `web-react/src/index.css`

- [ ] **Step 1: Read RematchOverlay.tsx**

```bash
cat web-react/src/components/game/RematchOverlay.tsx
```

- [ ] **Step 2: Apply felt-card button styles**

Read RematchOverlay. Update any buttons inside it to use these styles (add to `index.css`):

```css
/* Wood button for overlays */
.wood-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 8px;
  border: 1.5px solid rgba(201, 168, 76, 0.5);
  background: linear-gradient(145deg, #3d2010 0%, #2d1810 100%);
  color: #f5e6c8;
  font-family: Inter, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.wood-btn:hover {
  border-color: #c9a84c;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 0 12px rgba(201, 168, 76, 0.2);
}
.wood-btn:active {
  transform: translateY(0);
}
```

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/game/RematchOverlay.tsx \
  web-react/src/components/game/OptionsOverlay.tsx \
  web-react/src/index.css
git commit -m "feat: wood button style for overlay actions"
```

---

## Final Verification

- [ ] **Run type check**

```bash
cd web-react && npx tsc --noEmit
```

- [ ] **Run full build**

```bash
cd web-react && npm run build 2>&1 | tail -15
```

- [ ] **Run server tests**

```bash
cd server && npm test
```

---

## Self-Review Checklist

- [ ] All 7 spec sections have a corresponding task
- [ ] No placeholder text (TBD, TODO, "implement later")
- [ ] All file paths are exact
- [ ] Each task ends with a commit
- [ ] ColorPicker keeps same prop interface (no breaking changes to Game.tsx)
- [ ] Spring physics uses consistent stiffness/damping values
- [ ] All geometry disposals are handled via useEffect cleanup where needed
