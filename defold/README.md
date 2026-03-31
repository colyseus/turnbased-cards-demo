# UNO Demo — Defold

![Screenshot](screenshot.webp)

2D desktop client for [Turn-Based UNO Demo](../README.md) built with [Defold](https://defold.com/) and [Colyseus Defold SDK](https://github.com/colyseus/colyseus-defold).

## Setup

1. Open `game.project` in the Defold editor
2. Fetch library dependencies (Project → Fetch Libraries)
3. Build and run (Project → Build)

Make sure the [game server](../server/) is running on port 2567.

## Architecture Note

Defold sandboxes `.script` and `.gui_script` Lua environments — they do not share `_G`, `package.loaded`, or `require`. The lobby (`lobby.gui_script`) owns the Colyseus room connection and forwards state to the game controller (`main.script`) via `msg.post`. User actions are forwarded back the same way.

## Controls

- **Click** — Play a card
- **Hover** — Preview playable cards
