# UNO Demo — Godot

![Screenshot](screenshot.webp)

2D desktop/web client for [Turn-Based UNO Demo](../README.md) built with [Godot 4.6+](https://godotengine.org/) and the [Colyseus Godot SDK](https://github.com/colyseus/colyseus-godot).

## Setup

1. Download the [Colyseus Godot SDK](https://github.com/colyseus/native-sdk/releases) and extract the `addons/` folder into this directory
2. Open the `godot/` folder in the Godot editor (File → Open Project)
3. Enable the plugin: **Project → Project Settings → Plugins → Colyseus → Enable**
4. Press **F5** to run

Make sure the [game server](../server/) is running on port 2567.

## Web Export

When exporting to web, enable **Extensions Support** in **Project → Export → Web (Runnable)**.

## Server endpoint

- Debug builds: `ws://localhost:2567`
- Release (non-debug) builds: `wss://uno-demo.colyseus.dev`
- Override via command line: `--server=ws://your-server:2567`

## Controls

- **Click** — Play a card (opens color picker for wilds)
- **Hover** — Preview playable cards
- **New Game** button — Starts a new round after a winner is declared

## Architecture notes

State synchronization with the Colyseus Godot SDK has a few quirks that are codified in `scripts/game.gd`:

1. `callbacks.listen("scalar", ...)` does not fire retroactively and delivers `null` for numeric fields on the initial subscription pass. Scalars are polled from `room.get_state()` each frame and listeners are null-guarded.
2. Root-level lambda-wrapped callbacks (e.g. `callbacks.on_add("players", func(...): ...)`) don't fire — named methods must be passed as `Callable`s instead. Nested-schema callbacks do accept lambdas.
3. `discard on_add` fires before `hand on_remove` for a local play. `CardAnimator.get_ordered_local_hand()` gives discard precedence so the just-played card isn't rendered in both places (mirrors the GameMaker client's `_placed` dict pattern).
4. On HTML5, state decodes asynchronously — `room.get_state()` is `null` at `_ready`. The initial snapshot is deferred to the first `_process` frame where state is populated.
5. Round restart: `hand on_remove` is not fired reliably across a `splice(0, len)` + re-deal cycle within a single patch. Stale entities are lazy-cleared on the first hand/discard `on_add` after a winner is declared.

## Headless/CI flags

- `--autoplay` — the local player automatically plays the first playable non-wild card each turn. Useful for long unattended runs.
- `--autojoin=NAME` — skip the lobby and join Quick Play as `NAME`.
- `--server=ws://host:port` — override the server URL.

## Project structure

```
godot/
├── project.godot              # Godot project configuration
├── addons/colyseus/           # Colyseus GDExtension plugin
├── scripts/
│   ├── main.gd                # Scene switcher (lobby ↔ game)
│   ├── lobby.gd               # Lobby UI (name, Quick Play, Join by Code)
│   ├── game.gd                # Game controller, layout, input, state sync
│   ├── card_animator.gd       # Card entity lifecycle + tween animations
│   ├── card.gd                # Individual card entity (Sprite + tweens)
│   ├── hud.gd                 # HUD overlay (labels, turn timers, winner)
│   └── circle_drawer.gd       # Helper for drawing colored circles
├── scenes/
│   ├── main.tscn
│   ├── lobby.tscn
│   ├── game.tscn
│   ├── card.tscn
│   └── hud.tscn
└── assets/
    └── cards/                 # Card PNG textures
```
