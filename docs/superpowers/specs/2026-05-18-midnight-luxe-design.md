# Midnight Luxe — Game UI Redesign Spec

## Concept & Vision

A minimal luxury aesthetic with vibrant modern energy. Deep charcoal backgrounds create sophistication while electric cyan accents provide sharp, contemporary contrast. Every component feels intentional — clean geometry, subtle depth, no visual clutter. The game board reads as a premium digital experience, not a busy game overlay.

---

## Design Language

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#1a1a2e` | Main background, table surface |
| `--bg-surface` | `#0f0f1a` | Cards, overlays, panels |
| `--bg-elevated` | `#252540` | Hover states, active elements |
| `--accent` | `#00e5ff` | Borders, highlights, active states |
| `--accent-dim` | `#00e5ff33` | Glows, subtle accents |
| `--accent-glow` | `#00e5ff66` | Stronger glow effects |
| `--text-primary` | `#ffffff` | Main text |
| `--text-muted` | `#888899` | Secondary text, labels |
| `--card-red` | `#e63946` | Red cards |
| `--card-blue` | `#4361ee` | Blue cards |
| `--card-green` | `#2ec4b6` | Green cards |
| `--card-yellow` | `#ffd60a` | Yellow cards |
| `--card-wild` | `#9d4edd` | Wild/wild-draw4 cards |

### Typography

- **Primary:** Inter (already in use) — clean, modern sans-serif
- **Fallbacks:** system-ui, -apple-system, sans-serif
- **Scale:** 14px base, 1.5 line-height, consistent with existing system

### Spatial System

- 4px base unit
- Common spacing: 8px, 12px, 16px, 24px, 32px
- Border radius: 4px for buttons, 8px for cards, 12px for overlays
- Consistent 8px gap between HUD elements

### Motion Philosophy

- **Entrance:** `opacity 0→1, translateY 8px→0`, 200ms ease-out
- **Spring hover:** scale 1→1.02, 150ms ease-out
- **Transitions:** 150ms for color/opacity, 200ms for transforms
- **No bounce** — this is luxury, not playful

### Visual Assets

- **Noise texture:** Subtle grain overlay (5% opacity white) on table surface
- **Glow effects:** `box-shadow: 0 0 8px var(--accent-dim)` on accent elements
- **No gradients on large surfaces** — flat surfaces with subtle borders
- **Card symbols:** Bright white/light on colored card faces

---

## Layout & Structure

### Game Board (3D Canvas)

The 3D table surface fills the viewport. Cards, discard pile, and turn indicator render in 3D space. The camera is fixed (no orbit controls).

**Table surface:**
- Solid `--bg-primary` with noise texture overlay
- Rounded rectangle shape (R3F Table component)
- No radial gradient — flat dark with subtle texture

**Discard pile:**
- Right side of table (positive X)
- Top card face-up with proper atlas UV mapping
- Card backs stacked behind

**Draw pile:**
- Left side of table (negative X)
- Stacked blue card backs

**Turn indicator:**
- Center of table
- Gold/cyan labeled pills at 4 cardinal positions
- Active player's pill glows cyan
- Direction arrow between positions

### HUD Overlay (HTML/CSS)

Lives above the 3D canvas via `position: fixed`. All HUD elements are HTML, not 3D.

**Top bar:**
- Left: Sort toggle button (pill style)
- Right: Sound, Rules, Options buttons in a row

**Bottom bar:**
- Center: Local player's hand (horizontal card strip)
- Cards fan out slightly from center

**Side elements:**
- Spectator count (top-right corner)
- Last-played info chip (appears briefly after a play)

### Color Picker Drawer

- Slides up from bottom when wild card is played
- Horizontal strip of 4 color options
- Solid dark pill with colored border, cyan border when selected
- 200ms slide-up animation

---

## Features & Interactions

### Card Rendering (InstancedCards)

- **Front faces:** Rich solid colors with thin accent border, white card symbols
- **Back faces:** Dark `--bg-surface` with centered diamond/logo mark, accent border
- **Hover (local hand only):** Slight scale-up (1.05x), lift effect
- **Playable indicator:** Subtle glow pulse on border
- **Selected:** Cyan border glow
- **Highlight:** Yellow border glow

