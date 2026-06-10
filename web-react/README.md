# UNO Demo - React Web Client

![Screenshot](screenshot.webp)

Web client for [Turn-Based UNO Demo](../README.md) built with [React](https://react.dev/), the [Colyseus TypeScript SDK](https://docs.colyseus.io/getting-started/typescript), CSS card/table rendering, and Vite.

## Setup

```bash
npm install
npm run dev
```

Make sure the [game server](../server/) is running on port 2567.

## Controls

- **Join** - Enter a display name and create a live table.
- **Click a highlighted card** - Select a playable card, then click again to play it.
- **Click the draw deck** - Draw when no card is playable or when drawing is available.
- **UNO** - Toggle UNO before playing your penultimate card.
- **Sort** - Reorder the local hand by color or value.
- **Chat** - Send room messages from the table sidebar.

### Mobile Touch Gestures

- **Swipe a card right** - Play the swiped card immediately.
- **Swipe left on the draw deck** - Draw a card from the deck.

### Lobby Match History

Access match history from the lobby screen. Each entry shows the date, winner, duration, cards played, and opponent list for recent matches. The dashboard is read-only and is persisted in browser storage.

### UNO Call Mechanic

You must call UNO when you play your second-to-last card. A call button appears when you reach two cards — tap it before playing your penultimate card. If you forget and the next player begins their turn, the call window closes automatically and you accept a penalty draw of two cards. The button disappears once the next turn starts.

### Spectator Mode

From the lobby, enter a room ID to spectate an in-progress match without joining. Spectators see all hands and moves in real time but cannot play cards, draw, call UNO, chat, or vote on rematches. Spectators are listed in a separate panel and are visible to active players.

### Private Rooms

To create a private room, enter a room name and set an optional password before starting. Share the room ID and password with friends. To join a private room, enter the room ID and provide the correct password. If the password is incorrect, an error is shown and entry is denied. Private rooms appear in the lobby only to players who know the room ID.

### Bot Difficulty

When adding bots, choose a difficulty level:

- **Easy** - Bots play cards at random from their valid moves.
- **Medium** - Bots use the strategic picker in the server: prioritize reverse/skip cards, then prefer color matches, then value matches, then draw if needed.
- **Hard** - Bots use the strategic picker plus discarded-card counting to bias color choices more aggressively.

### Rematch Flow

After a round ends, a rematch vote button appears for all players. Clicking Vote casts your vote. A counter shows how many votes have been cast out of the total players (e.g., 2/4). When all connected players have voted, the room automatically restarts with the same settings and players. If a player disconnects before all votes are in, the rematch is cancelled.

## Verification

```bash
npm run test:unit
npm run lint
npm run build
npm run test:smoke
```

`npm run test:smoke` exercises desktop and mobile browser sessions through `agent-browser` against a running game server on port `2567`, and writes screenshots to `../.tmp-agent-browser/`. If the environment lacks a display server, run it under `xvfb-run -a`.
