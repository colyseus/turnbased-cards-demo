# UNO Demo — Unity

![Screenshot](screenshot.webp)

3D desktop/web/mobile client for [Turn-Based UNO Demo](../README.md) built with [Unity](https://unity.com/) and the [Colyseus Unity SDK](https://docs.colyseus.io/getting-started/unity).

## Setup

1. Open this folder as a Unity project (Unity Hub → Add → select the `unity/` folder). Requires Unity 2022.3 LTS or newer.
2. Unity resolves the Colyseus SDK package automatically from `Packages/manifest.json`.
3. Open `Assets/Scenes/Main.unity` and press **Play**.

Make sure the [game server](../server/) is running on port 2567.

`SceneBootstrap.cs` wires up `NetworkManager`, `GameManager`, `HUDManager`, and `LobbyManager` at runtime, so the scene only needs a camera.

## Server endpoint

Configured in `NetworkManager.cs` — override the URL there or set it on the prefab when wiring the scene manually.

## Controls

- **Click** — Play a card (opens color picker for wilds)
- **Hover** — Preview playable cards
- **New Game** button — Starts a new round after a winner is declared

## Building for WebGL

```bash
# From the unity/ directory
BUILD_OUTPUT_PATH=../BUILDS/unity unity -batchmode -quit -projectPath . -executeMethod BuildScript.BuildWebGL
```

## Project structure

```
unity/
├── Assets/
│   ├── Scripts/
│   │   ├── SceneBootstrap.cs     # Auto-creates all managers at runtime
│   │   ├── NetworkManager.cs     # Colyseus client wrapper (singleton)
│   │   ├── GameManager.cs        # Game controller, 3D rendering, input
│   │   ├── LobbyManager.cs       # Lobby UI (IMGUI)
│   │   ├── HUDManager.cs         # In-game HUD overlay (IMGUI)
│   │   ├── CardEntity.cs         # Double-sided card with spring physics
│   │   └── Schema/               # UnoRoomState, PlayerSchema, UnoCardSchema
│   ├── Scenes/Main.unity
│   ├── Resources/Cards/          # Card PNG textures
│   └── Editor/BuildScript.cs     # WebGL build automation
└── Packages/manifest.json
```

## Card assets

Card textures load from `Assets/Resources/Cards/` at runtime:

- Color cards: `{color}_{value}.png` (e.g., `red_5.png`, `blue_skip.png`)
- Wild cards: `wild.png`, `wild_draw4.png`
- Card back: `back.png`
