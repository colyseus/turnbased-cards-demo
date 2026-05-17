# Production Readiness Roadmap

## 1. Client Performance and Rendering
Objective: Eliminate dropped frames, reduce bundle/asset size, and stop unnecessary React re-renders.

*   Implement Texture Atlases: Refactor Preloader to load a single texture atlas for all cards instead of ~55 individual PNG requests. Update Card UV mapping.
*   Utilize InstancedMesh: Refactor Game and Card to use Three.js InstancedMesh for rendering cards. This will drastically reduce draw calls, especially in large games or when the deck is rendered.
*   Refactor React State Management: Break Game down into smaller, memoized components that subscribe only to specific slices of the Colyseus state.
*   Asset Compression: Compress audio and 3D assets to minimize initial load time.

## 2. Server Scalability and Architecture
Objective: Handle high concurrent user loads gracefully without state sync lag or dropped connections.

*   Advanced Matchmaking Queue: Replace the basic room join logic with a proper matchmaking queue using Colyseus's Matchmaker to group players by ELO/skill or region.
*   Comprehensive Rate Limiting: Extend rate limiting in UnoRoom beyond card plays to include chat messages, UNO calls, and join attempts to prevent spam/DoS.
*   Horizontal Scaling Validation: Verify and document the Redis presence setup for multi-process/multi-node deployments.
*   State View Optimization: Audit UnoRoomState to ensure StateView is maximizing bandwidth savings for private player hands.

## 3. Observability and Monitoring
Objective: Gain deep visibility into server health, client errors, and game metrics.

*   Production Logging: Replace the custom console logger with a production-grade structured logger like Pino or Winston, outputting JSON for easy ingestion.
*   Metrics Export: Implement a /metrics endpoint using prom-client to export Colyseus room counts, active users, memory usage, and game duration to Prometheus.
*   Client Error Tracking: Integrate Sentry or similar into the web client to catch unhandled exceptions and React render boundaries.

## 4. Quality Assurance and Security
Objective: Guarantee a bug-free core loop and protect against malicious payloads.

*   Full Game-Loop E2E Tests: Implement multi-player automated game loop testing using agent-browser to validate the full core loop visually and interactively.
*   Strict Payload Validation: Implement robust schema validation on all incoming client messages to prevent malformed data from crashing the room.
*   Anti-Cheat Mechanics: Audit server-side logic to ensure clients cannot infer hidden deck order or opponent cards through memory inspection or network sniffing.
*   Middleware Security: Add Express middleware to the server for basic API protection.