# Quickstart (Web Client)

This is the fastest way to run the multiplayer UNO demo locally (server + React web client).

## Requirements

- Node.js **22.x** (recommended by current Colyseus packages)
- npm

## 1) Install dependencies

```bash
cd server && npm install
cd ../web-react && npm install
```

## 2) Run server

```bash
cd server
npm run dev
```

Server starts on `http://localhost:2567`.

## 3) Run web client (in a second terminal)

```bash
cd web-react
npm run dev
```

Vite prints the local URL (usually `http://localhost:5173`). Open it in your browser.

## One-command option

After dependencies are installed, you can launch both with:

```bash
./scripts/run-web-demo.sh
```

This starts the server first, waits for `http://localhost:2567`, then starts the web client.

## Browser smoke test (agent-browser)

To validate the client renders in a real browser automation session:

```bash
./scripts/smoke-web-agent-browser.sh
```

This starts server + web client, opens the app with `agent-browser`, waits for page load, and saves a screenshot to `.tmp-agent-browser/web-react-home.png`.
