import { Room, Client } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import {
  DemoState,
  DemoCardSchema,
  DemoPlayerSchema,
  DemoPlaybackSchema,
  TurnHistoryEntrySchema,
} from "./schema/DemoState.ts";
import {
  UnoCard,
  UnoColor,
  createUnoDeck,
  shuffleDeck,
  getPlayableCards,
  NUM_PLAYERS,
  HAND_SIZE,
} from "../../shared/uno.ts";
import { logger } from "../logger.ts";

export class DemoRoom extends Room<{ state: InstanceType<typeof DemoState> }> {
  private drawPile: UnoCard[] = [];
  private tickTimer?: ReturnType<typeof setTimeout>;
  private currentState!: {
    hands: UnoCard[][];
    discardPile: UnoCard[];
    currentPlayer: number;
    direction: 1 | -1;
    activeColor: UnoColor;
    pendingDraw: number;
    winner: number | null;
  };
  private tickMs = 1000;
  private paused = true;

  onCreate(_options: Record<string, unknown> = {}) {
    this.setState(new DemoState());
    this.state.demo = new DemoPlaybackSchema();
    this.state.demo.phase = "idle";
    this.state.demo.tickMs = 1000;
    this.state.demo.turnCount = 0;
    this.state.demo.winner = -1;
    this.state.turnHistory = new ArraySchema();

    // Initialize 4 bot players
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const player = new DemoPlayerSchema();
      player.sessionId = `bot-${i}`;
      player.seatIndex = i;
      player.name = `Bot ${i + 1}`;
      player.isBot = true;
      player.connected = false;
      player.handCount = 0;
      this.state.players.set(String(i), player);
    }

    this.onMessage("start", (_client: Client) => {
      this.startGame();
    });
    this.onMessage("pause", (_client: Client) => {
      this.pauseGame();
    });
    this.onMessage("resume", (_client: Client) => {
      this.resumeGame();
    });
    this.onMessage("step", (_client: Client) => {
      this.stepOnce();
    });
    this.onMessage("set_speed", (_client: Client, message: { tickMs: number }) => {
      this.tickMs = Math.max(100, Math.min(10000, message.tickMs));
      this.state.demo.tickMs = this.tickMs;
    });

