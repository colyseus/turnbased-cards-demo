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
  canPlay,
  getPlayableCards,
  NUM_PLAYERS,
  HAND_SIZE,
} from "../../shared/uno.ts";
import { pickBestPlayableCard, populateSchemaCard } from "../../../shared/gameLogic.ts";
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
    clearTimeout(this.tickTimer);
    this.tickTimer = undefined;
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
    this.tickTimer = undefined;
  }

  private resumeGame() {
    if (!this.paused) return;
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
    clearTimeout(this.tickTimer);
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
    const topDiscard = this.currentState.discardPile[this.currentState.discardPile.length - 1];
    const topCardValue = topDiscard.type === "color" ? topDiscard.value : undefined;

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
      this.recordHistory("draw", "", "", player);
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
          const canPlayDrawn = canPlay(
            drawn,
            topDiscard,
            this.currentState.activeColor,
            this.currentState.pendingDraw,
          );
          if (canPlayDrawn) {
            if (drawn.type === "wild") {
              const chosenColor = this.pickBestColor(this.currentState.hands[player]);
              drawn.chosenColor = chosenColor;
              this.currentState.activeColor = chosenColor;
            } else {
              this.currentState.activeColor = drawn.color;
            }
            this.currentState.discardPile.push(drawn);
            this.applyCardEffects(drawn);
            this.recordHistory("play", drawn.id, this.currentState.activeColor, player);
          } else {
            this.currentState.hands[player].push(drawn);
            this.advancePlayer();
            this.recordHistory("draw", drawn.id, "", player);
          }
        }
      } else {
        // AI plays best card
        const hand = this.currentState.hands[player];
        const card = pickBestPlayableCard(playable, this.currentState.activeColor, topCardValue);
        this.currentState.hands[player] = hand.filter(c => c.id !== card.id);
        if (card.type === "wild") {
          const chosenColor = this.pickBestColor(this.currentState.hands[player]);
          card.chosenColor = chosenColor;
          this.currentState.activeColor = chosenColor;
        } else {
          this.currentState.activeColor = card.color;
        }
        this.currentState.discardPile.push(card);

        this.applyCardEffects(card);
        this.recordHistory("play", card.id, this.currentState.activeColor, player);
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

  private applyCardEffects(card: UnoCard) {
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
      return;
    }

    if (card.wildType === "wild_draw4") {
      this.currentState.pendingDraw += 4;
    }
    this.advancePlayer();
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
      const top = this.currentState.discardPile[this.currentState.discardPile.length - 1];
      const recycled = this.currentState.discardPile.slice(0, -1);
      this.drawPile = shuffleDeck(recycled);
      this.currentState.discardPile = [top];
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
        player.hand = new ArraySchema(
          ...this.currentState.hands[p].map((card) => populateSchemaCard(new DemoCardSchema(), card)),
        );
      }
    }

    // Sync discard pile
    this.state.discardPile = new ArraySchema(
      ...this.currentState.discardPile.map((card) => populateSchemaCard(new DemoCardSchema(), card)),
    );

    this.state.drawPileCount = this.drawPile.length;
    this.state.currentPlayer = this.currentState.currentPlayer;
    this.state.direction = this.currentState.direction;
    this.state.activeColor = this.currentState.activeColor;
    this.state.pendingDraw = this.currentState.pendingDraw;
    this.state.winner = this.currentState.winner ?? -1;
    this.state.demo.winner = this.currentState.winner ?? -1;
  }

  private recordHistory(action: string, cardId: string, chosenColor: string, player = this.currentState.currentPlayer) {
    const entry = new TurnHistoryEntrySchema();
    entry.turn = this.state.demo.turnCount;
    entry.player = player;
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
    this.recordHistory(`win:${this.currentState.winner ?? -1}`, "", "", this.currentState.winner ?? -1);
    clearTimeout(this.tickTimer);
    this.tickTimer = undefined;
    logger.info("DemoRoom", "Game finished", { winner: this.currentState.winner });
  }

  onDispose() {
    clearTimeout(this.tickTimer);
    this.tickTimer = undefined;
  }
}
