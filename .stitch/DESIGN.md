---
name: wild-table
description: Luxury dark-mode card game design system with emerald felt, gold accents, glassmorphic HUDs, and premium casino aesthetics
colors:
  abyssal-purple-black: "#0c0a10"
  deep-plum-shadow: "#111019"
  muted-aubergine: "#1a1724"
  warm-parchment: "#f5f0e6"
  lavender-gray: "#aba8b3"
  ash-violet: "#7a7782"
  deep-emerald-felt: "#0e3328"
  pine-shadow: "#061915"
  wild-table-gold: "#f0c66f"
  dark-mahogany: "#391e14"
  electric-azure: "#1e8ce6"
  jade-signal: "#2faa6e"
  crimson-alert: "#d93d45"
  amber-warning: "#f0b70f"
  glass-panel: "rgba(16, 14, 22, 0.65)"
  glass-border: "rgba(255, 255, 255, 0.08)"
---

# Design System: Wild Table
**Project ID:** turnbased-cards-demo / r3f-card-table-showcase

## 1. Visual Theme & Atmosphere

Wild Table is a premium dark-mode card game interface that evokes the hushed intimacy of a high-stakes private casino room. The visual foundation is built on deep, desaturated purple-blacks that feel luxurious rather than gloomy — think velvet curtains and lacquered wood rather than generic dark mode. The atmosphere is warm, refined, and tactile.

The design philosophy centers on **material honesty and layered depth**. The game board is rendered as a physical felt table with wood railings, giving users the sense of sitting at a real card table. Glassmorphic HUD panels float above this surface with subtle transparency and soft borders, suggesting premium acrylic or frosted glass overlays. Gold is used sparingly but deliberately — it signals brand identity, interactive affordance, and celebration. Every animation is smooth and physics-informed, from the cubic-bezier card flips to the staggered deck hover fan-out. The overall mood is **confident, elegant, and immersive** — a design that respects the player's time and rewards their attention with visual delight.

## 2. Color Palette & Roles

### Primary Foundation
- **Abyssal Purple-Black** (`#0c0a10`) — The deepest background layer, used for the page body and as the ultimate depth layer. Creates infinite depth and focus on the game surface.
- **Deep Plum Shadow** (`#111019`) — Secondary container backgrounds, sidebars, and elevated panels. One step lighter than the abyss for subtle layering.
- **Muted Aubergine** (`#1a1724`) — Primary card and modal backgrounds. The workhorse dark surface that carries most UI elements.
- **Glass Panel** (`rgba(16, 14, 22, 0.65)`) — Semi-transparent overlay for HUDs, control panels, and floating UI. Paired with `backdrop-filter: blur(12px)` for true glassmorphism.

### Accent & Interactive
- **Wild Table Gold** (`#f0c66f`) — The signature brand color. Used for active states, hover highlights, borders on focus, the deck medallion, and celebratory effects. Always carries a soft glow (`0 0 15px hsla(42, 85%, 65%, 0.25)`).
- **Dark Mahogany** (`#391e14`) — Wood railing border accent that frames the game board. Adds warmth and physicality to the digital table.

### Typography & Text Hierarchy
- **Warm Parchment** (`#f5f0e6`) — Primary text color. A warm, creamy off-white with slight yellow undertone that prevents the harshness of pure white against dark backgrounds.
- **Lavender Gray** (`#aba8b3`) — Secondary/muted text for descriptions, labels, and inactive elements.
- **Ash Violet** (`#7a7782`) — Tertiary text for placeholders, disabled states, and subtle footer copy.

### Functional States
- **Electric Azure** (`#1e8ce6`) — Blue game card suit/action color. Used for skip cards and sapphire table theme.
- **Jade Signal** (`#2faa6e`) — Green game card suit/action color. Used for reverse cards and emerald table theme.
- **Crimson Alert** (`#d93d45`) — Red game card suit/action color. Used for hearts/diamonds suits and ruby table theme.
- **Amber Warning** (`#f0b70f`) — Yellow game card suit/action color. Used for draw-two cards and wild indicators.
- **Deep Emerald Felt** (`#0e3328`) — Primary table felt color for the default emerald theme.
- **Pine Shadow** (`#061915`) — Outer felt gradient endpoint, creating radial depth on the table surface.

## 3. Typography Rules

### Hierarchy & Weights

