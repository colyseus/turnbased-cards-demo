# Checklist — Deep Recursive UI/UX Improvement Rounds

## Round 5: Tactile Card Selection & Hand Dock Glow
- [x] **Visual Card Transparency Fix**
    - [x] Add `.hand-card-wrapper button:disabled` override in `index.css` to prevent `button:disabled` default opacity washing out cards
    - [x] Ensure non-playable cards are fully solid, only using `filter: brightness(0.65) saturate(0.85)` for inactive display
- [x] **Mobile-first Tactile Selection & Play Flow**
    - [x] Remove `disabled={!playable}` from card buttons in `main.tsx` to enable clicking and event bubbling for any card
    - [x] Program tactile click-to-select: first click selects a card (`selectedCardIdx`), playing a soft card rustle sound (`sfx.playSwish()`)
    - [x] Program double-click play: clicking a card that is already selected plays it if it is `playable`, otherwise plays error sound (`sfx.playPluck()`)
- [x] **Keyboard Selection Focus Highlight**
    - [x] Create detailed CSS rules in `index.css` for `.hand-card-wrapper.keyboard-focused`
    - [x] Animate focused card lifting up (`translateY(-24px) scale(1.08)`) and glow it with a beautiful gold focus outline
- [x] **Active Turn Hand Dock Glow**
    - [x] Pass `my-turn` dynamic class to `.hand-dock` container in `main.tsx` based on `isMyTurn` state
    - [x] Design custom CSS in `index.css` for `.hand-dock.my-turn` with gold border, pulsing animation, and radial amber gradient
- [x] **Lobby Customizer Sound FX**
    - [x] Add interactive click sound feedback (`sfx.playPluck()`) to the Lobby avatar creator symbols/themes picker

## Round 6: Deep UX Polish Pass
- [x] **Lint Error Resolution**
    - [x] Fix OscillatorNode/GainNode `no-undef` errors with eslint-disable comments
    - [x] Fix empty catch block in `stopAmbientHum()` with descriptive comment
    - [x] Fix unused variables in `HandCardItemProps` with eslint-disable comments
- [x] **Sort Button Active State**
    - [x] Add `.sort-btn.active` CSS rule with gold-tinted feedback matching `.chip.active` pattern
- [x] **Connecting Spinner**
    - [x] Add animated spinner ring to panel-header when `busy=true`
    - [x] Add `.loading` class to primary-btn with spinner pseudo-element when connecting
- [x] **Chat Auto-Scroll**
    - [x] Add ref callback to `.chat-log` to auto-scroll to bottom on new messages
    - [x] Add `scroll-behavior: smooth` to chat log
- [x] **Mode Transition Animation**
    - [x] Add `modeTransitionIn` keyframe animation to both `.lobby-shell` and `.game-shell`
- [x] **Player Pill Layout Fix**
    - [x] Force horizontal flex-direction on `.player-pill` for proper avatar + info alignment
    - [x] Add `.avatar-wrapper-pill` and `.turn-timer-svg` positioning
- [x] **Enhanced Wild Color Modal**
    - [x] Add `modalPopIn` bounce animation to `.color-modal-box`
- [x] **Winner Podium Background**
    - [x] Add animated radial gradient overlay to `.winner-podium-overlay`
- [x] **Accessibility**
    - [x] Add global `*:focus-visible` gold outline for keyboard navigation
    - [x] Add styled label for `.avatar-creator-panel > span`
- [x] **Mobile Responsive Enhancements**
    - [x] Add topbar button wrapping on 640px breakpoint
    - [x] Add audio controls panel wrapping
    - [x] Reduce ghost-btn size on mobile
- [x] **Deck Hover Polish**
    - [x] Enhanced deck count overlay scaling on hover
- [x] **Brand Enhancement**
    - [x] Add gold underline accent to `.brand-copy h1::after`

## Verification & Validation
- [x] Run `npm run lint` in `web-react/` — 0 errors, 0 warnings ✅
- [x] Run `npm test` in `server/` — 58/58 tests passing ✅
- [x] Visual audit: Lobby, Table, Winner Podium all rendering correctly ✅
