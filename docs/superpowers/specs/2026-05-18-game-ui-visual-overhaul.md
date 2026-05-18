# Game UI Visual Overhaul

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement. Steps use checkbox syntax for tracking.

**Goal:** Revamp the in-game HUD, color picker, turn indicator, overlays, and discard pile to feel like a premium home game setup — warm, tactile, and polished.

**Design Philosophy:** Classic Lounge — rich wood tones, textured green felt, cream typography, warm ambient lighting, understated elegance. Every element should feel like it belongs on a beautiful physical card table.

**Architecture:** CSS + R3F component changes only. No state changes, no game logic touched. Changes are purely cosmetic and additive — they're layered on top of existing game state and logic.

**Tech Stack:** React 19, Three.js 0.183, React Three Fiber 9, CSS custom properties

---

## Design Language

### Color Palette
```
--felt-green:      #1a5c38   (table surface feel)
--felt-dark:       #0d3d22   (deeper shadows)
--wood-dark:       #3d2010   (dark walnut frame)
--wood-medium:     #6b3d1f   (medium oak)
--wood-light:      #8b5e34   (lighter wood inlay)
--cream:           #f5e6c8   (primary text, card faces)
--cream-dark:      #d4c4a0   (secondary text)
--gold:            #c9a84c   (accent, highlights, active states)
--gold-glow:       #e8c96a   (softer gold for glows)
--shadow:          rgba(0,0,0,0.5)
```

### Typography
- Primary: `'Georgia', 'Times New Roman', serif` — warm, classic readability
- UI Labels: `'Inter', system-ui, sans-serif` — clean contrast for small text
- Room code: `monospace` — technical info stays technical

### Motion
- Spring bounces with slight overshoot on reveals (200-400ms)
- Gentle eases for fades and state transitions
- Spring physics: `stiffness: 200, damping: 20` equivalent feel in CSS
- Hover states: 150ms transitions

---

## Component Changes

### 1. HUD Action Buttons → Pill Buttons

**Current:** 30×30px circular, emoji-only, minimal border

**New:**
- Pill shape (32×32px, `border-radius: 8px`)
- Semi-transparent dark bg (`rgba(20,10,5,0.7)`)
- Cream text (emoji + subtle shadow)
- `border: 1.5px solid rgba(201,168,76,0.3)` — subtle gold border
- **Hover:** border brightens to full gold, background warms slightly, spring scale to 1.05
- **Active/pressed:** slight scale down to 0.95
- Spacing: `gap: 8px`

**CSS class:** `.hud-btn` in `index.css`

```css
.hud-btn {
  border-radius: 8px;
  border: 1.5px solid rgba(201,168,76,0.3);
  background: rgba(20,10,5,0.7);
  color: #f5e6c8;
  width: 32px;
  height: 32px;
  font-size: 14px;
  backdrop-filter: blur(4px);
  transition: border-color 0.15s, background 0.15s, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hud-btn:hover {
  border-color: #c9a84c;
  background: rgba(40,20,10,0.75);
  transform: scale(1.05);
}
.hud-btn:active {
  transform: scale(0.95);
}
```

---

### 2. Color Picker → Stacked Color Cards

**Current:** 4 flat colored circles in an arc, minimal interaction

**New:** Four overlapping card-shaped meshes fanned out, each displaying a rich solid color

