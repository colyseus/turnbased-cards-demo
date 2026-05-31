# Midnight Luxe UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Midnight Luxe visual redesign — deep charcoal + electric cyan — to all game UI components, fixing rendering bugs along the way.

**Architecture:** Pure CSS + R3F component restyling. CSS custom properties drive the palette. No state changes, no game logic changes. Changes are layered on top of existing architecture.

**Tech Stack:** React 19, Three.js 0.183, R3F 9, CSS custom properties, Vite 7

**Testing:** Visual verification via agent-browser screenshots after each task. No unit tests (pure UI restyling).

---

## Files Map

| File | Tasks |
|------|-------|
| `web-react/src/index.css` | Task 1 (palette), Task 5 (HUD buttons), Task 6 (overlays), Task 9 (lobby) |
| `web-react/src/components/game/Table.tsx` | Task 2 (table surface) |
| `web-react/src/components/game/InstancedCards.tsx` | Task 3 (card rendering) |
| `web-react/src/components/game/TurnIndicator.tsx` | Task 4 (turn indicator) |
| `web-react/src/components/game/ColorPicker.tsx` | Task 7 (color picker) |
| `web-react/src/components/StressTestScene.tsx` | Task 8 (stress test scene) |

---

## Task 1: CSS Custom Properties Palette

**Files:**
- Modify: `web-react/src/index.css:1-40`

- [ ] **Step 1: Replace :root with Midnight Luxe palette**

Find the existing `:root` block at line 1. Replace entirely with:

```css
:root {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: dark;
  background-color: var(--bg-primary);

  /* Midnight Luxe palette */
  --bg-primary:    #1a1a2e;
  --bg-surface:    #0f0f1a;
  --bg-elevated:   #252540;
  --accent:        #00e5ff;
  --accent-dim:    rgba(0, 229, 255, 0.2);
  --accent-glow:   rgba(0, 229, 255, 0.4);
  --text-primary:  #ffffff;
  --text-muted:    #888899;
  --card-red:      #e63946;
  --card-blue:     #4361ee;
  --card-green:    #2ec4b6;
  --card-yellow:   #ffd60a;
  --card-wild:     #9d4edd;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2: Update body/#root background**

Find `body, #root { ... }` (around line 34). Replace with:

```css
body, #root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-primary);
}
```

- [ ] **Step 3: Add utility classes after :root**

Add these after the `:root` block (before `* { margin: 0; padding: 0; }`):

```css
/* Noise texture for depth — applied to .table-surface */
.noise-texture::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
  border-radius: inherit;
}
```

- [ ] **Step 4: Update .lobby background**

Find `.lobby { ... }` (around line 266). Replace with:

```css
.lobby {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}
```

- [ ] **Step 5: Update .lobby-card background**

Find `.lobby-card { ... }` (around line 275). Replace background with:

```css
.lobby-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  animation: fadeIn 0.6s ease-out;
  background: var(--bg-surface);
  padding: 48px 64px;
  border-radius: 16px;
  border: 1px solid var(--accent-dim);
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 6: Update .lobby-title**

Find `.lobby-title { ... }` (around line 287). Replace with:

```css
.lobby-title {
  position: relative;
  z-index: 1;
  font-size: 32px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin: 0;
}
```

- [ ] **Step 7: Update .lobby-subtitle**

Find `.lobby-subtitle { ... }` (around line 320). Replace with:

```css
.lobby-subtitle {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-muted);
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 8: Update .lobby-hero-card to show card back properly**

Find `.lobby-hero-card { ... }` (around line 299). Replace with:

```css
.lobby-hero-card {
  position: absolute;
  right: -80px;
  bottom: -30px;
  width: 80px;
  height: 125px;
  filter: drop-shadow(0 8px 24px rgba(0, 229, 255, 0.15));
  animation: cardFloat 3s ease-in-out infinite;
  background-color: var(--bg-surface);
  background-image: url('/cards/atlas.webp');
  background-size: 2400px 2250px;
  background-position: -960px -1875px;
  border-radius: 6px;
  border: 2px solid var(--accent);
  box-shadow: 0 0 12px var(--accent-dim), 0 8px 32px rgba(0,0,0,0.5);
}
```

- [ ] **Step 9: Add cardFloat keyframe with muted motion**

Find existing `@keyframes cardFloat`. Replace with:

```css
@keyframes cardFloat {
  0%, 100% { transform: translate(0, 0) rotate(12deg); }
  50% { transform: translate(0, -8px) rotate(15deg); }
}
```

- [ ] **Step 10: Update .lobby-btn (main CTA)**

