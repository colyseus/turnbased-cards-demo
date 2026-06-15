# Scaling with Redis Presence

This document covers horizontal scaling of the Colyseus game server using
`@colyseus/redis-presence` for multi-process and multi-node deployments.

## Why Redis Presence?

By default, Colyseus uses in-memory presence. Each server process maintains its
own isolated view of connected clients and room state. When you run multiple
processes (for load distribution or multi-node deployment), clients connected to
different processes **cannot see each other's rooms or matchmaker state**.

`RedisPresence` replaces the in-memory store with a shared Redis instance,
giving all processes a consistent view of rooms, matchmaking, and client
presence.

## Deployment Topology

```
                    ┌─────────────────┐
                    │     Redis       │
                    │   (Presence)    │
                    │   redis://...   │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
      ┌────▼─────┐      ┌────▼─────┐      ┌────▼─────┐
      │ Process 1│      │ Process 2│      │ Process 3│
      │ (Colyseus)│     │ (Colyseus)│     │ (Colyseus)│
      │  :2567   │      │  :2568   │      │  :2569   │
      └────┬─────┘      └────┬─────┘      └────┬─────┘
           │                 │                 │
      ┌────▼─────┐      ┌────▼─────┐      ┌────▼─────┐
      │  Load    │      │          │      │          │
      │ Balancer │──────┤──────────┤──────┤          │
      │ (nginx / │      WebSocket clients │          │
      │ Traefik) │                       │          │
      └──────────┘                       └──────────┘
```

- **Redis** holds the shared presence data: which clients are connected, which
  rooms exist, and matchmaker state.
- **Each Colyseus process** connects to the same Redis instance and publishes/
  subscribes to presence channels.
- A **load balancer** distributes incoming WebSocket connections across processes.
  It must support WebSocket upgrade (e.g. nginx `proxy_pass` with
  `proxy_http_version 1.1` and `proxy_set_header Upgrade`).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | — | Full Redis URL. Format: `redis://host:port` |
| `REDIS_HOST` | No | — | Redis hostname. Used when `REDIS_URL` is not set. |
| `REDIS_PORT` | No | `6379` | Redis port. Used with `REDIS_HOST`. |

**Resolution order** (in `server/src/app.config.ts`):

1. If `REDIS_URL` is set, it is parsed for `hostname` and `port`.
2. If `REDIS_URL` is missing or invalid, `REDIS_HOST` + `REDIS_PORT` are used.
3. If neither is set, no presence is created — the server runs in single-process
   mode with in-memory presence.

**Examples:**

```bash
# Using REDIS_URL
REDIS_URL=redis://localhost:6379 npm start

# Using REDIS_HOST + REDIS_PORT
REDIS_HOST=redis.internal REDIS_PORT=6379 npm start

# Single-process mode (no Redis needed)
npm start
```

## Setup

### 1. Start Redis

```bash
# Local development
redis-server

# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 2. Set environment variables

```bash
export REDIS_URL=redis://localhost:6379
```

### 3. Start multiple processes

```bash
# Process 1
PORT=2567 REDIS_URL=redis://localhost:6379 npm start

# Process 2
PORT=2568 REDIS_URL=redis://localhost:6379 npm start
```

### 4. Configure a load balancer (nginx example)

```nginx
upstream colyseus {
    server 127.0.0.1:2567;
    server 127.0.0.1:2568;
}

server {
    listen 80;

    location / {
        proxy_pass http://colyseus;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## What Redis Presence Does

When `RedisPresence` is active, the following operations go through Redis
instead of local memory:

| Operation | In-Memory | Redis Presence |
|-----------|-----------|----------------|
| Client connect/disconnect tracking | Local process | Redis pub/sub |
| Room listing (matchmaker) | Local process | Redis hash |
| Client-to-room mapping | Local process | Redis hash |
| Remote client events | Not available | Cross-process via Redis pub/sub |

This means a player connected to Process 1 can join a room created by a player
on Process 2, and both players see the same game state.

## Failure Modes

### Redis connection drops

| Symptom | What happens | Severity |
|---------|-------------|----------|
| Players on the same process can still play | Game logic runs locally per room | Low |
| Players across processes can't see each other | Matchmaker and presence data diverge | High |
| New room creation may fail silently | Presence writes fail but don't throw | Medium |
| Reconnection to a different process fails | Client presence not found in Redis | High |

**When Redis goes down:**

1. Existing rooms on a single process **continue to work** — game logic is
   local to the room.
2. Cross-process matchmaking **breaks** — the matchmaker can't enumerate rooms
   across processes.
3. Player sessions on different processes **disconnect** — the target process
   can't verify the client's presence.

**Mitigation:**

- Run Redis with **persistence** (AOF or RDB snapshots) so state survives
  restarts.
- Use **Redis Sentinel** or **Redis Cluster** for high availability.
- Monitor Redis with `redis-cli ping` and alert on prolonged failures.
- Consider a **local presence fallback** if your deployment can tolerate
  degraded single-process mode during Redis outages.

### Redis is slow (high latency)

| Symptom | What happens | Severity |
|---------|-------------|----------|
| Matchmaking takes longer | Room listing queries are delayed | Medium |
| Player join/leave events lag | Pub/sub delivery is delayed | Medium |
| Overall throughput drops | Presence operations block | High |

**Mitigation:**

- Use a Redis instance with sufficient memory and CPU.
- Keep Redis and game servers in the **same network region** (low RTT).
- Monitor `redis-cli --latency` to track baseline latency.

### Network partition (split-brain)

| Symptom | What happens | Severity |
|---------|-------------|----------|
| Two groups of processes diverge | Each group has its own Redis view | Critical |
| Game state inconsistent across groups | Players in different partitions see different rooms | Critical |

**Mitigation:**

- Deploy Redis in a **replicated configuration** (Sentinel or Cluster).
- Use a single Redis endpoint with automatic failover.
- Avoid spreading game processes across unlinked network zones.

## Monitoring

Track these metrics in production:

| Metric | How to check | Alert threshold |
|--------|-------------|-----------------|
| Redis memory usage | `redis-cli info memory` | > 80% of maxmemory |
| Connected clients | `redis-cli info clients` | Anomalous spikes |
| Redis latency | `redis-cli --latency` | > 5ms average |
| Pub/sub message count | `redis-cli info stats` | Sudden drops |
| Process count | Infrastructure metrics | Fewer than expected |

## Single-Process vs Multi-Process

| Capability | Single-process | Multi-process with Redis |
|-----------|----------------|--------------------------|
| Game logic | Full | Full |
| Matchmaking | Full (local) | Full (cross-process) |
| Player reconnection | Same process only | Any process |
| Load distribution | No | Yes (via load balancer) |
| Redis required | No | Yes |
| Memory overhead | Lower | Higher (Redis + pub/sub) |

## Troubleshooting

**Server starts but players can't find each other:**
- Verify `REDIS_URL` or `REDIS_HOST` is set in all processes.
- Check Redis is running: `redis-cli ping` should return `PONG`.

**"Connection refused" on server start:**
- Redis is not running or not reachable at the configured host/port.
- Check firewall rules if Redis is on a remote host.

**Intermittent disconnects across processes:**
- Redis connection may be flapping. Check `redis-cli monitor` for errors.
- Ensure Redis maxmemory policy is set appropriately (e.g. `noeviction`).

**High memory usage on Redis:**
- Colyseus presence data accumulates. Use `redis-cli dbsize` to monitor.
- Restart Redis periodically in non-HA setups, or use persistence + `MAXMEMORY`.
