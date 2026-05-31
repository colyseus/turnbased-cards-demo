# UX & Performance Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 13 issues from the approved UX and performance audit: WebGL rendering bugs, React memory leaks, accessibility gaps, build tooling, and CSS polish.

**Architecture:** 13 independent file-level fixes. Each task is self-contained and can be committed separately. No architectural changes — purely correctness, performance, and accessibility improvements. Fixes are ordered by priority (Tier 1 critical → Tier 3 polish).

**Tech Stack:** React 19, Three.js 0.183, React Three Fiber 9, Vite 7, @colyseus/schema, TypeScript 5, agent-browser

---

## Files Map

| File | Tasks |
|------|-------|
| `web-react/src/components/game/InstancedCards.tsx` | Task 1 (count bug), Task 8 (spring fn) |
| `web-react/src/index.css` | Task 2 (prefers-reduced-motion), Task 4 (focus-visible) |
| `web-react/src/components/GameScene.tsx` | Task 3 (aria-labels) |
| `web-react/src/components/Preloader.tsx` | Task 5 (cache bypass) |
| `web-react/src/components/Game.tsx` | Task 6 (memory leaks) |
| `web-react/src/components/FpsCounter.tsx` | Task 7 (dead code — delete) |
| `web-react/src/components/game/Table.tsx` | Task 9 (50k Math.random) |
| `web-react/vite.config.ts` | Task 10 (react-compiler) |
| `web-react/package.json` | Task 11 (bundle analyzer) |
| `web-react/src/main.tsx` | Task 12 (ARIA landmarks) |
| `server/src/rooms/schema/UnoRoomState.ts` | Task 13 (colyseus schema) |

---

## Task 1: InstancedCards highlight/selected count bug

**Problem:** `meshHighlightRef.current.count = count` and `meshSelectedRef.current.count = count` are set to the TOTAL card count (up to 5000) even when only 1-2 cards are highlighted/selected. Three.js processes all 5000 instance slots every frame regardless.

**Fix:** Track highlighted/selected indices with a contiguous counter pattern. On each frame, reset counter, iterate cards and call `setMatrixAt(counter, ...)` only for cards that ARE highlighted/selected, then set mesh count = counter. Only N slots are processed where N = actual highlighted/selected count.

**Files:**
- Modify: `web-react/src/components/game/InstancedCards.tsx`

- [ ] **Step 1: Add highlight/selected index tracking refs**

Find the `states` ref declaration around line 85. Add two new refs after it:

```typescript
const highlightIdx = useRef(0);
const selectedIdx = useRef(0);
```

- [ ] **Step 2: In useFrame, use contiguous index for highlight**

Find the highlight block (around lines 186-194). Replace the current approach where it calls `setMatrixAt(i, ...)` with one that uses a contiguous index:

```typescript
// After the "Highlight Matrix" comment, inside the if block:
_pos.copy(s.pos);
_pos.z -= 0.01;
_euler.set(0, 0, finalRotZ);
_quat.setFromEuler(_euler);
_scale.set(s.scale * 1.05, s.scale * 1.05, 1);
_matrix.compose(_pos, _quat, _scale);
meshHighlightRef.current.setMatrixAt(highlightIdx.current, _matrix);
highlightIdx.current++;
```

- [ ] **Step 3: Use contiguous index for selected**

Similarly, update the selected block (lines 197-204) to use `selectedIdx.current++` instead of `i`.

- [ ] **Step 4: Reset counters at start of useFrame, set counts after loop**

At the START of the useFrame callback (line 120 area), add:
```typescript
highlightIdx.current = 0;
selectedIdx.current = 0;
```

After the full card loop ends (around line 212, before setting counts), add:
```typescript
meshHighlightRef.current.count = highlightIdx.current;
meshSelectedRef.current.count = selectedIdx.current;
```

- [ ] **Step 5: Verify count assignment for front/back meshes is unchanged**