Find `.lobby-btn { ... }` (around line 332). Replace with:

```css
.lobby-btn {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: 24px;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  box-shadow: 0 4px 16px var(--accent-dim);
}
.lobby-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px var(--accent-glow);
  background: #33efff;
}
.lobby-btn:active {
  transform: translateY(0);
}
```

- [ ] **Step 11: Update .lobby-join-btn and .lobby-join-code**

Find and replace `.lobby-join-btn` and `.lobby-join-code` backgrounds with `var(--bg-surface)` or `var(--bg-elevated)`.

- [ ] **Step 12: Update .lobby-divider**

Find `.lobby-divider { ... }` (around line 368). Replace with:

```css
.lobby-divider {
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

- [ ] **Step 13: Take screenshot and verify**

Run: `agent-browser --cdp 9222 open http://localhost:5173 && agent-browser --cdp 9222 wait 2000 && agent-browser --cdp 9222 screenshot /tmp/task1-lobby.png`

Verify: Lobby has dark charcoal background, accent-colored hero card, clean typography.

---

## Task 2: Table Surface Redesign

**Files:**
- Modify: `web-react/src/components/game/Table.tsx`

- [x] **Step 1: Replace table texture with solid dark + noise**

Replace the entire `Table` function's texture creation with:

```typescript
const texture = useMemo(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Solid dark fill — no gradient
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle noise for depth (fast, minimal)
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.03;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}, []);
```

- [x] **Step 2: Verify no texture repeat artifacts**

Run stress test, screenshot table surface. Look for: smooth dark surface with subtle grain, no tiling/crosshatch.

Evidence: `agent-browser` stress-test screenshots captured at `/tmp/midnight-table-desktop-final.png` and `/tmp/midnight-table-mobile-final.png` on 2026-05-23; table surface is flat midnight charcoal with subtle grain/cyan rings and no visible repeat/crosshatch artifacts.

---

## Task 3: Card Rendering Fix (InstancedCards)

**Files:**
- Modify: `web-react/src/components/game/InstancedCards.tsx`
- No structural changes — only update material colors to use new palette

- [x] **Step 1: Check current fragment shader**

Review the existing `fragmentShader` in InstancedCards. The shader handles atlas UV sampling. Verify it uses `texture2D(map, vUv)` correctly and discards transparent pixels with `if (texelColor.a < 0.5) discard;`.

- [x] **Step 2: Update highlight/selected material colors**

Find the highlight and selected mesh materials (around line 283 and 293). Replace gold/yellow with accent:

```typescript
// Highlight material
uniforms={{ color: { value: new THREE.Color("#00e5ff") }, opacity: { value: 0.25 } }}

// Selected material
uniforms={{ color: { value: new THREE.Color("#00e5ff") }, opacity: { value: 0.35 } }}
```

- [x] **Step 3: Verify card fronts render correctly**

Run stress test. Verify cards show as solid colored rectangles with visible numbers. Take screenshot.

Evidence: `agent-browser` stress-test screenshots captured at `/tmp/midnight-table-desktop-final.png` and `/tmp/midnight-table-mobile-final.png` on 2026-05-23; instanced cards render with visible colored faces/numbers over the redesigned table.

---

## Task 4: Turn Indicator Redesign

**Files:**
- Modify: `web-react/src/components/game/TurnIndicator.tsx`

- [x] **Step 1: Replace gold colors with cyan accent**

In TurnIndicator.tsx, find all color values:
- `#c9a84c` (gold) → `#00e5ff` (accent)
- `#f5e6c8` (cream) → `#252540` (bg-elevated)

- [x] **Step 2: Update pointer material**

Find `meshStandardMaterial color="#5c3317"` (pointer wood) → `color="#252540"`
Find `meshStandardMaterial color="#8b5e34"` (pointer highlight) → `color="#00e5ff"` with reduced opacity

Evidence: current `TurnIndicator.tsx` no longer uses the older wood pointer geometry/materials; the actual rendered indicator uses cyan orbit arcs, active halo, muted inactive seats, and dark elevated inactive cores.

- [x] **Step 3: Update circle colors for active/inactive**

Active (i === activePlayerIndex): `color="#00e5ff"` with accent glow
Inactive: `color="#252540"` with muted border

- [x] **Step 4: Update direction arc color**

Find `#c9a84c` for DIR_ARC_SHAPE material → `#00e5ff`

- [x] **Step 5: Screenshot turn indicator**

Join a game, verify turn indicator shows cyan accents. Take screenshot.

