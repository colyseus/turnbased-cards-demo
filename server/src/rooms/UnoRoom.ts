import { Room, Client } from "@colyseus/core";
import { StateView, ArraySchema } from "@colyseus/schema";
import { UnoRoomState, PlayerSchema, UnoCardSchema, ChatMessageSchema } from "./schema/UnoRoomState.ts";
import {
  UnoCard, UnoColor, UnoValue, WildType,
  createUnoDeck, shuffleDeck, canPlay,
  pickBestCardSchema, pickBestColorSchema,
  hasWildDrawFourAlternative, isUnoColor,
} from "../../shared/uno.ts";
import { populateSchemaCard } from "../../../shared/gameLogic.ts";
import { HUMAN_TURN_TIMEOUT_MS, BOT_TURN_DELAY_MS } from "../../shared/constants.ts";
import { NUM_PLAYERS, HAND_SIZE } from "../../shared/uno.ts";
import { logger } from "../logger.ts";
import { RateLimiter } from "../rateLimiter.ts";
import { playCardSchema, chatSchema, validateMessage } from "../schemas/index.ts";

const log = logger.child({ ns: "UnoRoom" });

const VALID_COLORS: readonly UnoColor[] = ["red", "blue", "green", "yellow"];

function sanitizePlainText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

type RoomState = InstanceType<typeof UnoRoomState>;
type PlayerInstance = InstanceType<typeof PlayerSchema>;
type CardInstance = InstanceType<typeof UnoCardSchema>;
type SchemaCardLike = { cardType: string; color: string; value: string; id: string };

export class UnoRoom extends Room<{ state: RoomState }> {
  private drawPile: UnoCard[] = [];
  private turnTimeout?: ReturnType<typeof setTimeout>;
  /** Seats that were handed to a bot because the current player disconnected. */
  private seatsHandedToBot = new Set<number>();
  /** Pending botTurn timeouts keyed by seatIndex — used to cancel on rejoin. */
  private turnCallbacks = new Map<number, ReturnType<typeof setTimeout>>();
  /** Clients watching as spectators (no seat). */
  private spectators = new Set<Client>();
  /** Guard flag: prevents botTurn from firing during an active human turn action. */
  private turnActionActive = false;
  /** Per-message-type rate limiter. */
  private rateLimiter = new RateLimiter();
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

      this.resetRoundActionState();
      this.state.phase = "waiting";
      this.state.winner = -1;
      this.state.direction = 1;
      this.state.spectatorCount = 0;
      this.state.chatMessages = new ArraySchema();

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

      log.info({ roomId: this.roomId }, "Game started");

      // Message handlers
      this.onMessage("play_card", (client: Client, message: unknown) => {
        const result = validateMessage(playCardSchema, message);
        if (!result.ok) {
          client.send("error", { message: "Invalid payload", code: "MESSAGE_REJECTED", details: result.error });
          return;
        }
        this.handlePlayCard(client, result.data);
      });

    this.onMessage("draw_card", (client: Client) => {
      this.handleDrawCard(client);
    });

    this.onMessage("challenge_wild_draw4", (client: Client) => {
      this.handleChallengeWildDraw4(client);
    });

      this.onMessage("restart", (client: Client) => {
        this.handleRestart(client);
      });

      this.onMessage("chat", (client: Client, message: unknown) => {
        const result = validateMessage(chatSchema, message);
        if (!result.ok) {
          client.send("error", { message: "Invalid payload", code: "MESSAGE_REJECTED", details: result.error });
          return;
        }
        this.handleChat(client, result.data);
      });

      this.onMessage("uno", (client: Client) => {
        this.handleUno(client);
      });

      this.onMessage("vote_rematch", (client: Client) => {
        this.handleVoteRematch(client);
      });