### HUD Buttons

- Solid dark pill with thin accent border
- Hover: `--bg-elevated` background, border brightens
- Active: Accent background at 20% opacity
- Icon + label layout
- 150ms transition on all states

### Turn Indicator

- 4 labeled circles at cardinal positions (N/E/S/W)
- Inactive: `--bg-surface` fill, muted text
- Active: Accent glow, white text
- Direction arrows: Thin accent lines between positions
- Spring animation when switching active player

### Overlays (Rules, Options, Chat)

- Centered modal over darkened game
- `--bg-surface` panel with accent border
- 12px border-radius
- Subtle backdrop blur on the overlay scrim
- Close button (×) top-right

### Lobby Screen

- Full-viewport lobby with centered card
- Hero card shows clean card back design
- Name input, room code input (minimal style)
- Quick Play button (solid accent pill)
- Stress Test button (subtle, bottom-left)

---

## Component Inventory

### CardMesh (3D)

**States:**
- Default: Colored face or back, thin border
- Hover (local only): Scale 1.05, slight lift
- Highlighted: Yellow border glow
- Selected: Cyan border glow
- Shake: Card shake animation (e.g., for Draw-2)

### HUDButton

**States:**
- Default: `--bg-surface` fill, thin accent border
- Hover: `--bg-elevated` fill, brighter border
- Active/Pressed: Accent at 20% opacity
- Disabled: 50% opacity, no interactions

### LabeledPill (Turn Indicator)

**States:**
- Inactive: `--bg-surface` fill, `--text-muted` label
- Active: Accent glow border, `--text-primary` label
- Transition: 150ms ease-out

### ColorPickerDrawer

**States:**
- Hidden: Below viewport
- Visible: Slides up, centered horizontally
- Option selected: Cyan border on selected color

### OverlayPanel

**States:**
- Closed: Not rendered
- Open: Centered modal, backdrop scrim

---

## Technical Approach

### Stack

- React 19 (existing)
- Three.js via R3F (existing)
- CSS custom properties (new palette)
- No external UI libraries — custom components

### File Structure

```
web-react/src/
  components/
    game/
      InstancedCards.tsx  — 3D card rendering
      Table.tsx          — 3D table surface
      TurnIndicator.tsx   — 3D turn direction
    GameHud.tsx          — HTML overlay
    ColorPicker.tsx       — Color selection drawer
    OptionsOverlay.tsx    — Settings modal
    RulesOverlay.tsx      — Rules modal
    ChatOverlay.tsx       — Chat modal
  index.css               — All styles (palette + components)
  main.tsx                — Lobby + routing (unchanged)
```

### Key Implementation Notes

1. **Atlas UV fix:** Ensure card front/back UVs map to correct atlas regions
2. **Table texture:** Solid dark with noise overlay, ClampToEdgeWrapping
3. **Card backs:** CSS-style logo mark rendered in atlas or via shader
4. **All colors via CSS vars:** No hardcoded colors in components
5. **Component isolation:** Each component reads only the CSS vars it needs

### Performance

- InstancedCards for all 3D cards (existing, working)
- CSS animations for HUD (GPU-accelerated)
- Noise texture generated once on mount, cached
- No per-frame React re-renders for animations

---

## Scope

**In scope:**
- Complete visual redesign of all UI components
- CSS palette overhaul
- Card rendering fix (UV/atlas issues)
- Table surface redesign
- HUD button redesign
- Turn indicator redesign
- All overlay redesigns

**Out of scope:**
- Game logic changes
- State management changes
- Server/network changes
- New features beyond UI redesign

---

## Success Criteria

1. All UI components use the Midnight Luxe palette
2. Card rendering shows proper card faces and backs (no crosshatch artifacts)
3. Table surface is solid dark with subtle noise — no tiling
4. HUD buttons are clean solid pills with thin accent borders
5. All overlays follow the glass-panel style
6. 60 FPS maintained in stress test
7. No console errors related to rendering
