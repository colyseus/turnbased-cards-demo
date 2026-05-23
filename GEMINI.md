# Project Context: Turn-Based UNO Card Game

This project is a multiplayer UNO card game built with the [Colyseus](https://colyseus.io/) game engine. It features a single authoritative game server that supports multiple frontend implementations.

## Project Structure

- `server/`: Authoritative game server (Node.js + TypeScript + Colyseus).
- `web-react/`: 3D Web client (React + React Three Fiber).
- `godot/`: 2D Godot engine client.
- `unity/`: 3D Unity engine client.
- `gamemaker/`: 2D GameMaker client.
- `defold/`: 2D Defold engine client.
- `haxe/`: 2D Haxe (Heaps) client.
- `scripts/`: Utility scripts for running and testing the demo.

## Key Technologies

- **Backend:** Colyseus 0.17, TypeScript, Express, Vitest.
- **Frontend (Web):** React 19, Vite, React Three Fiber (Three.js), agent-browser for browser QA.
- **Communication:** WebSockets (via Colyseus SDK).

## Building and Running

### Prerequisites
- Node.js 22.x
- npm

### Server
```bash
cd server
npm install
npm run dev
```
The server runs on `http://localhost:2567`.

### Web Client
```bash
cd web-react
npm install
npm run dev
```
The client runs on `http://localhost:5173`.

### Quickstart (Both)
To run both the server and the web client simultaneously:
```bash
./scripts/run-web-demo.sh
```

## Development Conventions

### Server Logic
- Core game logic resides in `server/src/rooms/UnoRoom.ts`.
- Game state is defined in `server/src/rooms/schema/UnoRoomState.ts` using Colyseus Schema.

### Web Client
- Uses React Three Fiber for 3D rendering of cards.
- Follows standard React/TypeScript patterns.
- Linting: `npm run lint` in `web-react/`.
- Formatting: `npm run format` in `web-react/`.

### Testing
- **Server:** Unit tests using Vitest in `server/test/`. Run with `npm test`.
- **Web Client:** Use `agent-browser` for browser smoke checks and rendered UI verification.
- **Smoke Test:** `./scripts/smoke-web-agent-browser.sh` validates basic functionality using browser automation.

## Important Files
- `server/src/rooms/UnoRoom.ts`: Main game loop, player actions (draw, play, uno), and room lifecycle.
- `server/src/rooms/schema/UnoRoomState.ts`: Defines the synchronized state structure (players, cards, deck, etc.).
- `web-react/src/App.tsx`: Main entry point for the React client.
## Roadmaps
- [Production Readiness Roadmap](.gemini-plans/production-roadmap.md)
