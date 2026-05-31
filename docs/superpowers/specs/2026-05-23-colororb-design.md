# ColorOrb Design Specification

## Context

The existing `AnimatedRing` component was a ring geometry encircling the discard pile, indicating the active Uno color. It was removed because it physically covered the discard pile, obscuring the top card. Additionally, its jewel-in-socket aesthetic (layered ring meshes) was considered visually heavy for its purpose.

The replacement component — **ColorOrb** — reimagines the color indicator as a floating, glowing crystal orb positioned *above* the discard pile rather than around it. It communicates the active color clearly without overlapping card geometry.

---

## Visual Design

**Shape**: OctahedronGeometry (8-face crystal) — flat faces catch light naturally, giving faceted depth without custom geometry work.

**Material**: Custom ShaderMaterial with:
- Fresnel rim glow — `pow(1.0 - dot(viewDir, normal), 2.5)` — edges glow with active color
- Procedural facet-slice lines — layered value noise at 2 frequencies breaking the surface into irregular glowing slices
- Core glow — radial brightness strongest at face centers, creating inner-light depth
- Breathing pulse — `sin(uTime * PI) * 0.05 + 0.95` brightness multiplier, period ~2s, keeps the orb feeling alive without motion

**Color**: Emissive glow in the active Uno color (red `#e63946`, blue `#4361ee`, green `#2ec4b6`, yellow `#ffd60a`).

**Scale**: `0.4 * L.discardScale` (roughly 40% of a card's visual size).

---

## Animation Behavior

The orb animates **only on color change** — no continuous rotation or sweep.

| Trigger | Animation |
|---|---|
| Color card played | Scale spring: 0 → 1.2 → 1.0 (STIFFNESS=200, DAMPING=20) |
| Wild card color chosen | Scale spring: 0 → 1.5 → 1.0 (same spring params, larger start amplitude) |

The color transitions immediately to the new color — no sweep or wipe between hues.

The spring is implemented manually via `useFrame` using the same delta-time spring integration already used in `TurnIndicator.tsx` (no new dependencies).

---

## Positioning

`[L.pileX, 0.35, 0.52]` — floating above the discard pile, between the pile plane (z=0.49) and the camera. Y=0.35 lifts it above card level; z=0.52 places it between pile and camera, not overlapping card faces.

---

## Component Interface

```tsx
interface ColorOrbProps {
  color: string;         // hex color string — UnoColor mapped to hex
  isWildCard?: boolean;  // if true, triggers the larger amplitude pop
  scale?: number;        // base scale multiplier (default 0.4 * discardScale)
}
```

`isWildCard` prop distinguishes a player's manual color pick (wild card played) from an automatic color card play — same spring physics, different pop amplitude.

---

## Shader Uniforms

| Uniform | Type | Purpose |
|---|---|---|
| `uColor` | `vec3` | Active color RGB |
| `uTime` | `float` | Elapsed time for breathing pulse |
| `uPopIntensity` | `float` | Pop multiplier: 1.5 (wild) / 1.2 (normal), decays to 1.0 |

---

## Implementation Notes

- Spring physics reuse the existing inline spring integration from `TurnIndicator.tsx` — `STIFFNESS=200`, `DAMPING=20`.
- No new npm dependencies.
- The `useFrame` spring drives `group.scale`, not geometry vertices — performant.
- The `uPopIntensity` uniform is set to 1.5 or 1.2 at the moment of color change, then decays exponentially back to 1.0 per frame (or use a separate `useFrame` that resets it).
- Wild card detection: when a wild card is played, the `chosenColor` is selected via `ColorPicker`. The `Game.tsx` already knows when a wild card was played (it's the only way `ColorPicker` appears). Pass `isWildCard={true}` during that interaction window.

---

## Files to Change

1. **`web-react/src/components/game/ColorOrb.tsx`** (new) — replaces `AnimatedRing.tsx`
2. **`web-react/src/components/game/AnimatedRing.tsx`** — delete after `ColorOrb` is verified
3. **`web-react/src/components/Game.tsx`** — swap `<AnimatedRing>` → `<ColorOrb>`, pass `color` and `isWildCard` props

---

## Verification

1. Run the game, play a color card — orb should pop to 1.2× and settle
2. Play a wild card, pick a color — orb should pop to 1.5× and settle
3. The orb must not visually overlap or obscure any discard pile cards
4. Breathing glow should be subtle (not distracting) when idle
5. All four colors should render correctly (red, blue, green, yellow)
