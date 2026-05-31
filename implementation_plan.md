# Implementation Plan — Recursive Deep UI/UX Improvements

We will perform deep, recursive UI/UX improvements to the **Wild Table** React card game client. This plan elevates the client from a basic interface into a premium, responsive, and tactile web application. The design will be backed by a rich design system, custom SVG illustrations, and high-performance micro-animations.

---

## User Review Required

> [!IMPORTANT]
> **No Server Modifications**: To keep our changes fully decoupled and preserve compatibility with existing godot, unity, and haxe clients, we will implement all avatar customization features client-side. We will use a smart **name serialization** protocol: encoding the avatar choice (symbol + theme color) directly in the player's name string (e.g., `[av-tiger-sapphire]PlayerName`). The client automatically deserializes this to render the rich custom avatar, while other clients simply see the player name normally.

---

## Proposed Changes

We will concentrate our improvements in two main files of the `web-react` client:
1. `web-react/src/main.tsx` — All React structure, hooks, state, and interaction handlers.
2. `web-react/src/index.css` — Detailed styling, HSL palette tokens, custom card dimensions, keyboard focus rings, animations, and keyframes.

---

### UI/UX Rounds

#### Round 1: Immersive Lobby Experience with Interactive Avatar Creator and Sound Settings
*   **Interactive Avatar Creator**:
    *   Build a responsive visual avatar selector in the Lobby.
    *   Expose 8 custom SVG animal/crest symbols: Tiger 🐯, Dragon 🐲, Phoenix 🦅, Panda 🐼, Wolf 🐺, Owl 🦉, Fox 🦊, Shark 🦈.
    *   Provide 5 gorgeous HSL gradient themes: Neon Rose (Red), Electric Sapphire (Blue), Emerald Aurora (Green), Golden Sol (Yellow), Purple Nebula (Violet).
    *   Serialize settings into nicknames: `[av-<symbol>-<theme>]Name`.
    *   Persist nickname and avatar configuration in `localStorage`.
*   **Audio Control Panel**:
    *   Integrate master volume slider, mute toggle, and sound preview button in both the Lobby and Table.
    *   Extend `SoundFX` class to respect the set volume and respect mute.
    *   Persist volume preferences in `localStorage`.
*   **Connection Quality Indicator (Ping Visualizer)**:
    *   Periodically measure game round-trip latency (ping) using clean websocket round-trip message exchange or periodic timestamp handshakes.
    *   Render a stylish SVG signal bar display: Excellent (<100ms, Green), Good (100-250ms, Yellow), Slow (>250ms, Red).

#### Round 2: Enhanced Table Visuals, CSS Particle System, and Advanced Turn Timer
*   **SVG Circular Turn Progress Timer**:
    *   Add a live-updating countdown ring around the active player's avatar in the opponent list and player profile.
    *   Deplete the progress arc based on the server-synchronized `turnDeadline` timestamp relative to current time.
    *   Animate color to warning orange/red when less than 2.5s remains.
*   **Interactive Play Direction Ring**:
    *   Add arrows and pulsing particles to `PlayDirectionRing` representing the turn order flow.
    *   Increase speed and glow on direction updates.
*   **Tactile CSS Particle Explosion Engine**:
    *   Implement a lightweight element generator that spawns floating particles (stars, cards, colors) upon key game events (wild play, rematch, victory).
*   **Cinematic Special Card Alert Overlays**:
    *   Trigger slide-in overlays for **Skip**, **Reverse**, and **Draw** cards to make the flow easy to follow.

#### Round 3: Hand Dock Usability, Hand Card Sorting, and Accessibility
*   **Quick Sorting Buttons**:
    *   Add controls to sort player hand by **Color** or **Value**.
    *   Animate card fanning rearrangement smoothly.
*   **Keyboard Navigation & Focus states**:
    *   Map full accessibility hotkeys (`ArrowLeft` / `ArrowRight` to select, `Space` / `Enter` to play, `d` to draw, `u` to call UNO, `?` for rules).
    *   Implement glowing focus rings.
*   **Interactive Rules & Shortcuts Overlay Drawer**:
    *   Create a slide-out glassmorphic panel detailing UNO rules and hotkeys.

#### Round 4: Victoria Podium Screen, Rematch voting widget, and Local Match Stats
*   **Historical Offline Stats (Leaderboard)**:
    *   Track local matches played, wins, bot knockouts, and cards played.
    *   Display a beautiful dashboard in the Lobby.
*   **Sleek Victory Podium**:
    *   A full-screen premium podium screen with animated crowns, win details, and confetti particles.
*   **Rematch Voting Visualizer**:
    *   Show active seats with individual checked/voting indicators so rematch status is transparent.

---

## Verification Plan

### Automated Tests
*   Run `npm run lint` and `npm run build` in `web-react/` to ensure zero compilation or styling warnings.
*   Launch `./scripts/smoke-web-agent-browser.sh` to execute browser-driven E2E UI verification.

### Manual Verification
*   Verify responsive layout on desktop (1280x720) and mobile (390x844) viewport presets.
*   Validate sound settings and volume levels.
*   Confirm keyboard shortcut responsiveness.