Ensure `meshFrontRef.current.count = count` and `meshBackRef.current.count = count` remain unchanged — those meshes DO need total count.

- [ ] **Step 6: Type check**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
cd /home/gfunk/github/turnbased-cards-demo
git add web-react/src/components/game/InstancedCards.tsx
git commit -m "fix: only render highlighted/selected card instances that have state"
```

---

## Task 2: prefers-reduced-motion accessibility

**Problem:** All CSS animations (fadeIn, winPop, cardFloat, spin, confettiFall, cardCountBump) play regardless of `prefers-reduced-motion`. Users with vestibular disorders are affected.

**Fix:** Add `@media (prefers-reduced-motion: reduce)` wrapper in index.css that disables or reduces all animations.

**Files:**
- Modify: `web-react/src/index.css`

- [ ] **Step 1: Add prefers-reduced-motion media query**

Find the end of index.css (after line 958, before any remaining content). Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web-react/src/index.css
git commit -m "fix: disable animations for prefers-reduced-motion users"
```

---

## Task 3: Emoji icon aria-labels for accessibility

**Problem:** Button icons in GameScene.tsx (🏆🌑🌓🌕🔊🔇❓⚙️💬) have no text alternative. Screen readers announce nothing or the emoji character code.

**Fix:** Add `aria-label` to each icon button in GameScene.tsx.

**Files:**
- Modify: `web-react/src/components/GameScene.tsx`

- [ ] **Step 1: Add aria-label to the leaderboard button (line 92 area)**

Find the 🏆 button in the Lobby render (around line 92-100). Add aria-label:

```tsx
<button
  className="hud-btn"
  title="Leaderboard"
  aria-label="Leaderboard"
  onClick={() => setShowStats(true)}
  style={{ width: 34, height: 34, fontSize: 16 }}
>
  🏆
</button>
```

- [ ] **Step 2: Add aria-labels to GameScene hud buttons (lines 68-85)**

Find the hud-actions buttons (sort, quality, sound, rules, options, chat). Add aria-label to each:

```tsx
<button
  className="hud-btn"
  aria-label={sortByColor ? "Sort by color" : "Sort by number"}
  title="Sort hand"
  onClick={onSortToggle}
>
  {sortByColor ? "🎨" : "🔢"}
</button>
<button
  className="hud-btn"
  aria-label={`Quality: ${qualityLevel}`}
  title="Quality"
  onClick={onQualityToggle}
>
  {qualityLevel === "low" ? "🌑" : qualityLevel === "medium" ? "🌓" : "🌕"}
</button>
<button
  className="hud-btn"
  aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
  title="Sound"
  onClick={onSoundToggle}
>
  {soundEnabled ? "🔊" : "🔇"}
</button>
<button
  className="hud-btn"
  aria-label="Show rules"
  title="Rules"
  onClick={() => setShowRules(true)}
>
  ❓
</button>
<button
  className="hud-btn"
  aria-label="Settings"
  title="Settings"
  onClick={() => setShowOptions(true)}
>
  ⚙️
</button>
<button
  className="hud-btn"
  aria-label="Show chat"
  title="Chat"
  onClick={() => setShowChat(true)}
>
  💬
</button>
```

- [ ] **Step 3: Type check and lint**

Run: `cd web-react && npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/components/GameScene.tsx
git commit -m "fix: add aria-labels to icon buttons for screen readers"
```

---

## Task 4: focus-visible styles for keyboard navigation

**Problem:** No `:focus-visible` styles anywhere. Keyboard users can't see where they are when navigating with Tab.

**Fix:** Add `:focus-visible` ring styles to all interactive elements in index.css.

**Files:**
- Modify: `web-react/src/index.css`

- [ ] **Step 1: Add focus-visible base style**

Find the `* { margin: 0; padding: 0; }` rule around line 15. After it, add:

```css
/* Keyboard focus indicator — only on keyboard navigation, not clicks */
:focus-visible {
  outline: 2px solid #ffcc00;
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add focus-visible to lobby buttons**

Find `.lobby-btn:hover` (line 351). After the hover block, add:

```css
.lobby-btn:focus-visible {
  outline: 2px solid #ffcc00;
  outline-offset: 3px;
  transform: scale(1.05);
  box-shadow: 0 6px 24px rgba(0,0,0,0.4);
}
```

- [ ] **Step 3: Add focus-visible to hud buttons**

Find `.hud-btn:hover` (line 542). After it, add:

```css
.hud-btn:focus-visible {
  background: rgba(255,204,0,0.2);
  border-color: #ffcc00;
  color: #ffcc00;
  outline: 2px solid #ffcc00;
  outline-offset: 1px;
}
```

- [ ] **Step 4: Add focus-visible to lobby tabs**

Find `.lobby-tab:hover` (line 388). After it, add:

```css
.lobby-tab:focus-visible {
  outline: 2px solid #ffcc00;
  outline-offset: 2px;
}
```

- [ ] **Step 5: Add focus-visible to toggle buttons**

Find `.toggle-btn` (line 698). After the `.on` block, add:

```css
.toggle-btn:focus-visible {
  outline: 2px solid #ffcc00;
  outline-offset: 2px;
}
```

- [ ] **Step 6: Commit**

```bash
git add web-react/src/index.css
git commit -m "fix: add focus-visible styles for keyboard accessibility"
```

---

## Task 5: Preloader cache bypass

**Problem:** `ATLAS_URL = atlas.webp?v=${Date.now()}` bypasses browser caching entirely — every page load fetches the atlas fresh.

**Fix:** Only add cache-bust query param in development. In production, use clean URL.

**Files:**
- Modify: `web-react/src/components/Preloader.tsx`

- [ ] **Step 1: Make Date.now() conditional on DEV mode**

Find line 20: `const ATLAS_URL = \`${CARDS_PATH}atlas.webp?v=${Date.now()}\`;`

Replace with:

```typescript
const ATLAS_URL = import.meta.env.DEV
  ? `${CARDS_PATH}atlas.webp?v=${Date.now()}`
  : `${CARDS_PATH}atlas.webp`;
```