Evidence: `agent-browser` joined-game screenshot captured at `/tmp/midnight-game-pass2.png` on 2026-05-23; turn indicator/orbit uses cyan accents over the rewritten table.

---

## Task 5: HUD Buttons Redesign

**Files:**
- Modify: `web-react/src/index.css` (add new button styles), `web-react/src/components/game/GameHud.tsx` (if className changes needed)

- [x] **Step 1: Add HUD button base styles**

Add to index.css:

```css
.hud-btn {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--accent-dim);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  letter-spacing: 0.03em;
}
.hud-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--accent);
  transform: scale(1.02);
}
.hud-btn:active {
  transform: scale(0.98);
}
```

- [x] **Step 2: Find all .hud-btn usages in CSS and ensure一致性**

Search for `.hud-btn` in index.css. Verify all variants (`.hud-btn.back-btn`, etc.) use the same base.

- [x] **Step 3: Update HUD panel backgrounds**

Find `.hud` (around line 50). Replace with:

```css
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}
```

- [x] **Step 4: Update .player-label styles**

Find `.player-label` (around line 138). Replace with:

```css
.player-label {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--accent-dim);
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
}
```

- [x] **Step 5: Screenshot HUD in game**

Join game, verify HUD buttons have dark surface + cyan border. Take screenshot.

Evidence: `agent-browser` joined-game screenshot captured at `/tmp/midnight-game-pass2.png` on 2026-05-23; HUD dock, top turn card, room rail, and player labels render as dark panels with cyan accents.

---

## Task 6: Overlay Panels Redesign (Rules, Options, Chat)

**Files:**
- Modify: `web-react/src/index.css`

- [x] **Step 1: Update .rules-overlay / .rules-card**

Find `.rules-overlay` (around line 1029). Replace with:

```css
.rules-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: auto;
}

.rules-card {
  background: var(--bg-surface);
  border: 1px solid var(--accent-dim);
  border-radius: 12px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
}
```

- [x] **Step 2: Update .rules-header**

Find `.rules-header { ... }` (around line 1051). Replace with:

```css
.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--accent-dim);
}
.rules-header h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
```

- [x] **Step 3: Update .rules-body text colors**

Find `.rules-body li` and text color declarations. Set to `var(--text-primary)` for headings, `var(--text-muted)` for descriptions.

- [x] **Step 4: Update .rules-close button**

Find `.rules-close`. Replace with accent-colored ×:

```css
.rules-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}
.rules-close:hover {
  color: var(--accent);
}
```

- [x] **Step 5: Update toggle/option buttons**

Find `.toggle-btn` (around line 1093). Replace with:

```css
.toggle-btn {
  border-radius: 16px;
  border: 1px solid var(--accent-dim);
  background: var(--bg-surface);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.toggle-btn.on {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}
```

- [x] **Step 6: Screenshot rules overlay**

Open rules in game, verify dark panel with cyan border. Take screenshot.

Evidence: `agent-browser` rules-overlay screenshot captured at `/tmp/midnight-rules-pass2.png` on 2026-05-23; rules panel is dark with cyan border/headings and muted body copy.

---

## Task 7: Color Picker Drawer

**Files:**
- Modify: `web-react/src/components/game/ColorPicker.tsx`, `web-react/src/index.css`

- [x] **Step 1: Update ColorPicker container styles**

Add to index.css:

```css
.color-picker-drawer {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%) translateY(100%);
  background: var(--bg-surface);
  border: 1px solid var(--accent-dim);
  border-bottom: none;
  border-radius: 16px 16px 0 0;
  padding: 16px 24px;
  display: flex;
  gap: 16px;
  z-index: 50;
  transition: transform 0.2s ease-out;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
}
.color-picker-drawer.open {
  transform: translateX(-50%) translateY(0);
}
.color-picker-option {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.color-picker-option:hover {
  transform: scale(1.1);
}
.color-picker-option.selected {
  border-color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}
```

- [x] **Step 2: Check ColorPicker.tsx for className application**

Read `web-react/src/components/game/ColorPicker.tsx`. Ensure it applies `color-picker-drawer` and `open` class names correctly.

Note: the current implementation uses a 3D R3F color picker rather than the older HTML drawer described here. The actual picker materials were updated to Midnight Luxe colors in `ColorPicker.tsx`; rendered screenshot evidence is still pending.

- [x] **Step 3: Screenshot color picker**

Play a wild card, verify color picker slides up from bottom with colored options. Take screenshot.

