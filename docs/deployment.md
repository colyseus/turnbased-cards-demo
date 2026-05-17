# Server Deployment Guide

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `2567` | Colyseus server port |
| `HUMAN_TURN_TIMEOUT` | `7000` | Human turn timeout in ms |
| `BOT_TURN_DELAY` | `800` | Bot turn delay in ms |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `REDIS_URL` | — | Redis connection URL (e.g. `redis://localhost:6379`) |
| `REDIS_HOST` | — | Redis host (alternative to REDIS_URL) |
| `REDIS_PORT` | `6379` | Redis port (used with REDIS_HOST) |

## Quick Start (Development)

```bash
cd server
npm install
npm run dev   # tsx watch mode
```

## Production Build

```bash
cd server
npm install --production
npm start  # runs tsx src/index.ts (tsx handles TypeScript natively)
```

## Deploying to Fly.io

### 1. Install Fly CLI

```bash
fly auth login
```

### 2. Launch the app

```bash
cd server
fly launch
```

### 3. Set environment secrets

```bash
fly secrets set HUMAN_TURN_TIMEOUT=10000
fly secrets set BOT_TURN_DELAY=500
fly secrets set LOG_LEVEL=info
```

### 4. Deploy

```bash
fly deploy
```

### 5. Scale

```bash
fly scale count 2  # 2 instances for horizontal scaling
```

## Deploying to Railway

1. Connect your GitHub repo to Railway
2. Add a new service pointing to the `server/` directory
3. Set environment variables in the Railway dashboard
4. Deploy

## Redis Adapter (Horizontal Scaling)

For multiple server instances, use the Colyseus Redis adapter:

```bash
npm install @colyseus/redis-adapter
```

```typescript
import { RedisPresence } from "@colyseus/redis-adapter";

gameServer.define("uno", UnoRoom, {
  presence: new RedisPresence({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT) || 6379,
  }),
});
```

## Health Check

The Colyseus server exposes a `/health` endpoint when using `@colyseus/tools`:

```bash
curl http://localhost:2567/health
```

## Web Client Configuration

Set `VITE_WS_URL` to your production server WebSocket URL:

```bash
# .env.production
VITE_WS_URL=wss://your-server.fly.dev
```

Build for production:

```bash
cd web-react
npm install
VITE_WS_URL=wss://your-server.fly.dev npm run build
```