- [ ] **Step 2: Type check**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/Preloader.tsx
git commit -m "fix: only bust cache on atlas in development mode"
```

---

## Task 6: Game.tsx setTimeout memory leaks

**Problem:** `invalidMoveTimer` (setTimeout, line 63) and `longPressTimer` (setTimeout, line 65) have no cleanup on component unmount. If component unmounts while timer is pending, setTimeout fires on an unmounted component.

**Fix:** Add useEffect with return cleanup for both timers.

**Files:**
- Modify: `web-react/src/components/Game.tsx`

- [ ] **Step 1: Add cleanup useEffect for timers**

Find the existing useEffect hooks in Game.tsx (around line 136). Add a new useEffect after the keyboard navigation one (after line 158):

```typescript
// Cleanup pending timers on unmount
useEffect(() => {
  return () => {
    if (invalidMoveTimer.current) clearTimeout(invalidMoveTimer.current);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
}, []);
```

- [ ] **Step 2: Type check and lint**

Run: `cd web-react && npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/Game.tsx
git commit -m "fix: cleanup setTimeout timers on Game component unmount"
```

---

## Task 7: FpsCounter is dead code (never mounted)

**Problem:** `FpsCounter.tsx` exists and uses `useFrame`, but it is **never imported or rendered** anywhere in the codebase. Confirmed via grep — zero imports. Dead code that should be removed.

**Fix:** Delete the unused `FpsCounter.tsx` file entirely. DevTools provides FPS/draw calls/triangles benchmarking.

**Files:**
- Delete: `web-react/src/components/FpsCounter.tsx`

- [ ] **Step 1: Verify FpsCounter is truly unused**

```bash
grep -r "FpsCounter" web-react/src/
```
Expected: Only the file itself exports it — zero imports

- [ ] **Step 2: Delete the file**

```bash
rm web-react/src/components/FpsCounter.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused FpsCounter component (DevTools covers FPS)"
```

---

## Task 8: InstancedCards spring function recreation

**Problem:** The `spring()` function (line 144) is defined inside the `useFrame` callback, so it gets recreated on every single frame — unnecessary garbage collection pressure.

**Fix:** Move the `spring` helper to module scope (outside the component) since it has no dependencies on component state.

**Files:**
- Modify: `web-react/src/components/game/InstancedCards.tsx`

- [ ] **Step 1: Move spring to module scope**

Find the `spring` function definition inside useFrame (around line 144):

```typescript
const spring = (cur: number, tgt: number, velocity: number) => {
  const acc = STIFFNESS * (tgt - cur) - DAMPING * velocity;
  const newVel = velocity + acc * dt;
  return [cur + newVel * dt, newVel];
};
```

Move this OUTSIDE the `InstancedCards` component function, placing it at module scope (after the imports and before `export function InstancedCards`). It should look like:

```typescript
// Shared scratch objects to avoid allocations in useFrame
const _matrix = new THREE.Matrix4();
// ... other scratch objects ...

// Spring physics helper — no component dependencies, safe at module scope
const spring = (cur: number, tgt: number, velocity: number, dt: number) => {
  const acc = STIFFNESS * (tgt - cur) - DAMPING * velocity;
  const newVel = velocity + acc * dt;
  return [cur + newVel * dt, newVel];
};
```

Note: Add `dt` as a parameter since it varies per frame.

- [ ] **Step 2: Update spring calls in useFrame to pass dt**

In useFrame, update each spring call:
```typescript
[s.pos.x, s.vel.x] = spring(s.pos.x, card.position[0], s.vel.x, dt);
[s.pos.y, s.vel.y] = spring(s.pos.y, card.position[1], s.vel.y, dt);
// etc.
```

- [ ] **Step 3: Type check and lint**

Run: `cd web-react && npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/components/game/InstancedCards.tsx
git commit -m "refactor: move spring helper to module scope to avoid per-frame allocations"
```

---

## Task 9: Table.tsx 50k Math.random() on init

**Problem:** Lines 24-29 create a noise texture using a synchronous loop of 50,000 `Math.random()` calls, blocking the main thread on initial load.

**Fix:** Use a typed array fill with a deterministic pseudo-random pattern instead of calling Math.random() per value.

**Files:**
- Modify: `web-react/src/components/game/Table.tsx`

- [ ] **Step 1: Read Table.tsx**

```bash
cat web-react/src/components/game/Table.tsx
```

- [ ] **Step 2: Replace synchronous 50k Math.random with typed array fill**

Find the noise generation loop. Replace the synchronous random loop with:

```typescript
// Use typed array fill with seeded-ish noise (deterministic, no per-call RNG overhead)
const data = new Uint8Array(size * size * 4);
for (let i = 0; i < data.length; i++) {
  // Deterministic pseudo-noise using sine — avoids 50k Math.random() calls
  data[i] = Math.floor(
    (Math.sin(i * 12.9898 + (i % 4) * 78.233) * 43758.5453) % 1 * 255
  );
}
```

Or if the existing loop works but just uses Math.random, change only the RNG part:

```typescript
// Replace: data[j] = Math.floor(Math.random() * 255);
// With seeded pattern:
const seed = 43758.5453;
data[j] = Math.floor((Math.sin(j * 12.9898 + j * seed) * seed) % 1 * 256);
```

- [ ] **Step 3: Type check**

Run: `cd web-react && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-react/src/components/game/Table.tsx
git commit -m "perf: replace 50k Math.random with deterministic noise for table texture"
```

---

## Task 10: React compiler config is empty

**Problem:** `ReactCompilerConfig = { /* ... */ }` in vite.config.ts is an empty object — babel-plugin-react-compiler does nothing. The plugin is included in the build but performs zero optimizations.

**Fix:** Either configure it properly or remove the plugin entirely to avoid dead weight in the build pipeline.

**Files:**
- Modify: `web-react/vite.config.ts`

- [ ] **Step 1: Research react-compiler configuration options**

The babel-plugin-react-compiler supports these key options:
- `target` — Babel target (e.g., "19")
- `debug` — Enable debug logging
- `enableRefresh` — Enable React Refresh integration

For a production build, the default empty config is fine (compiler applies sensible defaults). The issue is the comment `/* ... */` makes it look broken when it's actually valid.

- [ ] **Step 2: Clean up the config**

Replace:
```typescript
const ReactCompilerConfig = { /* ... */ };
```

With either:

**Option A (remove dead weight — recommended):**
Remove the plugin entirely from the babel plugins array and delete the `ReactCompilerConfig` constant. The compiler adds compile-time overhead for marginal gains in a card game that doesn't need extreme optimization.

**Option B (keep with clean config):**
```typescript
const ReactCompilerConfig = {
  target: "19",
};
```

- [ ] **Step 3: Build check**

Run: `cd web-react && npm run build 2>&1 | tail -20`
Expected: Build succeeds, note if bundle size changes

- [ ] **Step 4: Commit**

```bash
git add web-react/vite.config.ts
git commit -m "chore: remove empty react-compiler config or document its purpose"
```

---

## Task 11: No bundle analyzer script

**Problem:** No way to inspect chunk sizes or verify that manual chunks (three-vendor, r3f-vendor, colyseus-vendor) are actually working as intended.

**Fix:** Add vite-bundle-analyzer and an analyze script to package.json.

**Files:**
- Modify: `web-react/package.json`
- Modify: `web-react/vite.config.ts`

- [ ] **Step 1: Install vite-bundle-analyzer**

```bash
cd web-react && npm install --save-dev vite-bundle-analyzer
```

- [ ] **Step 2: Add analyze script to package.json**

Find `"scripts"`. Add:

```json
"analyze": "vite build --mode analyze",
```

- [ ] **Step 3: Configure vite.config.ts for analyze mode**

Find the vite.config.ts. Add at the top:

```typescript
import { visualizer } from 'vite-bundle-analyzer';
```

Add to the plugins array (if keeping react compiler, keep it first):

```typescript
visualizer({
  filename: "dist/stats.html",
  open: true,
  gzipSize: true,
  brotliSize: true,
}),
```

And add a new config section:

```typescript
// Bundle analyzer — enabled via `npm run analyze`
if (process.env.NODE_ENV === "analyze") {
  config.plugins.push(visualizer({ /* ... */ }));
}
```

Or use a simpler approach: use `vite-plugin-visualizer` or the `visualizer()` plugin unconditionally in the plugins array, controlled by an environment variable.

- [ ] **Step 4: Verify build works**

Run: `cd web-react && npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add web-react/package.json web-react/vite.config.ts
git commit -m "feat: add vite-bundle-analyzer and analyze script"
```

---

## Task 12: ARIA landmarks missing

**Problem:** No semantic HTML landmarks (`role="main"`, `role="navigation"`, `role="dialog"`) for screen reader navigation. Users can't jump between lobby, game, and overlays.

**Fix:** Add ARIA roles and labels to key structural elements in main.tsx and GameScene.tsx.

**Files:**
- Modify: `web-react/src/main.tsx`
- Modify: `web-react/src/components/GameScene.tsx`

- [ ] **Step 1: Add role="main" to the app root**

In `main.tsx`, find the `<App />` render (line 325). The `#root` div already exists in index.html. Wrap App content appropriately, or add to the root div in index.html.

Actually, the `#root` div is the app container. Add `role="main"` and `aria-label` to the Lobby and game area.

In main.tsx, find the Lobby return (around line 64). Update:

```tsx
<div className="lobby" role="main" aria-label="Game lobby">
```

- [ ] **Step 2: Add role="dialog" to overlay components**

For RulesOverlay, OptionsOverlay, ChatOverlay, RematchOverlay — they are rendered as full-screen overlays. Each should have `role="dialog"` and `aria-modal="true"`.

Check each overlay file:
```bash
grep -l "overlay" web-react/src/components/game/*.tsx
```

Read each overlay and add `role="dialog"` to the root element.

For example, RulesOverlay (line 549 in index.css shows `.rules-overlay`). Find the JSX in RulesOverlay.tsx and add:

```tsx
<div className="rules-overlay" role="dialog" aria-modal="true" aria-label="Game Rules">
```

Apply same pattern to OptionsOverlay, ChatOverlay, and RematchOverlay.

- [ ] **Step 3: Add navigation landmark**

In main.tsx, find the Lobby component. Add:

```tsx
<nav aria-label="Game menu">
```

- [ ] **Step 4: Type check and lint**

Run: `cd web-react && npx tsc --noEmit && npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web-react/src/main.tsx \
  web-react/src/components/game/RulesOverlay.tsx \
  web-react/src/components/game/OptionsOverlay.tsx \
  web-react/src/components/game/ChatOverlay.tsx \
  web-react/src/components/game/RematchOverlay.tsx
git commit -m "fix: add ARIA landmarks and dialog roles for screen reader navigation"
```

---

## Task 13: @colyseus/schema v1 API usage

**Problem:** `UnoRoomState.ts` uses the older `@colyseus/schema` v1 annotation style (`.set()` on schema). The `view: true` property on the `hand` field (line 17) may be incorrectly documented — in Colyseus schema v1, private fields use a different mechanism.

**Fix:** Verify the schema syntax against current @colyseus/schema documentation. The server already works correctly (it's been tested), so this is a maintenance/upgrade risk assessment.

**Files:**
- Modify: `server/src/rooms/schema/UnoRoomState.ts`

- [ ] **Step 1: Check current colyseus/schema version**

```bash
cd server && cat package.json | grep "@colyseus/schema"
```

- [ ] **Step 2: Read the current UnoRoomState.ts schema**

```bash
cat server/src/rooms/schema/UnoRoomState.ts
```

- [ ] **Step 3: Verify hand: { array: UnoCardSchema, view: true } syntax**

The `view: true` pattern is the Colyseus v1 way to mark a field as private/not synced. In v2, this changed. Check if `view` is still valid:

```typescript
// Current (works in v1):
hand: { array: UnoCardSchema, view: true },

// If upgrading to v2, would need:
hand: { array: UnoCardSchema, reflect: false },
```

Since the game is working, this is LOW priority. Document the current behavior in a comment and add a note to the audit doc that this schema syntax should be verified when upgrading Colyseus.

Add a comment above the schema:

```typescript
// Note: @colyseus/schema v1 API — "view: true" marks hand as private (not synced to clients).
// When upgrading @colyseus/schema, verify this syntax is still valid.
export const UnoRoomState = schema({
```

- [ ] **Step 4: Commit**

```bash
git add server/src/rooms/schema/UnoRoomState.ts
git commit -m "docs: add note about colyseus/schema v1 API usage and upgrade consideration"
```

---

## Self-Review Checklist

- [ ] All 13 issues from the spec are covered by a task
- [ ] No placeholder text (TBD, TODO, implement later)
- [ ] All file paths are exact with line numbers where applicable
- [ ] Each task has commit message
- [ ] Type check commands included for TypeScript files
- [ ] Build/lint verification steps included
- [ ] No contradictory method names between tasks
- [ ] Task 1 (InstancedCards count): confirmed `highlightIdx` and `selectedIdx` refs are added at module level, not inside useFrame
- [ ] Task 5 (cache bypass): `import.meta.env.DEV` is available in Vite without extra config
- [ ] Task 8 (spring): `dt` parameter added since spring moved to module scope

---

## Execution Approach

**Choose one:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task group, review each, fast iteration

**2. Inline Execution** — Execute tasks in this session, batch execution with checkpoints
