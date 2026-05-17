import { Room, Client } from "@colyseus/core";
import { StateView, ArraySchema } from "@colyseus/schema";
import { UnoRoomState, PlayerSchema, UnoCardSchema } from "./schema/UnoRoomState.ts";
import {
  UnoCard, UnoColor, UnoValue, WildType,
  createUnoDeck, shuffleDeck, canPlay,
  NUM_PLAYERS, HAND_SIZE,
  pickBestCardSchema, pickBestColorSchema,
} from "../../shared/uno.ts";
import { logger } from "../logger.ts";
import {
  HUMAN_TURN_TIMEOUT_MS,
  BOT_TURN_DELAY_MS,
  ACTION_COOLDOWN_MS,
} from "../../shared/constants.ts";

const VALID_COLORS: readonly UnoColor[] = ["red", "blue", "green", "yellow"];

type RoomState = InstanceType<typeof UnoRoomState>;
type PlayerInstance = InstanceType<typeof PlayerSchema>;
type CardInstance = InstanceType<typeof UnoCardSchema>;

export class UnoRoom extends Room<{ state: RoomState }> {
  private drawPile: UnoCard[] = [];
  private turnTimeout?: ReturnType<typeof setTimeout>;
  /** Seats that were handed to a bot because the current player disconnected. */
  private seatsHandedToBot = new Set<number>();
  /** Clients watching as spectators (no seat). */
  private spectators = new Set<Client>();
  /** Guard flag: prevents botTurn from firing during an active human turn action. */
  private turnActionActive = false;
  /** Rate limiting: sessionId → timestamp of last game action (ms). */
  private lastActionTime = new Map<string, number>();
  /** Bot difficulty: "easy" | "medium" | "hard" */
  private difficulty: "easy" | "medium" | "hard" = "medium";
  /** Optional room password. */
  private password?: string;
  /** Card counting: tracks how many cards of each color/value have been discarded */
  private discardedCounts: Record<string, number> = {};

  onCreate(options: { private?: boolean; difficulty?: string; password?: string } = {}) {
    try {
      // Spectators don't count toward maxClients — they can always join
      this.maxClients = 256;
      if (options.private) this.setPrivate();
      if (options.password && typeof options.password === "string" && options.password.length <= 32) {
        this.password = options.password;
      }
      if (options.difficulty === "easy" || options.difficulty === "hard") {
        this.difficulty = options.difficulty;
      }
      this.setState(new UnoRoomState());

      this.state.phase = "waiting";
      this.state.winner = -1;
      this.state.direction = 1;
      this.state.spectatorCount = 0;
      this.state.chatMessages = new ArraySchema();
      this.state.unoCaller = -1;

      // Fill all seats with bots
      for (let i = 0; i < NUM_PLAYERS; i++) {
        const player = new PlayerSchema();
        player.sessionId = `bot-${i}`;
        player.seatIndex = i;
        player.name = `Bot ${i + 1}`;
        player.isBot = true;
        player.connected = false;
        player.handCount = 0;
        this.state.players.set(String(i), player);
      }

      // Deal and start
      this.dealGame();
      this.state.phase = "playing";
      this.scheduleTurn();

      logger.info("UnoRoom", "Game started", { roomId: this.roomId });

      // Message handlers
      this.onMessage("play_card", (client: Client, message: { cardId: string; chosenColor?: string }) => {
        this.handlePlayCard(client, message);
      });

      this.onMessage("draw_card", (client: Client) => {
        this.handleDrawCard(client);
      });

      this.onMessage("restart", (client: Client) => {
        this.handleRestart(client);
      });

      this.onMessage("chat", (client: Client, message: { text?: unknown }) => {
        this.handleChat(client, message);
      });

      this.onMessage("uno", (client: Client) => {
        this.handleUno(client);
      });
    } catch (err) {
      logger.error("UnoRoom", "onCreate failed", { error: String(err) });
      throw err;
    }
  }