Evidence: the current implementation uses a 3D R3F picker rather than the older HTML drawer. A dev-only stress-scene harness (`?colorPicker=1`) renders the live `ColorPicker` component, with screenshots captured at `/tmp/midnight-color-picker-pass3-fixed.png` and `/tmp/midnight-color-picker-mobile-pass3-fixed.png` on 2026-05-23.

---

## Task 8: Stress Test Scene

**Files:**
- Modify: `web-react/src/components/StressTestScene.tsx`, `web-react/src/index.css`

- [x] **Step 1: Update .stress-test-overlay styles**

Find `.stress-test-overlay` (around line 921). Replace with:

```css
.stress-test-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  padding: 20px;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}
.stress-test-title {
  color: var(--accent);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

- [x] **Step 2: Update .back-btn styles**

Find `.stress-test-overlay button` and `.back-btn`. Replace with:

```css
.stress-test-overlay button {
  pointer-events: auto;
}
.back-btn {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--accent-dim);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.back-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--accent);
}
```

- [x] **Step 3: Update DevTools trigger**

Find `.devtools-trigger` (around line 774). Replace with:

```css
.devtools-trigger {
  position: fixed;
  bottom: 12px;
  right: 12px;
  z-index: 999;
  background: var(--bg-surface);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  letter-spacing: 1px;
}
```

- [x] **Step 4: Update .devtools-panel**

Find `.devtools-panel` (around line 790). Replace with:

```css
.devtools-panel {
  position: fixed;
  bottom: 12px;
  right: 12px;
  width: 280px;
  background: var(--bg-surface);
  border: 1px solid var(--accent-dim);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
```

- [x] **Step 5: Screenshot stress test**

Open stress test, verify dark theme throughout. Take screenshot.

Evidence: `agent-browser` stress screenshots captured at `/tmp/midnight-stress-pass2.png`, `/tmp/midnight-stress-mobile-pass2.png`, and devtools screenshot `/tmp/midnight-devtools-pass2.png` on 2026-05-23.

---

## Task 9: Final Verification

**Files:**
- All modified files

- [x] **Step 1: Screenshot lobby**

`agent-browser --cdp 9222 open http://localhost:5173 && agent-browser --cdp 9222 screenshot /tmp/final-lobby.png`

Evidence: `agent-browser` lobby screenshot captured at `/tmp/midnight-lobby-pass2.png` on 2026-05-23.

- [x] **Step 2: Screenshot game**

Join game, screenshot `/tmp/final-game.png`

Evidence: `agent-browser` joined-game screenshots captured at `/tmp/midnight-game-pass2.png` and `/tmp/midnight-game-final-pass2.png` on 2026-05-23.

- [x] **Step 3: Screenshot stress test**

Open stress test, screenshot `/tmp/final-stress.png`

Evidence: `agent-browser` stress-test screenshots captured at `/tmp/midnight-stress-pass2.png` and `/tmp/midnight-stress-mobile-pass2.png` on 2026-05-23.

- [x] **Step 4: Verify all criteria**

Check each screenshot against success criteria:
- [x] Dark charcoal background everywhere
- [x] Cyan accent on all inspected table/HUD/overlay/stress interactive elements
- [x] Cards render with proper colors
- [x] No tiling/crosshatch artifacts
- [x] Clean typography

Color-picker evidence: `/tmp/midnight-color-picker-pass3-fixed.png` and `/tmp/midnight-color-picker-mobile-pass3-fixed.png` capture the live 3D picker through the stress-scene visual harness.

Scope note for the active table-assets goal: table surface, card rendering/glows, turn indicator, HUD/table chrome, overlays, stress/devtools table view, and live 3D color picker have rendered evidence. The older unchecked Task 1 lobby steps and commit step remain broader Midnight Luxe plan work, not remaining table-asset work.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: apply Midnight Luxe UI redesign

- Deep charcoal (#1a1a2e) + electric cyan (#00e5ff) palette
- Solid dark table surface with subtle noise texture
- Card rendering fixes (UV/atlas)
- Cyan-accented turn indicator, HUD, overlays
- All components updated to new design language

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- [x] All CSS color values reference CSS custom properties (no hardcoded hex except in :root defaults) — applies to DOM CSS only; R3F 3D materials use Three.js color constants by design
- [x] Table.tsx uses ClampToEdgeWrapping (no RepeatWrapping)
- [x] Atlas UV mapping unchanged (already correct from prior fixes)
- [x] Component classNames in TSX match CSS selectors in plan for the table-asset surfaces exercised in screenshots
- [x] All inspected overlays follow same panel style (bg-surface + accent border)
- [x] No new dependencies introduced