      this.onMessage("ping", (client: Client) => {
        client.send("pong");
      });
    } catch (err) {
      log.error({ err }, "onCreate failed");
      throw err;
    }
  }

  onJoin(client: Client, options: { name?: string; spectator?: boolean; password?: string }) {
    try {
      // Rate limit join attempts
      if (this.rateLimiter.check(client.sessionId, "join").allowed === false) {
        throw new Error("Rate limited");
      }

      // Validate password first
      if (this.password && options?.password !== this.password) {
        throw new Error("Invalid password");
      }

      // Spectator join — watch without taking a seat
      if (options?.spectator) {
        this.spectators.add(client);
        this.state.spectatorCount = this.spectators.size;
        log.info({ sessionId: client.sessionId }, "Spectator joined");
        return;
      }

      // Find a bot seat to replace
      const botPlayer = this.findBotSeat();
      if (!botPlayer) return;

      const takingAbandonedSeat = this.seatsHandedToBot.has(botPlayer.seatIndex);
      if (takingAbandonedSeat) {
        this.seatsHandedToBot.delete(botPlayer.seatIndex);
        // Cancel any pending botTurn for this seat (player beat the timer)
        const pending = this.turnCallbacks.get(botPlayer.seatIndex);
        if (pending !== undefined) {
          clearTimeout(pending);
          this.turnCallbacks.delete(botPlayer.seatIndex);
        }
      }

      // Replace bot with human (keep hand intact)
      botPlayer.sessionId = client.sessionId;
      
      let name = "Player";
      if (typeof options?.name === "string") {
        const trimmed = options.name.trim();
        const match = trimmed.match(/^\[av-([a-z0-9]+)-([a-z0-9]+)\](.*)$/);
        if (match) {
          const symbol = match[1];
          const theme = match[2];
          const actualName = match[3].trim();
          const validSymbol = ["tiger", "dragon", "phoenix", "panda", "wolf", "owl", "fox", "shark"].includes(symbol);
          const validTheme = ["rose", "sapphire", "aurora", "sol", "nebula"].includes(theme);
          if (validSymbol && validTheme && actualName.length >= 2 && actualName.length <= 16) {
            name = trimmed;
          }
        } else if (trimmed.length >= 2 && trimmed.length <= 16) {
          name = trimmed;
        }
      }
      botPlayer.name = sanitizePlainText(name) || "Player";
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
      // Additionally, if anyone takes over the current active turn seat, reset
      // the timer to the human turn duration so they have full time to act.
      if (botPlayer.seatIndex === this.state.currentPlayer) {
        this.scheduleTurn();
      } else if (takingAbandonedSeat && botPlayer.seatIndex !== this.state.currentPlayer) {
        this.scheduleTurn();
      }

      log.info({
        sessionId: client.sessionId,
        seatIndex: botPlayer.seatIndex,
        name: botPlayer.name,
        takingAbandonedSeat,
      }, "Player joined");
    } catch (err) {
      log.error({ err }, "onJoin failed");
      throw err;
    }
  }

  async onLeave(client: Client) {
    try {
      // Handle spectator leaving
      if (this.spectators.has(client)) {
        this.spectators.delete(client);
        this.state.spectatorCount = this.spectators.size;
        log.info({ sessionId: client.sessionId }, "Spectator left");
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
        // Store timeout so it can be cancelled if the player rejoins before it fires
        if (this.turnTimeout !== undefined) {
          this.turnCallbacks.set(player.seatIndex, this.turnTimeout);
        }
      }

      if (this.state.phase === "finished" && this.state.rematchVotes.length > 0) {
        this.state.rematchVotes.splice(0, this.state.rematchVotes.length);
      }

      // Clean up StateView to prevent memory leaks
      client.view = undefined;

      log.info({
        sessionId: client.sessionId,
        seatIndex: player.seatIndex,
        wasCurrentPlayer,
      }, "Player left");
    } catch (err) {
      log.error({ err }, "onLeave failed");
    }
  }

  onDispose() {
    clearTimeout(this.turnTimeout);
    for (const timeout of this.turnCallbacks.values()) {
      clearTimeout(timeout);
    }
    this.turnCallbacks.clear();
  }

  // ── Helpers ───────────────────────────────────────────────────

  private resetRoundActionState() {
    this.state.unoCaller = -1;
    this.state.lastDrawnCardId = "";
    this.state.wildDraw4ChallengePending = false;
    this.state.wildDraw4Illegal = false;
    this.state.wildDraw4OffenderSeat = -1;
    this.state.pendingWinnerSeat = -1;
    this.state.rematchVotes = new ArraySchema();
  }

  private checkRateLimit(
    client: Client,
    messageType: "play_card" | "draw_card" | "challenge_wild_draw4" | "chat" | "uno_call" | "join",
  ): boolean {
    const result = this.rateLimiter.check(client.sessionId, messageType);
    if (!result.allowed) {
      client.send("error", {
        message: "Rate limited",
        code: "RATE_LIMITED",
        messageType,
        retryAfterMs: result.retryAfterMs,
      });
      return true;
    }
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
    const schemaCard = populateSchemaCard(new UnoCardSchema(), card);
    player.hand.push(schemaCard);

    const client = this.getClientForPlayer(player);
    if (client?.view) {
      client.view.add(schemaCard);
    }
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

  private schemaHand(player: PlayerInstance): SchemaCardLike[] {
    return Array.from(player.hand, (card) => ({
      id: card.id,
      cardType: card.cardType,
      color: card.color,
      value: card.value,
    }));
  }

  private isWildDraw4Illegal(player: PlayerInstance): boolean {
    return hasWildDrawFourAlternative(this.schemaHand(player), this.state.activeColor as UnoColor);
  }

  private playerCanAct(): boolean {
    const player = this.getPlayerBySeat(this.state.currentPlayer);
    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    if (!topDiscard) return false;
    if (this.state.wildDraw4ChallengePending) return true;
    if (this.state.lastDrawnCardId) {
      const drawnCard = player.hand.find((card) => card.id === this.state.lastDrawnCardId);
      if (!drawnCard) return false;
      if (!canPlay(drawnCard, topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) return false;
      return true;
    }
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      if (!canPlay(card, topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) continue;
      return true;
    }
    return false;
  }

  /**
   * Resolve an overdue UNO call at the start of the next turn.
   *
   * The room protocol expects the next player to draw 2 cards if the prior
   * player fails to clear `unoCaller` before the turn advances.
   */
  private resolvePendingUnoPenalty(): boolean {
    if (this.state.unoCaller === -1) return false;
    if (this.state.currentPlayer === this.state.unoCaller) return false;

    const penalizedSeat = this.state.currentPlayer;
    const penalizedPlayer = this.getPlayerBySeat(penalizedSeat);

    this.drawCards(penalizedPlayer, 2);
    this.state.unoCaller = -1;
    this.state.lastDrawnCardId = "";
    this.state.currentPlayer = this.nextPlayer();

    log.info({
      penalizedSeat,
      nextSeat: this.state.currentPlayer,
    }, "UNO penalty resolved");

    return true;
  }

  private clearWildDraw4Challenge() {
    this.state.wildDraw4ChallengePending = false;
    this.state.wildDraw4Illegal = false;
    this.state.wildDraw4OffenderSeat = -1;
  }

  private resolveWildDraw4Challenge(challengerSeat: number) {
    const offenderSeat = this.state.wildDraw4OffenderSeat;
    if (offenderSeat < 0) return;

    const offender = this.getPlayerBySeat(offenderSeat);
    const challenger = this.getPlayerBySeat(challengerSeat);
    const illegal = this.state.wildDraw4Illegal;

    if (illegal) {
      this.drawCards(offender, 4);
      this.state.currentPlayer = challengerSeat;
      this.state.pendingWinnerSeat = -1;
    } else {
      this.drawCards(challenger, 6);
      this.state.currentPlayer = this.nextPlayer();
    }

    this.state.pendingDraw = 0;
    this.clearWildDraw4Challenge();
    this.finalizePendingWinner();
    if (this.state.phase === "playing" && this.state.winner === -1) {
      this.scheduleTurn();
    }
  }

  private resolveWildDraw4ByDrawing(challengerSeat: number) {
    const challenger = this.getPlayerBySeat(challengerSeat);
    const count = this.state.pendingDraw > 0 ? this.state.pendingDraw : 4;
    this.drawCards(challenger, count);
    this.state.pendingDraw = 0;
    this.clearWildDraw4Challenge();
    this.state.currentPlayer = this.nextPlayer();
    this.finalizePendingWinner();
    if (this.state.phase === "playing" && this.state.winner === -1) {
      this.scheduleTurn();
    }
  }

  private finalizePendingWinner() {
    const pendingWinnerSeat = this.state.pendingWinnerSeat;
    if (pendingWinnerSeat < 0) return;
    if (this.state.pendingDraw > 0) return;
    if (this.state.wildDraw4ChallengePending) return;

    const winnerPlayer = this.getPlayerBySeat(pendingWinnerSeat);
    if (winnerPlayer.hand.length !== 0) {
      this.state.pendingWinnerSeat = -1;
      return;
    }

    this.state.pendingWinnerSeat = -1;
    this.state.winner = pendingWinnerSeat;
    log.info({
      winnerSeat: pendingWinnerSeat,
      winnerName: winnerPlayer.name,
      seatIndex: pendingWinnerSeat,
    }, "Game finished");
    this.state.phase = "finished";
    this.state.rematchVotes.splice(0, this.state.rematchVotes.length);
    clearTimeout(this.turnTimeout);
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

    this.state.discardPile.push(populateSchemaCard(new UnoCardSchema(), firstCard));

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

    if (this.resolvePendingUnoPenalty()) {
      // The penalty consumed the current turn. Continue scheduling for the
      // next seat after the forced draw.
    }

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
        log.error({ err }, "botTurn failed");
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

    // If the player drew cards and hand size is now > 1, they no longer need to call UNO.
    if (player.hand.length > 1 && this.state.unoCaller === player.seatIndex) {
      this.state.unoCaller = -1;
    }
  }

  private executePlayCard(
    player: PlayerInstance,
    cardIndex: number,
    chosenColor?: UnoColor,
    wildDraw4Illegal = false,
  ) {
    this.turnActionActive = true;
    try {
    this.state.lastDrawnCardId = "";
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

    const isPendingPenaltyCard =
      (discardCard.cardType === "color" && discardCard.value === "draw2") ||
      (discardCard.cardType === "wild" && discardCard.value === "wild_draw4");

    // Check win
    if (player.hand.length === 0) {
      if (isPendingPenaltyCard) {
        this.state.pendingWinnerSeat = player.seatIndex;
      } else {
        this.state.winner = player.seatIndex;
        log.info({
          winnerSeat: player.seatIndex,
          winnerName: player.name,
          seatIndex: player.seatIndex,
        }, "Game finished");
        this.state.phase = "finished";
        this.state.rematchVotes.splice(0, this.state.rematchVotes.length);
        clearTimeout(this.turnTimeout);
        // Reset flag before the finally runs
        this.turnActionActive = false;
        return;
      }
    } else {
      this.state.pendingWinnerSeat = -1;
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
        this.state.pendingDraw = 4;
        this.state.wildDraw4ChallengePending = true;
        this.state.wildDraw4Illegal = wildDraw4Illegal;
        this.state.wildDraw4OffenderSeat = player.seatIndex;
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

    if (this.resolvePendingUnoPenalty()) {
      this.scheduleTurn();
      return;
    }

    const player = this.getPlayerBySeat(this.state.currentPlayer);

    if (this.state.lastDrawnCardId) {
      this.state.lastDrawnCardId = "";
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
      return;
    }

    // Must draw if pending
    if (this.state.pendingDraw > 0) {
      this.drawCards(player, this.state.pendingDraw);
      this.state.pendingDraw = 0;
      this.state.currentPlayer = this.nextPlayer();
      this.finalizePendingWinner();
      if (this.state.phase === "playing" && this.state.winner === -1) {
        this.scheduleTurn();
      }
      return;
    }

    if (this.state.wildDraw4ChallengePending) {
      if (player.isBot && this.state.wildDraw4Illegal) {
        this.resolveWildDraw4Challenge(player.seatIndex);
      } else {
        this.resolveWildDraw4ByDrawing(player.seatIndex);
      }
      return;
    }

    // Find playable cards
    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    const playable: number[] = [];
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      if (canPlay(card, topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) {
        playable.push(i);
      }
    }

    if (playable.length === 0) {
      // Draw 1 card. If it is playable, play it immediately; otherwise the turn passes.
      this.drawCards(player, 1);
      const drawnCard = player.hand[player.hand.length - 1];
      if (drawnCard && canPlay(drawnCard, topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) {
        let chosenColor: UnoColor | undefined;
        const wildDraw4Illegal =
          drawnCard.cardType === "wild" && drawnCard.value === "wild_draw4"
            ? this.isWildDraw4Illegal(player)
            : false;
        if (drawnCard.cardType === "wild") {
          chosenColor = pickBestColorSchema(
            this.schemaHand(player),
            topDiscard.cardType === "color" ? topDiscard.value : undefined,
            this.difficulty === "hard" ? this.discardedCounts : undefined,
          );
        }
        this.executePlayCard(player, player.hand.length - 1, chosenColor, wildDraw4Illegal);
        return;
      }
      this.state.currentPlayer = this.nextPlayer();
      this.scheduleTurn();
      return;
    }

      // Pick card based on difficulty
      let cardIndex: number;
      const topCardValue = topDiscard.cardType === "color" ? topDiscard.value : undefined;
      if (this.difficulty === "easy") {
        // Random playable card
        cardIndex = playable[Math.floor(Math.random() * playable.length)];
      } else {
        // Medium / Hard: strategic card selection
        cardIndex = pickBestCardSchema(
          playable,
          this.schemaHand(player),
          this.state.activeColor as UnoColor,
          topCardValue,
        );
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
          this.schemaHand(player),
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

      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      if (this.resolvePendingUnoPenalty()) {
        // The current turn has already advanced because the previous player
        // missed their UNO call, so this action can no longer apply.
        this.scheduleTurn();
      }

      // Rate limit
      if (this.checkRateLimit(client, "play_card")) {
        return;
      }

      // Validate turn
      if (this.state.currentPlayer !== player.seatIndex) {
        client.send("error", { message: "Not your turn", code: "NOT_YOUR_TURN" });
        return;
      }
      if (this.state.winner !== -1) {
        client.send("error", { message: "Game is finished", code: "GAME_FINISHED" });
        return;
      }
      if (this.state.wildDraw4ChallengePending) {
        client.send("error", { message: "Resolve the Wild Draw 4 challenge first", code: "CHALLENGE_PENDING" });
        return;
      }


      // Find card in hand
      let cardIndex = -1;
      for (let i = 0; i < player.hand.length; i++) {
        if (player.hand[i].id === cardId) {
          cardIndex = i;
          break;
        }
      }
      if (cardIndex === -1) {
        client.send("error", { message: "Card not found in hand", code: "CARD_NOT_FOUND" });
        return;
      }

      const card = player.hand[cardIndex];
      const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];

      if (this.state.lastDrawnCardId && this.state.lastDrawnCardId !== cardId) {
        client.send("error", { message: "Must play the drawn card first", code: "DRAWN_CARD_ONLY" });
        return;
      }

      // Validate chosenColor
      if (card.cardType === "wild" && chosenColor === undefined) {
        client.send("error", { message: "Wild cards require a chosen color", code: "MISSING_COLOR" });
        return;
      }
      if (chosenColor !== undefined && !VALID_COLORS.includes(chosenColor as UnoColor)) {
        client.send("error", { message: "Invalid color", code: "INVALID_COLOR" });
        return;
      }

      // Validate playability
      if (!canPlay(card, topDiscard, this.state.activeColor as UnoColor, this.state.pendingDraw)) {
        client.send("error", { message: "Card cannot be played", code: "CANNOT_PLAY" });
        return;
      }

        const wildDraw4Illegal =
          card.cardType === "wild" && card.value === "wild_draw4"
            ? this.isWildDraw4Illegal(player)
            : false;

      this.executePlayCard(player, cardIndex, chosenColor as UnoColor | undefined, wildDraw4Illegal);
    } catch (err) {
      log.error({ err }, "handlePlayCard failed");
      client.send("error", { message: "Internal error", code: "INTERNAL_ERROR" });
    }
  }

  private handleDrawCard(client: Client) {
    try {
      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      if (this.resolvePendingUnoPenalty()) {
        // The current turn has already advanced because the previous player
        // missed their UNO call, so this draw is no longer valid.
        this.scheduleTurn();
      }

      // Rate limit
      if (this.checkRateLimit(client, "draw_card")) {
        return;
      }

      if (this.state.currentPlayer !== player.seatIndex) {
        client.send("error", { message: "Not your turn", code: "NOT_YOUR_TURN" });
        return;
      }
      if (this.state.winner !== -1) {
        client.send("error", { message: "Game is finished", code: "GAME_FINISHED" });
        return;
      }
      if (this.state.lastDrawnCardId) {
        client.send("error", { message: "You must play the drawn card or wait for the turn to pass", code: "ALREADY_DREW" });
        return;
      }

      if (this.state.wildDraw4ChallengePending) {
        const count = this.state.pendingDraw > 0 ? this.state.pendingDraw : 4;
        this.drawCards(player, count);
        this.state.pendingDraw = 0;
        this.clearWildDraw4Challenge();
        this.state.currentPlayer = this.nextPlayer();
        this.finalizePendingWinner();
        if (this.state.phase === "playing" && this.state.winner === -1) {
          this.scheduleTurn();
        }
        return;
      }

      const count = this.state.pendingDraw > 0 ? this.state.pendingDraw : 1;
      this.drawCards(player, count);
      this.state.pendingDraw = 0;

      if (count === 1) {
        this.state.lastDrawnCardId = player.hand[player.hand.length - 1]?.id ?? "";
        this.scheduleTurn();
        return;
      }

      this.state.lastDrawnCardId = "";
      this.state.currentPlayer = this.nextPlayer();
      this.finalizePendingWinner();
      if (this.state.phase === "playing" && this.state.winner === -1) {
        this.scheduleTurn();
      }
    } catch (err) {
      log.error({ err }, "handleDrawCard failed");
      client.send("error", { message: "Internal error", code: "INTERNAL_ERROR" });
    }
  }

  private handleChallengeWildDraw4(client: Client) {
    try {
      const player = this.findPlayerBySession(client.sessionId);
      if (!player) return;

      if (this.checkRateLimit(client, "challenge_wild_draw4")) {
        return;
      }

      if (this.state.currentPlayer !== player.seatIndex) {
        client.send("error", { message: "Not your turn", code: "NOT_YOUR_TURN" });
        return;
      }
      if (!this.state.wildDraw4ChallengePending) {
        client.send("error", { message: "No Wild Draw 4 challenge is pending", code: "NO_CHALLENGE_PENDING" });
        return;
      }
      this.resolveWildDraw4Challenge(player.seatIndex);
    } catch (err) {
      log.error({ err }, "handleChallengeWildDraw4 failed");
      client.send("error", { message: "Internal error", code: "INTERNAL_ERROR" });
    }
  }

  private handleRestart(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    // Only allow restart when game is finished, or during play if all bots (dev mode)
    if (this.state.phase !== "finished") {
      let hasConnectedHuman = false;
      this.state.players.forEach((p: PlayerInstance) => {
        if (!p.isBot && p.connected) hasConnectedHuman = true;
      });
      if (hasConnectedHuman) return;
    }

    clearTimeout(this.turnTimeout);
    this.turnTimeout = undefined;
    for (const timeout of this.turnCallbacks.values()) {
      clearTimeout(timeout);
    }
    this.turnCallbacks.clear();
    this.seatsHandedToBot.clear();
    this.rateLimiter.clear();

    // Clear all hands and discard pile
    this.state.players.forEach((player: PlayerInstance) => {
      player.hand.splice(0, player.hand.length);
      player.handCount = 0;
    });
    this.state.discardPile.splice(0, this.state.discardPile.length);
    this.discardedCounts = {};
    this.resetRoundActionState();
    // Re-deal
    this.dealGame();
    this.state.phase = "playing";
    this.scheduleTurn();
  }

  private handleChat(client: Client, message: { text: string }) {
    let senderName = "";
    const player = this.findPlayerBySession(client.sessionId);
    if (player) {
      senderName = player.name;
    } else if (this.spectators.has(client)) {
      senderName = `Spectator (${client.sessionId.slice(0, 4)})`;
    } else {
      return;
    }

    if (this.checkRateLimit(client, "chat")) {
      return;
    }

    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (!text || text.length > 200) return;
    const chatMsg = new ChatMessageSchema();
    chatMsg.sender = sanitizePlainText(senderName);
    chatMsg.text = sanitizePlainText(text);
    chatMsg.timestamp = Date.now();
    this.state.chatMessages.push(chatMsg);
    // Keep last 50 messages
    if (this.state.chatMessages.length > 50) {
      this.state.chatMessages.splice(0, this.state.chatMessages.length - 50);
    }
  }

  private handleUno(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    if (this.checkRateLimit(client, "uno_call")) {
      return;
    }
    // Only the player who must call UNO can do so
    if (this.state.unoCaller === player.seatIndex) {
      this.state.unoCaller = -1;
    }
  }

  private handleVoteRematch(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    if (this.state.phase !== "finished") return;
    if (player.isBot) return;
    if (!player.connected) return;

    // Add vote if not already present
    const alreadyVoted = this.state.rematchVotes.includes(player.seatIndex);
    if (!alreadyVoted) {
      this.state.rematchVotes.push(player.seatIndex);
    }

    // Check if all connected humans have voted
    const connectedHumanSeats: number[] = [];
    this.state.players.forEach((p: PlayerInstance) => {
      if (!p.isBot && p.connected) {
        connectedHumanSeats.push(p.seatIndex);
      }
    });

    const allVoted = connectedHumanSeats.length > 0 &&
      connectedHumanSeats.every((seat) => this.state.rematchVotes.includes(seat));

    if (allVoted) {
      this.state.rematchVotes.splice(0, this.state.rematchVotes.length);
      this.handleRestart(client);
    }
  }
}