The type system pairs a geometric display font with a neutral body font, creating a refined casino aesthetic:

- **Display Font:** "Outfit" (Google Fonts, weights 400-800) — A geometric sans-serif with slightly rounded letterforms. Used for headings, card corner ranks, button labels, and any text that needs to feel branded and confident.
- **Body Font:** "Inter" (Google Fonts, weights 300-700) — A highly legible neo-grotesque sans-serif. Used for body copy, descriptions, spec labels, and UI microcopy.

**Type Scale:**
- **H1 / Brand Title:** 28px, Outfit 800, uppercase, letter-spacing 1.5px, gradient fill (warm parchment to gold), drop-shadow for depth. Used for the showcase header title.
- **H2 / Section Header:** 32px, Outfit 700, uppercase, letter-spacing 0.1em, text-shadow for glow. Used for catalog section headers.
- **H3 / Panel Title:** 14px, Outfit 700, gold color, letter-spacing 0.5px. Used for spec legends and customizer HUD headers.
- **Body / Description:** 14px, Inter 400, warm parchment. Used for showcase descriptions and explanatory text.
- **Label / Microcopy:** 11-12px, Inter 500, lavender gray or ash violet. Used for form labels, spec item labels, and deck counters.
- **Badge / Tag:** 10px, Inter 700, uppercase, letter-spacing 2px, gold color with gold border. Used for version tags and status badges.
- **Card Corner Rank:** 22px, Outfit 800, letter-spacing -1px, slight white text-shadow. Used for card rank display.
- **Card Corner Suit:** 14px, Outfit 800. Used for card suit symbol.
- **Card Center Suit:** 46px, filter drop-shadow for depth. Used for large center suit display.
- **Monospace Data:** 12px, system monospace, warm parchment. Used for spec values and technical readouts.

### Spacing Principles

- **Letter-spacing on display text:** Tightened (-1px to -0.5px) for large headings and card ranks to feel compact and premium.
- **Letter-spacing on uppercase labels:** Expanded (0.5px to 2px) for small uppercase badges and section headers to improve readability at small sizes.
- **Line-height:** Tight (1.1) for card corner stacks and display headings; generous for body text.
- **Text-shadow:** Subtle `0.5px 0.5px 0px rgba(255,255,255,0.8)` on card corners for embossed depth; `0 2px 4px rgba(0,0,0,0.4)` on showcase headers for legibility against complex backgrounds.

## 4. Component Stylings

### Buttons
- **Shape:** 8px border radius — slightly rounded but not pill-shaped, conveying professionalism.
- **Default State:** Glassmorphic background (`var(--glass-bg)`), 1px solid `var(--glass-border)`, warm parchment text, Outfit 600, padding 10px 20px.
- **Hover State:** Background transitions to Wild Table Gold, text inverts to abyssal purple-black, border becomes gold, soft gold glow shadow appears. Transition: 0.2s ease on all properties.
- **Active State:** Scale down to 0.95 with 0.1s cubic-bezier snap for tactile feedback.
- **Disabled State:** Opacity 0.4, cursor not-allowed, no hover effects.
- **Keyboard Badge:** Inline `<kbd>` element with glass background, monospace font, appears inside action buttons to show hotkeys. Inverts to gold on parent hover.

### Cards & Game Components
- **Card Dimensions:** 120px × 168px (classic playing card ratio), 12px border radius.
- **Card Front:** Radial gradient from white to warm off-white (`#fcfbf8`), 1px subtle dark border, luxurious inset gold frame line (3.5px inner border in `rgba(212, 175, 55, 0.16)`), inner box-shadow for depth. Corner rank/suit in Outfit 800, center suit at 46px with drop-shadow.
- **Card Back (Emerald Monarch):** Premium ivory cardstock (`#fcfdf9`) with dark border. Inner rectangle in deep emerald (`hsl(155, 60%, 15%)`) with gold crosshatch mesh pattern. Concentric gold line borders with gap. Central Art Deco diamond medallion in gold gradient. On hover, medallion scales to 1.15x with enhanced drop-shadow.
- **Holographic Sheen:** Absolutely positioned gradient overlay with rainbow spectrum at very low opacity (0.08), GPU-accelerated with `will-change: transform`, fades in on interaction.
- **3D Flip:** `transform-style: preserve-3d`, 0.6s ease transition on the inner wrapper, backface visibility hidden on front face.
- **Suit Colors:** Hearts/diamonds in crimson alert; spades/clubs in near-black (`hsl(220, 15%, 15%)`); special action cards in their respective theme colors (blue, green, yellow, gold).