**3D/R3F implementation:**
- 4 card-shaped planes (`CardGeometry` or `BoxGeometry` with rounded edges) arranged in a fan/arc
- Each card slightly rotated and offset from center
- Colors: Red (#ff3333), Blue (#3377ff), Green (#33bb44), Yellow (#ffcc00)
- Cards have a cream-colored back face visible from the edge
- **Idle:** cards stacked with slight overlap, subtle float animation (sin wave, ±0.02 units)
- **Hover:** hovered card scales up (1.3×), moves to front (z +0.05), glow outline appears in gold
- **Click:** card flies toward the discard pile (animate position), picker dismisses
- Dark overlay behind (`opacity: 0.5`) with fade-in

**Animation (spring-based):**
```typescript
// Card hover: spring to scale 1.3, spring to front z
// Card select: lerp position toward discard pile over 400ms
```

**Remove:** existing `ColorPicker.tsx` overlay circle approach — replace entirely

---

### 3. Turn Indicator → Carved Wood Pointer

**Current:** Yellow arrow shape + faint direction ring

**New:**
- A 3D carved wooden finger/arrow pointer rotating around the table center
- Shape: tapered rectangle with rounded tip — like a wooden game piece
- Color: dark walnut wood tone (`#5c3317`) with lighter wood edge highlight
- Slight drop shadow beneath for depth
- Rotates smoothly (spring physics, ~300ms) to active player's position
- Seat numbers (1-4) shown as small cream-colored circles at each seat position
- Direction arrow: small curved arc arrow that flips when direction reverses

**3D implementation in `TurnIndicator.tsx`:**
- Replace `ARROW_GEO` shape with a carved wooden finger shape
- Add a `THREE.MeshStandardMaterial` with roughness 0.8, slight wood color
- Subtle ambient occlusion via a darkening plane beneath

---

### 4. Discard Pile → Beveled Wood Ring

**Current:** `AnimatedRing.tsx` — two flat colored circles

**New:**
- A beveled wood inlay frame around the discard pile
- Outer ring: dark walnut wood (`#3d2010`) with a beveled edge
- Inner ring: the active discard color as a soft felt fill
- The wood frame has a lighter wood inlay line detail (`#8b5e34`)
- Ring thickness: ~0.08 world units
- Spring animation when active color changes — the felt fill "spreads" from center
- Sits at `z = 0.48` (just above table)

**Implementation in `AnimatedRing.tsx`:**
- Replace inner circle mesh with a `THREE.RingGeometry` (felt fill)
- Outer ring: `THREE.RingGeometry` with `THREE.MeshStandardMaterial` wood look
- Add inlay detail as a second slightly-smaller ring with lighter wood material
- Spring scale animation on color change

---

### 5. Overlays → Felt Card Style

**Current:** Dark semi-transparent backdrop + dark green card panels with gold border

**New:**
- **Backdrop:** `rgba(10,20,10,0.7)` with `backdrop-filter: blur(8px)`
- **Card panel:** cream colored center (`#f5e6c8`), rounded corners (`border-radius: 12px`)
- **Border:** thin colored border — the card's "suit" color accent on the top edge only (4px)
- **Header:** same wood-dark tone as room code, with gold accent
- **Text:** Georgia serif font for headings, Inter for body
- **Close button:** small cream circle with dark ✕, hover turns warm gold
- **Scroll:** subtle warm-toned scrollbar

**CSS changes in `index.css`:**
```css
.rules-card, .options-card, .chat-card, .rematch-card {
  background: #f5e6c8;
  border-radius: 12px;
  border-top: 4px solid var(--active-color, #c9a84c);
  padding: 28px 32px;
  max-width: 460px;
  box-shadow: 0 12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.1);
  color: #2d1810;
}
.rules-header h2, .options-header h2 {
  font-family: Georgia, serif;
  color: #3d2010;
  font-size: 22px;
}
.rules-body section h3 {
  color: #6b3d1f;
}
.rules-close {
  background: rgba(60,30,10,0.1);
  border: 1px solid rgba(60,30,10,0.2);
  color: #3d2010;
  border-radius: 50%;
}
.rules-close:hover {
  background: rgba(201,168,76,0.3);
  color: #3d2010;
}
```

**Chat overlay:** Same felt card style. Messages in cream bubbles, timestamps in muted brown.

**Rematch overlay:** Same panel, with "Play Again" button styled as a gold-accented wood button.

---

### 6. Last Played Card Info Bar

**Current:** Simple text with player name and card name, minimal styling

**New:**
- A small felt-card style chip floating above the discard pile
- Shows: "PlayerName played [card name]"
- Background: cream with gold left border accent
- Font: Georgia italic for the card name, Inter bold for player name
- Subtle spring entrance animation (slides up + fades in)
- Auto-dismisses after 4 seconds with fade-out

**CSS addition:**
```css
.last-played-info {
  background: rgba(245,230,200,0.95);
  border-left: 3px solid #c9a84c;
  border-radius: 6px;
  padding: 8px 14px;
  font-family: Georgia, serif;
  font-size: 14px;
  color: #2d1810;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  backdrop-filter: blur(4px);
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.last-played-info .player-name {
  font-family: Inter, sans-serif;
  font-weight: 700;
  color: #3d2010;
}
```

---

### 7. Player Labels & Seat Areas

**Current:** Plain white text with shadow

**New:**
- Player names in cream colored badges
- Seat area: subtle warm-toned arc beneath the player's hand position
- Active player: their arc glows softly in gold
- Your own seat: slightly highlighted so it's easy to find your own cards

---

## Files to Modify

| File | Changes |
|------|---------|
| `web-react/src/index.css` | Pill buttons, felt card overlays, last-played chip, player labels |
| `web-react/src/components/game/ColorPicker.tsx` | Full replacement — stacked card fan |
| `web-react/src/components/game/TurnIndicator.tsx` | Carved wood pointer shape |
| `web-react/src/components/game/AnimatedRing.tsx` | Beveled wood inlay ring |
| `web-react/src/components/game/GameHud.tsx` | Add last-played info chip component |
| `web-react/src/components/Game.tsx` | Wire last-played chip to `onLastPlayed` callback |

---

## Self-Review Checklist

- [ ] No placeholder text
- [ ] All design choices consistent with Classic Lounge aesthetic
- [ ] No game logic changes
- [ ] Spring animations described with feel, not hard-coded timing
- [ ] Each component change has concrete CSS or implementation notes
- [ ] All files listed with specific changes