  onJoin(client: Client, options: { name?: string; spectator?: boolean; password?: string }) {
    try {
      // Validate password first
      if (this.password && options?.password !== this.password) {
        throw new Error("Invalid password");
      }

      // Spectator join — watch without taking a seat
      if (options?.spectator) {
        this.spectators.add(client);
        this.state.spectatorCount = this.spectators.size;
        logger.info("UnoRoom", "Spectator joined", { sessionId: client.sessionId });
        return;
      }

      // Find a bot seat to replace
      const botPlayer = this.findBotSeat();
      if (!botPlayer) return;

      const takingAbandonedSeat = this.seatsHandedToBot.has(botPlayer.seatIndex);
      if (takingAbandonedSeat) {
        this.seatsHandedToBot.delete(botPlayer.seatIndex);
      }

      // Replace bot with human (keep hand intact)
      botPlayer.sessionId = client.sessionId;
      botPlayer.name = options?.name || "Player";
      botPlayer.isBot = false;
      botPlayer.connected = true;

      // Set up StateView — player can see their own hand
      client.view = new StateView();
      client.view.add(botPlayer);

      // If all seats are human, lock (spectators don't count toward locking)
      let allHuman = true;
      this.state.players.forEach((p: PlayerInstance) => {
        if (p.isBot) allHuman = false;
      });
      if (allHuman) this.lock();

      // Only schedule a turn if a NEW player is taking over a seat that was
      // abandoned by the current player. A player returning to their own seat
      // (takingAbandonedSeat=true but botPlayer is already the current player)
      // should NOT reset the deadline — their turn continues as-is.
      if (takingAbandonedSeat && botPlayer.seatIndex !== this.state.currentPlayer) {
        this.scheduleTurn();
      }

      logger.info("UnoRoom", "Player joined", {
        sessionId: client.sessionId,
        seatIndex: botPlayer.seatIndex,
        name: botPlayer.name,
        takingAbandonedSeat,
      });
    } catch (err) {
      logger.error("UnoRoom", "onJoin failed", { error: String(err) });
      throw err;
    }
  }

  async onLeave(client: Client) {
    try {
      // Handle spectator leaving
      if (this.spectators.has(client)) {
        this.spectators.delete(client);
        this.state.spectatorCount = this.spectators.size;
        logger.info("UnoRoom", "Spectator left", { sessionId: client.sessionId });
        return;
      }

      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      const wasCurrentPlayer = this.state.currentPlayer === player.seatIndex;

      // Convert back to bot
      player.sessionId = `bot-${player.seatIndex}`;
      player.name = `Bot ${player.seatIndex + 1}`;
      player.isBot = true;
      player.connected = false;

      // Unlock so others can join
      this.unlock();

      // If it was this player's turn, mark the seat as handed-to-bot so
      // onJoin can distinguish a returning player from a new takeover.
      if (wasCurrentPlayer) {
        this.seatsHandedToBot.add(player.seatIndex);
        this.scheduleTurn();
      }

      // Clean up StateView to prevent memory leaks
      client.view = undefined;

      logger.info("UnoRoom", "Player left", {
        sessionId: client.sessionId,
        seatIndex: player.seatIndex,
        wasCurrentPlayer,
      });
    } catch (err) {
      logger.error("UnoRoom", "onLeave failed", { error: String(err) });
    }
  }

  onDispose() {
    clearTimeout(this.turnTimeout);
  }

  // ── Helpers ───────────────────────────────────────────────────