    logger.info("DemoRoom", "Created");
  }

  onJoin(client: Client, _options: Record<string, unknown> = {}) {
    // Assign this client as player 0 (local) so Game.tsx renders their hand face-up.
    // All other players are bots shown face-down.
    const localPlayer = this.state.players.get("0");
    if (localPlayer) {
      localPlayer.sessionId = client.sessionId;
      localPlayer.name = "You (Demo)";
      localPlayer.isBot = false;
      localPlayer.connected = true;
    }
    logger.info("DemoRoom", "Client joined", { sessionId: client.sessionId });
  }

  onLeave(client: Client) {
    logger.info("DemoRoom", "Client left", { sessionId: client.sessionId });
  }

  private startGame() {
    this.paused = false;
    this.state.demo.phase = "running";
    this.state.demo.turnCount = 0;
    this.state.demo.winner = -1;
    this.state.turnHistory = new ArraySchema();

    // Initialize game state
    const deck = shuffleDeck(createUnoDeck());
    this.currentState = {
      hands: Array.from({ length: NUM_PLAYERS }, () => [] as UnoCard[]),
      discardPile: [],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: null,
    };

    // Deal cards
    let deckIdx = 0;
    for (let c = 0; c < HAND_SIZE; c++) {
      for (let p = 0; p < NUM_PLAYERS; p++) {
        this.currentState.hands[p].push(deck[deckIdx++]);
      }
    }

    // Discard pile
    let startIdx = deckIdx;
    while (startIdx < deck.length && deck[startIdx].type === "wild") startIdx++;
    if (startIdx >= deck.length) startIdx = deckIdx;
    const firstCard = deck[startIdx];
    const remaining = [...deck.slice(deckIdx, startIdx), ...deck.slice(startIdx + 1)];
    this.currentState.discardPile.push(firstCard);
    this.drawPile = remaining;
    this.currentState.activeColor = firstCard.type === "color" ? firstCard.color : "red";
    this.currentState.direction = 1;
    this.currentState.currentPlayer = 0;
    this.currentState.pendingDraw = 0;
    this.currentState.winner = null;

    if (firstCard.type === "color") {
      if (firstCard.value === "skip") {
        this.currentState.currentPlayer = 1;
      } else if (firstCard.value === "reverse") {
        this.currentState.direction = -1;
        this.currentState.currentPlayer = NUM_PLAYERS - 1;
      }
    }

    // Sync initial state
    this.syncState();
    this.recordHistory("start", "", "");
    this.scheduleTick();
    logger.info("DemoRoom", "Game started");
  }

  private pauseGame() {
    this.paused = true;
    this.state.demo.phase = "paused";
    clearTimeout(this.tickTimer);
  }

  private resumeGame() {
    this.paused = false;
    this.state.demo.phase = "running";
    this.scheduleTick();
  }

  private stepOnce() {
    if (this.paused) {
      this.tick();
    }
  }

  private scheduleTick() {
    this.tickTimer = setTimeout(() => {
      if (!this.paused) {
        this.tick();
        if (!this.paused) this.scheduleTick();
      }
    }, this.tickMs);
  }

  private tick() {
    if (this.currentState.winner !== null) {
      this.finishGame();
      return;
    }

    const player = this.currentState.currentPlayer;

    // Determine action
    if (this.currentState.pendingDraw > 0) {
      // Forced draw
      const count = this.currentState.pendingDraw;
      for (let i = 0; i < count; i++) {
        this.recycleDiscard();
        if (this.drawPile.length === 0) break;
        this.currentState.hands[player].push(this.drawPile.pop()!);
      }
      this.currentState.pendingDraw = 0;
      this.advancePlayer();
      this.recordHistory("draw", "", "");
    } else {
      const playable = getPlayableCards(
        this.toUnoState(),
        player,
      );
      if (playable.length === 0) {
        // Draw then play if possible, or just draw
        this.recycleDiscard();
        if (this.drawPile.length === 0) {
          this.advancePlayer();
          this.recordHistory("draw", "", "");
        } else {
          const drawn = this.drawPile.pop()!;
          this.currentState.hands[player].push(drawn);
          const canPlayDrawn = playable.some(c => c.id === drawn.id) ||
            (drawn.type === "wild") ||
            (drawn.type === "color" && (drawn.color === this.currentState.activeColor));
          if (canPlayDrawn) {
            this.currentState.discardPile.push(drawn);
            if (drawn.type === "wild") {
              this.currentState.activeColor = this.pickBestColor(this.currentState.hands[player]);
            } else {
              this.currentState.activeColor = drawn.color;
            }
            this.recordHistory("play", drawn.id, this.currentState.activeColor);
          } else {
            this.advancePlayer();
            this.recordHistory("draw", drawn.id, "");
          }
        }
      } else {
        // AI plays best card
        const hand = this.currentState.hands[player];
        const card = this.pickBestCard(playable, hand, this.currentState.activeColor);
        this.currentState.hands[player] = hand.filter(c => c.id !== card.id);
        this.currentState.discardPile.push(card);
        if (card.type === "wild") {
          this.currentState.activeColor = this.pickBestColor(this.currentState.hands[player]);
        } else {
          this.currentState.activeColor = card.color;
        }

        // Apply card effects
        if (card.type === "color") {
          switch (card.value) {
            case "reverse":
              this.currentState.direction = (this.currentState.direction === 1 ? -1 : 1) as 1 | -1;
              this.advancePlayer(1);
              break;
            case "skip":
              this.advancePlayer(1);
              break;
            case "draw2":
              this.currentState.pendingDraw += 2;
              this.advancePlayer();
              break;
            default:
              this.advancePlayer();
          }
        } else {
          if (card.wildType === "wild_draw4") {
            this.currentState.pendingDraw += 4;
          }
          this.advancePlayer();
        }

        this.recordHistory("play", card.id, this.currentState.activeColor);
      }
    }

    // Win check
    if (this.currentState.hands[player].length === 0) {
      this.currentState.winner = player;
    }

    this.state.demo.turnCount++;
    this.syncState();

    if (this.currentState.winner !== null) {
      this.finishGame();
    }
  }

  private pickBestCard(playable: UnoCard[], _hand: UnoCard[], activeColor: UnoColor): UnoCard {
    // Prefer action cards matching color, then number cards, then wilds
    const colorCards = playable.filter(c => c.type === "color" && c.color === activeColor);
    const numberCards = colorCards.filter(c => c.type === "color");
    if (numberCards.length > 0) return numberCards[0];
    if (colorCards.length > 0) {
      const actions = colorCards.filter(c => c.type === "color" && (c as { value: string }).value !== "0");
      if (actions.length > 0) return actions[0];
      return colorCards[0];
    }
    const wilds = playable.filter(c => c.type === "wild");
    return wilds[0] ?? playable[0];
  }

  private pickBestColor(hand: UnoCard[]): UnoColor {
    const counts: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const c of hand) {
      if (c.type === "color") counts[c.color]++;
    }
    let best: UnoColor = "red";
    let bestCount = 0;
    for (const [color, count] of Object.entries(counts)) {
      if (count > bestCount) { bestCount = count; best = color as UnoColor; }
    }
    return best;
  }

  private advancePlayer(skip = 0) {
    let p = this.currentState.currentPlayer;
    for (let i = 0; i <= skip; i++) {
      p = ((p + this.currentState.direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
    }
    this.currentState.currentPlayer = p;
  }

  private recycleDiscard() {
    if (this.drawPile.length === 0 && this.currentState.discardPile.length > 1) {
      const top = this.currentState.discardPile.pop()!;
      this.drawPile = shuffleDeck([top, ...this.currentState.discardPile]);
      this.currentState.discardPile = [];
    }
  }

  private toUnoState() {
    return {
      hands: this.currentState.hands,
      discardPile: this.currentState.discardPile,
      currentPlayer: this.currentState.currentPlayer,
      direction: this.currentState.direction,
      activeColor: this.currentState.activeColor,
      pendingDraw: this.currentState.pendingDraw,
      winner: this.currentState.winner,
      drawPile: this.drawPile,
    };
  }

  private syncState() {
    // Sync players
    for (let p = 0; p < NUM_PLAYERS; p++) {
      const player = this.state.players.get(String(p));
      if (!player) continue;
      player.handCount = this.currentState.hands[p].length;

      // Sync hand array for player 0 (local) — Game.tsx needs this for face-up rendering
      if (p === 0) {
        player.hand = new ArraySchema();
        for (const card of this.currentState.hands[p]) {
          const sc = new DemoCardSchema();
          sc.id = card.id;
          if (card.type === "color") {
            sc.cardType = "color";
            sc.color = card.color;
            sc.value = card.value;
            sc.chosenColor = "";
          } else {
            sc.cardType = "wild";
            sc.color = "";
            sc.value = card.wildType;
            sc.chosenColor = card.chosenColor || "";
          }
          player.hand.push(sc);
        }
      }
    }

    // Sync discard pile
    this.state.discardPile = new ArraySchema();
    for (const card of this.currentState.discardPile) {
      const sc = new DemoCardSchema();
      sc.id = card.id;
      if (card.type === "color") {
        sc.cardType = "color";
        sc.color = card.color;
        sc.value = card.value;
        sc.chosenColor = "";
      } else {
        sc.cardType = "wild";
        sc.color = "";
        sc.value = card.wildType;
        sc.chosenColor = card.chosenColor || "";
      }
      this.state.discardPile.push(sc);
    }

    this.state.drawPileCount = this.drawPile.length;
    this.state.currentPlayer = this.currentState.currentPlayer;
    this.state.direction = this.currentState.direction;
    this.state.activeColor = this.currentState.activeColor;
    this.state.pendingDraw = this.currentState.pendingDraw;
    this.state.winner = this.currentState.winner ?? -1;
    this.state.demo.turnCount = this.state.demo.turnCount;
    this.state.demo.winner = this.currentState.winner ?? -1;
  }

  private recordHistory(action: string, cardId: string, chosenColor: string) {
    const entry = new TurnHistoryEntrySchema();
    entry.turn = this.state.demo.turnCount;
    entry.player = this.currentState.currentPlayer;
    entry.action = action;
    entry.cardId = cardId;
    entry.chosenColor = chosenColor;
    entry.timestamp = Date.now();
    entry.handCounts = new ArraySchema();
    for (let p = 0; p < NUM_PLAYERS; p++) {
      entry.handCounts.push(this.currentState.hands[p].length);
    }
    this.state.turnHistory.push(entry);

    // Keep history bounded
    if (this.state.turnHistory.length > 500) {
      this.state.turnHistory.shift();
    }
  }

  private finishGame() {
    this.paused = true;
    this.state.demo.phase = "finished";
    this.state.demo.winner = this.currentState.winner ?? -1;
    this.recordHistory(`win:${this.currentState.winner ?? -1}`, "", "");
    clearTimeout(this.tickTimer);
    logger.info("DemoRoom", "Game finished", { winner: this.currentState.winner });
  }
}
