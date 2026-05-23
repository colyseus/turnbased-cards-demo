# GPU Stress Test Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move stress test orbital animation from CPU spring physics to GPU vertex shader, using a typed `instanceIndex` InstancedBufferAttribute. Target: 60 FPS in real browser (vs ~10 FPS CPU-bound).

**Architecture:** Add a typed `instanceIndex` attribute (`Float32Array` of sequential integers 0..n-1) to the InstancedMesh geometry. Create a GPU vertex shader that reads `instanceIndex` and `uTime` to compute orbital positions entirely on the GPU. Gate the fast GPU path behind a `needsSpring` check — stress test cards (`shake=false, highlight=false, selected=false`) use GPU path; game cards with interaction use CPU spring path.

**Tech Stack:** React Three Fiber, Three.js `InstancedMesh`, `InstancedBufferAttribute`, GLSL `rawShaderMaterial`

---

## File Map

| File | Role |
|------|------|
| `web-react/src/components/game/InstancedCards.tsx` | Add `instanceIndex` attribute + GPU vertex shader + fast-path gating |
| `web-react/src/components/StressTestScene.tsx` | No changes needed — already passes `shake=false, highlight=false, selected=false` |

---

## Task 1: Add instanceIndex InstancedBufferAttribute

**Files:**
- Modify: `web-react/src/components/game/InstancedCards.tsx:117-120`

- [ ] **Step 1: Add instanceIndex Float32Array alongside uvCardAttr**

Find line 117–120:
```tsx
// UV Offset & Scale Attributes (vec4: u, v, w, h)
const uvCardAttr = useMemo(() => new Float32Array(MAX_CARDS * 4), []);
```

Add directly after:
```tsx
// Instance index — used by GPU shader to compute orbital animation deterministically
const instanceIndexAttr = useMemo(() => {
  const arr = new Float32Array(MAX_CARDS);
  for (let i = 0; i < MAX_CARDS; i++) arr[i] = i;
  return arr;
}, []);
```

- [ ] **Step 2: Wire instanceIndexAttr into the instancedMesh geometry**

Find the `<instancedMesh ref={meshCardRef}` block (lines 224–244). Inside the `<planeGeometry>`, after the `</instancedBufferAttribute>` for `uvOffsetScale`, add:

```tsx
<instancedBufferAttribute
  args={[instanceIndexAttr, 1]}
  name="instanceIndex"
  attach="attributes-instanceIndex"
  count={MAX_CARDS}
  array={instanceIndexAttr}
  itemSize={1}
/>
```

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/game/InstancedCards.tsx
git commit -m "feat(InstancedCards): add instanceIndex InstancedBufferAttribute"
```

---

## Task 2: Create GPU vertex shader with orbital animation

**Files:**
- Modify: `web-react/src/components/game/InstancedCards.tsx:28-46`

- [ ] **Step 1: Replace the vertex shader string with GPU-aware shader**

Find the `const vertexShader = \`...\` ` block (lines 28–46). Replace it with:

```tsx
const vertexShader = /* glsl */ `
  precision highp float;

  attribute vec3 position;
  attribute vec2 uv;
  attribute mat4 instanceMatrix;
  attribute vec4 uvOffsetScale;
  attribute float instanceIndex;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uCardCount;
  uniform bool uUseGpuAnimation;

  varying vec2 vUv;

  void main() {
    vUv = vec2(uv.x, 1.0 - uv.y) * uvOffsetScale.zw + uvOffsetScale.xy;

    // Extract base position from instanceMatrix (translation column)
    vec3 basePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

    vec3 finalPos = basePos;

    // GPU-driven orbital animation: deterministic from instanceIndex + uTime
    // No spring physics — runs entirely in vertex shader
    if (uUseGpuAnimation) {
      float fi = instanceIndex;
      float total = max(uCardCount, 1.0);
      float angle = (fi / total) * 6.28318530718 + uTime * 0.2;
      float r = 3.0 + sin(uTime * 0.5 + fi * 0.1) * 2.0;
      float zOff = sin(uTime + fi * 0.05) * 0.5;
      float finalAngle = angle + 1.57079632679; // PI/2

      finalPos = vec3(
        cos(angle) * r,
        sin(angle) * r,
        zOff
      );
    }

    // Compose: T(finalPos) * Rz(animAngle) * S(scale=0.5)
    float animAngle = uUseGpuAnimation ? (angle + 1.57079632679) : 0.0;
    float ca = cos(animAngle);
    float sa = sin(animAngle);
    mat3 rotZ = mat3(ca, -sa, 0.0, sa, ca, 0.0, 0.0, 0.0, 1.0);
    mat3 scaleMat = mat3(0.5, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 1.0);
    mat3 rotScale = rotZ * scaleMat;
    vec4 worldPos = modelMatrix * vec4(vec3(instanceMatrix[3]) + rotScale * position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;
```

Note: The `if (uUseGpuAnimation)` block computes final positions. For the non-GPU path, `finalPos = basePos` is used as the instanceMatrix translation, so the CPU-side matrices set via `setMatrixAt` are still respected.

- [ ] **Step 2: Update uniforms object to include new GPU uniforms**

Find line 120:
```tsx
const uniforms = { map: { value: atlas } };
```

Replace with:
```tsx
const uniforms = useMemo(() => ({
  map: { value: atlas },
  uTime: { value: 0 },
  uCardCount: { value: 0 },
  uUseGpuAnimation: { value: false },
}), [atlas]);
```

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/game/InstancedCards.tsx
git commit -m "feat(InstancedCards): add GPU orbital animation vertex shader"
```

---

## Task 3: Gate GPU vs CPU path using needsSpring

**Files:**
- Modify: `web-react/src/components/game/InstancedCards.tsx:107-115` (useEffect), `122-222` (useFrame), and `226-244` (JSX mesh)

- [ ] **Step 1: Move needsSpring ref into component (was at module scope in broken attempt)**

Find the `const states = useRef...` block around line 91. Add `needsSpring` ref right after `selectedIdx`:

```tsx
const selectedIdx = useRef(0);
const needsSpring = useRef(false);
```

- [ ] **Step 2: Update useEffect to set needsSpring AND initialize GPU uniforms**

Find the useEffect at line 107–115:
```tsx
useEffect(() => {
  const cardIds = new Set(cards.map((c) => c.id));
  for (const id of states.current.keys()) {
    if (!cardIds.has(id)) {
      states.current.delete(id);
    }
  }
}, [cards]);
```

Replace with:
```tsx
useEffect(() => {
  const cardIds = new Set(cards.map((c) => c.id));
  for (const id of states.current.keys()) {
    if (!cardIds.has(id)) {
      states.current.delete(id);
    }
  }

  // Detect whether any card needs spring physics
  needsSpring.current = cards.some((c) => c.shake || c.highlight || c.selected);

  // Update GPU uniforms
  uniforms.uCardCount.value = cards.length;
  uniforms.uUseGpuAnimation.value = !needsSpring.current;
}, [cards]);
```

- [ ] **Step 3: Update useFrame to update uTime every frame and gate CPU path**

Find the `useFrame` callback starting at line 122. Replace the entire `useFrame` callback body (lines 122–222) with:

```tsx
useFrame((_, delta) => {
  if (!meshCardRef.current) return;

  // Always update time — cheap single float assignment
  uniforms.uTime.value += Math.min(delta, 0.05);

  // FAST PATH: pure animated cards — GPU handles all position animation.
  // CPU only sets count once; matrices already set by initCards.
  if (!needsSpring.current) {
    meshCardRef.current.count = cards.length;
    return;
  }

  // SPRING PATH: game cards with shake/highlight/selected
  const dt = Math.min(delta, 0.05);
  const count = cards.length;

  highlightIdx.current = 0;
  selectedIdx.current = 0;

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
    if (card.shake) {
      const t = performance.now() / 1000;
      finalRotZ += Math.sin(t * 22) * 0.06 + Math.sin(t * 37) * 0.03;
    }

    _pos.copy(s.pos);
    _euler.set(0, 0, finalRotZ);
    _quat.setFromEuler(_euler);
    _scale.setScalar(s.scale);
    _matrix.compose(_pos, _quat, _scale);
    meshCardRef.current.setMatrixAt(i, _matrix);

    if (card.highlight) {
      _pos.copy(s.pos);
      _pos.z -= 0.01;
      _euler.set(0, 0, finalRotZ);
      _quat.setFromEuler(_euler);
      _scale.set(s.scale * 1.05, s.scale * 1.05, 1);
      _matrix.compose(_pos, _quat, _scale);
      meshHighlightRef.current.setMatrixAt(highlightIdx.current, _matrix);
      highlightIdx.current++;
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

  meshCardRef.current.instanceMatrix.needsUpdate = true;
  meshHighlightRef.current.instanceMatrix.needsUpdate = true;
  meshSelectedRef.current.instanceMatrix.needsUpdate = true;

  if (meshCardRef.current.geometry.attributes.uvOffsetScale) {
    (meshCardRef.current.geometry.attributes.uvOffsetScale as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
});
```

- [ ] **Step 4: Fix uvCardAttr initialization — use useMemo with cards.length dependency**

Find the `uvCardAttr` useMemo and the useEffect. The `useEffect` needs to also initialize `meshCardRef.current.count` and UVs for all cards on mount/change, since the CPU loop is skipped in GPU path.

The current `useEffect` at line 107 only cleans up states. We need a separate `useEffect` (or expand the existing one) to initialize instance matrices and UVs:

```tsx
useEffect(() => {
  if (!meshCardRef.current) return;
  const count = Math.min(cards.length, MAX_CARDS);
  needsSpring.current = cards.some((c) => c.shake || c.highlight || c.selected);
  uniforms.uCardCount.value = count;
  uniforms.uUseGpuAnimation.value = !needsSpring.current;

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
  meshCardRef.current.instanceMatrix.needsUpdate = true;
  if (meshCardRef.current.geometry.attributes.uvOffsetScale) {
    (meshCardRef.current.geometry.attributes.uvOffsetScale as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}, [cards, getUVs]);
```

Remove the old `states.current.delete` useEffect (or merge it into the above).

- [ ] **Step 5: TypeScript check**

Run: `cd web-react && npx tsc --noEmit 2>&1`
Expected: clean compile, no errors

- [ ] **Step 6: Commit**

```bash
git add web-react/src/components/game/InstancedCards.tsx
git commit -m "feat(InstancedCards): gate GPU vs CPU spring path with needsSpring"
```

---

## Task 4: Verify stress test renders and FPS improves

**Files:**
- None (verification only)

- [ ] **Step 1: Start dev server and open stress test**

```bash
cd web-react && npm run dev
# Navigate to http://localhost:5173
# Click STRESS TEST button
# Open DEBUG panel
```

Expected: Cards visible, animating in ring pattern. FPS ~10 (headless software renderer — same as before for now)

- [ ] **Step 2: Open in real Chrome with GPU**

If possible, open `http://localhost:5173` in a real Chrome browser with GPU acceleration enabled. Check FPS with the DEBUG panel open.

Expected: FPS should be significantly higher (~30-60) in real browser since GPU handles the animation.

- [ ] **Step 3: Run benchmark export**

Click "Start Benchmark", wait 5 seconds, click "Stop & Record", then "Export JSON". Save as `stress-benchmark-gpu.json`.

- [ ] **Step 4: Compare with game scene**

Join a real game to verify the spring physics path still works correctly for game cards (shake, highlight, selected effects).

---

## Self-Review Checklist

1. **Placeholder scan**: No "TBD", "TODO", or vague requirements in the plan above.
2. **Spec coverage**: GPU shader with typed `instanceIndex` attribute covers the performance fix; spring path preserved for game cards.
3. **Type consistency**: `uniforms.uTime`, `uniforms.uCardCount`, `uniforms.uUseGpuAnimation` are consistently referenced in shader and component.
4. **Bug from previous attempt**: Previous GPU shader derived index from floating-point position hash → NaN/Inf. This plan uses typed `Float32Array` of clean integers 0..n-1 as `instanceIndex` attribute — deterministic, no hash.
5. **Stress test compatibility**: `StressTestCards` passes `shake=false, highlight=false, selected=false`, so `needsSpring.current = false` and GPU path activates.
6. **Game scene compatibility**: Game cards have `shake`/`highlight`/`selected` flags, so `needsSpring.current = true` and CPU spring path activates.