### Deck Stack
- **Layered Construction:** 6 absolute-positioned layers beneath a top card, each offset by 2px increments (creating a staggered stack effect).
- **Hover Interaction:** On hover, layers fan out to the right with increasing translation (6px to 36px) and brighten progressively. Top card lifts with `translateY(-8px)` and enhanced shadow.
- **Top Card:** Ivory cardstock with emerald inner field, gold filigree pattern, concentric gold borders, and central SVG medallion. Box-shadow includes inset framing and outer elevation.

### Navigation / HUD Panels
- **Glassmorphism Formula:** `background: rgba(16, 14, 22, 0.65)`, `backdrop-filter: blur(12px)` (where supported), 1px solid `rgba(255,255,255,0.08)` border, `box-shadow: 0 0 15px rgba(0,0,0,0.55)`.
- **Showcase Header:** Absolute positioned top-left, max-width 400px, pointer-events none (except children). Tag badge with gold border and glow, gradient text title.
- **Control Hub:** Absolute positioned top-right, flex row with 12px gap. Contains action buttons and audio controls.
- **Spec Legend:** Absolute positioned below header, 280px width, glassmorphic panel with copy-to-clipboard interaction (hover reveals "Click to Copy" tooltip in gold).
- **Customizer HUDs:** Absolute positioned right side, 200px width, 16px border radius, glassmorphic. Section headers in gold with underline separator. Option buttons are 28px circles with active state showing gold border and glow.

### Inputs & Forms
- **Select/Input Fields:** `rgba(255,255,255,0.05)` background, 1px glass border, warm parchment text, 6px border radius, 12px Inter font. Focus state: gold border, gold glow shadow, slightly brighter background.
- **Audio Slider:** Custom WebKit styled range input. 4px height track in `rgba(255,255,255,0.15)`, gold circular thumb with glow. Expands from 0 to 70px width on parent hover.

### Domain-Specific Components
- **Wild Wheel (Wild Card Center):** 54px diameter circle with conic gradient across all four card colors (red, blue, green, yellow). White center text, heavy drop-shadow, 3.5px solid gold outer ring. On hover: scales to 1.15x and rotates 45deg.
- **Felt Shockwave:** 260px diameter circular border in card suit color, with matching box-shadow glow. Used for discard pile impact animation. Expands and fades via keyframe animation.
- **Sparkle Particles:** Absolutely positioned text symbols with `currentColor`, heavy text-shadow glow, GPU-accelerated transforms. Used for celebratory effects.
- **Sound Wave Visualizer:** Three vertical bars in gold at varying heights, pulsing with audio state. Muted state collapses to minimal height and opacity.

## 5. Layout Principles

### Grid & Structure
- **Game Board:** Full viewport (`100vw × 100vh`), flex column with `justify-content: space-between`. All content absolutely positioned within layered z-index stack.
- **Z-Index Layering System:**
  - 0: Felt base background
  - 1: Wood rails
  - 2: Player hand container
  - 5: WebGL Canvas (R3F scene with cards, deck, discard pile)
  - 10: UI overlay (header, controls, HUDs)
  - 100: Customizer HUDs and toast notifications
  - 2000: Sparkle particles (above everything)
- **Play Area:** Flex centered, max-width 900px, 32px gap between deck and discard zones.
- **Catalog Grid:** `repeat(auto-fill, minmax(130px, 1fr))`, 30px row gap, 20px column gap, centered items.

### Whitespace Strategy
- **Base Unit:** 8px (evident in padding scales: 8px, 16px, 24px, 32px).
- **Section Padding:** 24px standard page padding; 60px 40px for catalog sections.
- **Component Internal Padding:** Cards use 8px inner padding; HUD panels use 16px; buttons use 10px 20px.
- **Negative Overlap:** Player hand cards use -30px left margin for intentional overlap/fan effect.

### Alignment & Visual Balance
- **Center Dominance:** The play area (deck and discard) is perfectly centered both horizontally and vertically.
- **Corner Anchors:** Header top-left, controls top-right, hand bottom-center. Classic HUD layout that keeps the center clear for gameplay.
- **Text Alignment:** Showcase headers are left-aligned for readability; catalog headers are centered for presentation; deck labels are centered.

