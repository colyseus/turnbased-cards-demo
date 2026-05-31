# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React client for the UNO demo. The main app lives in `src/main.tsx`, with global styles in `src/index.css`. Static assets and card art are served from `public/`. Shared game logic and schema helpers are imported from the sibling `../shared/` directory, so keep client and server changes aligned when touching gameplay rules.

## Build, Test, and Development Commands
- `npm install` - install dependencies.
- `npm run dev` - start the local Vite dev server.
- `npm run build` - run TypeScript type-checking and create a production bundle.
- `npm run lint` - run `oxlint` across the codebase.
- `npm run format` - rewrite files with `oxfmt`.
- `npm run preview` - serve the production build locally.
- `npm run test:smoke` - run the browser smoke script in `../scripts/smoke-web-agent-browser.sh`; the game server should be running on port `2567`.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode enabled. Prefer functional React components, explicit types for state and schema objects, and keep imports organized. Follow the existing naming pattern: PascalCase for components/types, camelCase for variables/functions, and `*.tsx` for UI modules. Formatting is handled by `oxfmt`; lint issues should be resolved with `oxlint` rather than suppressed unless a browser/API quirk requires a targeted exception.

## Testing Guidelines
There is no dedicated unit-test suite in this client. Treat `npm run build`, `npm run lint`, and `npm run test:smoke` as the required verification path for meaningful changes. When adding behavior, validate the relevant interaction manually in the browser and prefer clear testable states over implicit UI behavior.

## Commit & Pull Request Guidelines
Recent commits use short conventional prefixes such as `feat:`, `fix:`, and `chore:` with an optional scope, for example `feat(GameScene): ...`. Keep commit messages imperative and focused on one change. Pull requests should summarize the user-visible impact, call out any server/shared changes, and include screenshots or short screen recordings for UI work. Note the commands you ran for verification.

## Configuration Notes
The client reads `VITE_WS_URL` and defaults to `ws://localhost:2567`. Update environment-specific values locally rather than hard-coding them into source files.