  /** Returns true if the client should be rate-limited. Updates last-action time. */
  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const last = this.lastActionTime.get(sessionId) ?? 0;
    if (now - last < ACTION_COOLDOWN_MS) return true;
    this.lastActionTime.set(sessionId, now);
    return false;
  }

  private findBotSeat(): PlayerInstance | null {
    let found: PlayerInstance | null = null;
    this.state.players.forEach((player: PlayerInstance) => {
      if (player.isBot && found === null) found = player;
    });
    return found;
  }

  private findPlayerBySession(sessionId: string): PlayerInstance | null {
    let found: PlayerInstance | null = null;
    this.state.players.forEach((p: PlayerInstance) => {
      if (p.sessionId === sessionId) found = p;
    });
    return found;
  }

  private getPlayerBySeat(seatIndex: number): PlayerInstance {
    return this.state.players.get(String(seatIndex))!;
  }

  private nextPlayer(skip = 0): number {
    let p = this.state.currentPlayer;
    for (let i = 0; i <= skip; i++) {
      p = ((p + this.state.direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
    }
    return p;
  }

  /** Find the Client for a human player (by sessionId). */
  private getClientForPlayer(player: PlayerInstance): Client | undefined {
    if (player.isBot) return undefined;
    return this.clients.find((c: Client) => c.sessionId === player.sessionId);
  }

  /**
   * Push a card to a player's hand AND register it with the client's
   * StateView so it stays visible. Without this, new Schema instances
   * added to a `view: true` array after the initial view.add() are
   * invisible to the client.
   */
  private pushCardToHand(player: PlayerInstance, card: UnoCard) {
    const schemaCard = this.createCardSchema(card);
    player.hand.push(schemaCard);

    const client = this.getClientForPlayer(player);
    if (client?.view) {
      client.view.add(schemaCard);
    }
  }

  private createCardSchema(card: UnoCard): CardInstance {
    const c = new UnoCardSchema();
    c.id = card.id;
    if (card.type === "color") {
      c.cardType = "color";
      c.color = card.color;
      c.value = card.value;
      c.chosenColor = "";
    } else {
      c.cardType = "wild";
      c.color = "";
      c.value = card.wildType;
      c.chosenColor = card.chosenColor || "";
    }
    return c;
  }

  private toPlainCard(schema: CardInstance): UnoCard {
    if (schema.cardType === "color") {
      return {
        type: "color",
        color: schema.color as UnoColor,
        value: schema.value as UnoValue,
        id: schema.id,
      };
    } else {
      return {
        type: "wild",
        wildType: schema.value as WildType,
        chosenColor: (schema.chosenColor || null) as UnoColor | null,
        id: schema.id,
      };
    }
  }

  private playerCanAct(): boolean {
    if (this.state.pendingDraw > 0) return false;
    const player = this.getPlayerBySeat(this.state.currentPlayer);
    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    if (!topDiscard) return false;
    for (let i = 0; i < player.hand.length; i++) {
      if (canPlay(player.hand[i], topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) return true;
    }
    return false;
  }

  // ── Game Logic ────────────────────────────────────────────────

  private dealGame() {
    const deck = shuffleDeck(createUnoDeck());

    let idx = 0;
    for (let c = 0; c < HAND_SIZE; c++) {
      for (let p = 0; p < NUM_PLAYERS; p++) {
        const player = this.getPlayerBySeat(p);
        this.pushCardToHand(player, deck[idx++]);
      }
    }

    // Update hand counts
    for (let p = 0; p < NUM_PLAYERS; p++) {
      const player = this.getPlayerBySeat(p);
      player.handCount = player.hand.length;
    }

    // Find first non-wild card for discard pile
    let startIdx = idx;
    while (startIdx < deck.length && deck[startIdx].type === "wild") startIdx++;
    if (startIdx >= deck.length) startIdx = idx;

    const firstCard = deck[startIdx];
    const remaining = [...deck.slice(idx, startIdx), ...deck.slice(startIdx + 1)];

    this.state.discardPile.push(this.createCardSchema(firstCard));

    // Server-only draw pile
    this.drawPile = remaining;
    this.state.drawPileCount = this.drawPile.length;

    // Active color
    this.state.activeColor = firstCard.type === "color" ? firstCard.color : "red";

    // First card effects
    let currentPlayer = 0;
    let direction = 1;

    if (firstCard.type === "color") {
      if (firstCard.value === "skip") {
        currentPlayer = 1;
      } else if (firstCard.value === "reverse") {
        direction = -1;
        currentPlayer = NUM_PLAYERS - 1;
      }
    }

    this.state.currentPlayer = currentPlayer;
    this.state.direction = direction;
    this.state.pendingDraw =
      firstCard.type === "color" && firstCard.value === "draw2" ? 2 : 0;
    this.state.winner = -1;
  }

  private scheduleTurn() {
    clearTimeout(this.turnTimeout);

    if (this.state.phase !== "playing" || this.state.winner !== -1) return;

    const player = this.getPlayerBySeat(this.state.currentPlayer);
    const canAct = this.playerCanAct();
    const timeout = Number(process.env.HUMAN_TURN_TIMEOUT) || HUMAN_TURN_TIMEOUT_MS;
    const botDelay = Number(process.env.BOT_TURN_DELAY) || BOT_TURN_DELAY_MS;
    const delay = (!canAct || player.isBot) ? botDelay : timeout;

    this.state.turnDeadline = Date.now() + delay;

    this.turnTimeout = setTimeout(() => {
      try {
        this.botTurn();
      } catch (err) {
        logger.error("UnoRoom", "botTurn failed", { error: String(err) });
      }
    }, delay);
  }

  private recycleDiscardIfNeeded() {
    if (this.drawPile.length > 0) return;

    const discardLen = this.state.discardPile.length;
    if (discardLen <= 1) return;

    // Remove all but the last card (top of discard)
    const removed = this.state.discardPile.splice(0, discardLen - 1);

    // Convert to plain cards and shuffle
    const recycled: UnoCard[] = [];
    for (let i = 0; i < removed.length; i++) {
      recycled.push(this.toPlainCard(removed[i]));
    }
    for (let i = recycled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [recycled[i], recycled[j]] = [recycled[j], recycled[i]];
    }

    this.drawPile = recycled;
    this.state.drawPileCount = this.drawPile.length;
  }

  private drawCards(player: PlayerInstance, count: number) {
    for (let i = 0; i < count; i++) {
      this.recycleDiscardIfNeeded();
      if (this.drawPile.length === 0) break;

      const card = this.drawPile.pop()!;
      this.pushCardToHand(player, card);
    }
    player.handCount = player.hand.length;
    this.state.drawPileCount = this.drawPile.length;
  }

  private executePlayCard(
    player: PlayerInstance,
    cardIndex: number,
    chosenColor?: UnoColor,
  ) {
    this.turnActionActive = true;
    try {
    const card = player.hand[cardIndex];

    // Clone card data for discard pile
    const discardCard = new UnoCardSchema();
    discardCard.id = card.id;
    discardCard.cardType = card.cardType;
    discardCard.color = card.color;
    discardCard.value = card.value;

    // Set chosen color for wild cards
    if (discardCard.cardType === "wild") {
      discardCard.chosenColor = chosenColor || "red";
      this.state.activeColor = discardCard.chosenColor;
    } else {
      discardCard.chosenColor = "";
      this.state.activeColor = discardCard.color;
    }

    // Remove from hand
    const wasUnoCaller = this.state.unoCaller === player.seatIndex;
    player.hand.splice(cardIndex, 1);
    player.handCount = player.hand.length;

    // UNO penalty: if this player was supposed to call UNO but didn't
    if (wasUnoCaller) {
      this.drawCards(player, 2);
      this.state.unoCaller = -1;
    }

    // Mark player as needing to call UNO when they reach 1 card
    // Bots auto-call UNO (clear immediately), humans must send "uno" message
    if (player.hand.length === 1) {
      this.state.unoCaller = player.isBot ? -1 : player.seatIndex;
    }

    // Add to discard pile
    this.state.discardPile.push(discardCard);

    // Track discarded cards for card counting (hard difficulty)
    const countKey = discardCard.cardType === "color" ? discardCard.color : discardCard.value;
    this.discardedCounts[countKey] = (this.discardedCounts[countKey] || 0) + 1;

    // Check win
    if (player.hand.length === 0) {
      this.state.winner = player.seatIndex;
      logger.info("UnoRoom", "Game finished", {
        winnerSeat: player.seatIndex,
        winnerName: player.name,
        seatIndex: player.seatIndex,
      });
      this.state.phase = "finished";
      clearTimeout(this.turnTimeout);
      // Reset flag before the finally runs
      this.turnActionActive = false;
      return;
    }

    // Apply effects
    if (discardCard.cardType === "color") {
      switch (discardCard.value) {
        case "reverse":
          this.state.direction = this.state.direction === 1 ? -1 : 1;
          this.state.currentPlayer = this.nextPlayer();
          break;
        case "skip":
          this.state.currentPlayer = this.nextPlayer(1);
          break;
        case "draw2":
          this.state.pendingDraw += 2;
          this.state.currentPlayer = this.nextPlayer();
          break;
        default:
          this.state.currentPlayer = this.nextPlayer();
      }
    } else {
      if (discardCard.value === "wild_draw4") {
        this.state.pendingDraw += 4;
      }
      this.state.currentPlayer = this.nextPlayer();
    }

    this.scheduleTurn();
    } finally {
      this.turnActionActive = false;
    }
  }

  private botTurn() {
    if (this.state.phase !== "playing" || this.state.winner !== -1) return;
    // Guard: if a human turn action is in progress, abort this scheduled call.
    if (this.turnActionActive) return;

    const player = this.getPlayerBySeat(this.state.currentPlayer);

    // Must draw if pending
    if (this.state.pendingDraw > 0) {
      this.drawCards(player, this.state.pendingDraw);
      this.state.pendingDraw = 0;
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
      return;
    }

    // Find playable cards
    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    const playable: number[] = [];
    for (let i = 0; i < player.hand.length; i++) {
      if (canPlay(player.hand[i], topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) {
        playable.push(i);
      }
    }

    if (playable.length === 0) {
      // Draw 1 card, skip turn
      this.drawCards(player, 1);
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
      return;
    }

    // Pick card based on difficulty
    let cardIndex: number;
    if (this.difficulty === "easy") {
      // Random playable card
      cardIndex = playable[Math.floor(Math.random() * playable.length)];
    } else {
      // Medium / Hard: strategic card selection
      const topCardValue = topDiscard.cardType === "color" ? topDiscard.value : undefined;
      cardIndex = pickBestCardSchema(playable, player.hand as unknown as { cardType: string; color: string; value: string; id: string }[], this.state.activeColor as UnoColor);
    }
    const card = player.hand[cardIndex];

    // Choose color for wild cards
    let chosenColor: UnoColor | undefined;
    if (card.cardType === "wild") {
      if (this.difficulty === "easy") {
        const colors: UnoColor[] = ["red", "blue", "green", "yellow"];
        chosenColor = colors[Math.floor(Math.random() * colors.length)];
      } else {
        // Medium and hard use strategic selection; hard additionally considers card depletion
        chosenColor = pickBestColorSchema(
          player.hand as unknown as { cardType: string; color: string; value: string }[],
          topDiscard.cardType === "color" ? topDiscard.value : undefined,
          this.difficulty === "hard" ? this.discardedCounts : undefined,
        );
      }
    }

    this.executePlayCard(player, cardIndex, chosenColor);
  }

  // ── Message Handlers ──────────────────────────────────────────

  private handlePlayCard(
    client: Client,
    message: { cardId: string; chosenColor?: string },
  ) {
    try {
      const { cardId, chosenColor } = message;

      // Input validation
      if (typeof cardId !== "string" || cardId.length > 64) return;

      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      // Rate limit
      if (this.checkRateLimit(client.sessionId)) return;

      // Validate turn
      if (this.state.currentPlayer !== player.seatIndex) return;
      if (this.state.winner !== -1) return;
      if (this.state.pendingDraw > 0) return;

      // Validate chosenColor
      if (chosenColor !== undefined && !VALID_COLORS.includes(chosenColor as UnoColor)) return;

      // Find card in hand
      let cardIndex = -1;
      for (let i = 0; i < player.hand.length; i++) {
        if (player.hand[i].id === cardId) {
          cardIndex = i;
          break;
        }
      }
      if (cardIndex === -1) return;

      const card = player.hand[cardIndex];
      const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];

      // Validate playability
      if (!canPlay(card, topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) return;

      // Wild Draw Four rule: player may only play wild_draw4 if they have NO
      // other valid options (no color cards matching activeColor, no cards
      // matching the top card's value, and no stacking option). This must
      // be enforced server-side.
      if (card.cardType === "wild" && card.value === "wild_draw4") {
        const hasMatchingColor = player.hand.some(
          (c) => c.cardType === "color" && c.color === this.state.activeColor,
        );
        const hasMatchingValue =
          topDiscard.cardType === "color" &&
          player.hand.some(
            (c) => c.cardType === "color" && c.value === topDiscard.value,
          );
        // If pendingDraw > 0, draw4 stacking is a valid option
        const canStack = this.state.pendingDraw >= 4;
        if ((hasMatchingColor || hasMatchingValue) && !canStack) return;
      }

      this.executePlayCard(player, cardIndex, chosenColor as UnoColor | undefined);
    } catch (err) {
      logger.error("UnoRoom", "handlePlayCard failed", { error: String(err) });
    }
  }

  private handleDrawCard(client: Client) {
    try {
      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      // Rate limit
      if (this.checkRateLimit(client.sessionId)) return;

      if (this.state.currentPlayer !== player.seatIndex) return;
      if (this.state.winner !== -1) return;

      const count = this.state.pendingDraw > 0 ? this.state.pendingDraw : 1;
      this.drawCards(player, count);
      this.state.pendingDraw = 0;
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
    } catch (err) {
      logger.error("UnoRoom", "handleDrawCard failed", { error: String(err) });
    }
  }

  private handleRestart(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    // Only allow restart when game is finished, or during play if all bots (dev mode)
    if (this.state.phase !== "finished") {
      // During play, only restartable by a connected human
      if (!player.connected) return;
    }

    clearTimeout(this.turnTimeout);
    this.seatsHandedToBot.clear();

    // Clear all hands and discard pile
    this.state.players.forEach((player: PlayerInstance) => {
      player.hand.splice(0, player.hand.length);
      player.handCount = 0;
    });
    this.state.discardPile.splice(0, this.state.discardPile.length);
    this.discardedCounts = {};
    this.state.unoCaller = -1;
    // Re-deal
    this.dealGame();
    this.state.phase = "playing";
    this.scheduleTurn();
  }

  private handleChat(client: Client, message: { text?: unknown }) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!text || text.length > 200) return;
    const chatMsg = { sender: player.name, text, timestamp: Date.now() };
    this.state.chatMessages.push(chatMsg as any);
    // Keep last 50 messages
    if (this.state.chatMessages.length > 50) {
      this.state.chatMessages.splice(0, this.state.chatMessages.length - 50);
    }
  }

  private handleUno(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    // Only the player who must call UNO can do so
    if (this.state.unoCaller === player.seatIndex) {
      this.state.unoCaller = -1;
    }
  }
}