### Responsive Behavior & Touch
- **Touch Action:** Cards have `touch-action: none` to prevent browser panning/zooming during drag interactions.
- **Containment:** Player hand uses `contain: layout style` to isolate layout recalculation during card manipulations.
- **Max-Width Constraints:** Player hand capped at 80% viewport width; catalog grid fluid with minmax; spec legend fixed at 280px.
- **Pointer Events:** Carefully managed — canvas has `pointer-events: auto` for 3D interaction, while overlay containers use `pointer-events: none` with selective `auto` on interactive children.

## 6. Design System Notes for Stitch Generation

### Language to Use
- Describe the atmosphere as "luxury casino," "private card room," "velvet and lacquer," "premium felt table."
- Emphasize **materiality**: glass, wood, felt, ivory cardstock, gold foil.
- Use terms like "glassmorphic HUD," "staggered deck fan-out," "3D card flip," "Art Deco medallion."
- The mood is **dark and warm**, not dark and cold. Avoid blue-tinted darks — the purple-black foundation has warmth.

### Color References
- **Backgrounds:** Start from abyssal purple-black (`#0c0a10`) and layer up through deep plum (`#111019`) to muted aubergine (`#1a1724`).
- **Table Surface:** Emerald green felt radial gradient from `#0e3328` to `#061915`.
- **Accents:** Wild Table Gold (`#f0c66f`) is the star — use it for borders, hover states, focus rings, and brand moments.
- **Wood:** Dark mahogany (`#391e14`) for framing borders.
- **Text:** Warm parchment (`#f5f0e6`) for primary, lavender gray (`#aba8b3`) for secondary.
- **Card Colors:** Electric Azure, Jade Signal, Crimson Alert, Amber Warning for game suits.
- **Glass:** `rgba(16, 14, 22, 0.65)` with white border at 8% opacity.

### Component Prompts
- **Card Component:** "A 120x168px premium playing card with 12px rounded corners. Front face: clean white with subtle gold inset frame line, corner rank in bold geometric sans-serif, large center suit symbol. Back face: ivory cardstock with deep emerald inner rectangle, gold crosshatch mesh pattern, concentric gold borders, and central Art Deco diamond medallion in gold gradient. 3D flip capability with preserve-3d transform."
- **Deck Stack:** "A layered deck of 6 cards beneath a top card, each offset 2px down-right. Top card is the Emerald Monarch back design. On hover, layers fan out rightward with progressive brightness, top card lifts with gold glow shadow."
- **Glassmorphic HUD Panel:** "A floating UI panel with semi-transparent dark background (rgba(16,14,22,0.65)), frosted glass blur effect, 1px subtle white border at 8% opacity, 16px rounded corners, and soft dark drop shadow. Contains uppercase gold section headers and circular option buttons."
- **Action Button:** "Glassmorphic button with dark translucent background, subtle white border, warm cream text in geometric sans-serif. On hover: transitions to gold background with dark text, gold border, and soft gold glow. Active state scales down with snap."
- **Player Hand Dock:** "Horizontal glassmorphic container at bottom of screen, rounded 20px corners, cards overlapping with -30px margin creating a fan effect. Cards lift and glow gold on hover."

### Incremental Iteration
- **To darken/lighten:** Adjust the HSL lightness of the purple-black backgrounds. The current range is 5%-12% lightness.
- **To change table theme:** Swap the felt colors. Four themes are defined: Emerald (default), Sapphire (`hsl(215, 50%, 28%)`), Ruby (`hsl(355, 45%, 26%)`), Charcoal (`hsl(220, 10%, 30%)`).
- **To add emphasis:** Introduce the gold glow shadow (`0 0 15px hsla(42, 85%, 65%, 0.25)`) to borders, text, or box-shadows.
- **To maintain hierarchy:** Keep text in warm parchment for primary, lavender gray for secondary, and ash violet for disabled. Never use pure white.
- **For animations:** Default easing is `cubic-bezier(0.25, 0.8, 0.25, 1)` for smooth deceleration. Use `cubic-bezier(0.175, 0.885, 0.32, 1.275)` for playful overshoot (card center suit hover). Keep transitions at 0.2s-0.3s for UI, 0.5s-0.6s for card flips.
