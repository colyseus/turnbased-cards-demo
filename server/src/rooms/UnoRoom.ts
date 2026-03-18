import { Room, Client } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import { UnoRoomState, PlayerSchema, UnoCardSchema } from "./schema/UnoRoomState.ts";
import {
  UnoCard, UnoColor, UnoValue, WildType,
  createUnoDeck, shuffleDeck,
} from "../../../src/uno.ts";

const NUM_PLAYERS = 4;
const HAND_SIZE = 7;
const HUMAN_TURN_TIMEOUT = 7000;
const BOT_TURN_DELAY = 800;

type RoomState = InstanceType<typeof UnoRoomState>;
type PlayerInstance = InstanceType<typeof PlayerSchema>;
type CardInstance = InstanceType<typeof UnoCardSchema>;

function canPlaySchema(
  card: CardInstance,
  topCard: CardInstance,
  activeColor: string,
): boolean {
  if (card.cardType === "wild") return true;
  if (card.color === activeColor) return true;
  if (topCard.cardType === "color" && card.value === topCard.value) return true;
  return false;
}

export class UnoRoom extends Room<{ state: RoomState }> {
  private drawPile: UnoCard[] = [];
  private turnTimeout?: ReturnType<typeof setTimeout>;

  onCreate() {
    this.maxClients = NUM_PLAYERS;
    this.setState(new UnoRoomState());

    this.state.phase = "waiting";
    this.state.winner = -1;
    this.state.direction = 1;

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

    // Message handlers
    this.onMessage("play_card", (client: Client, message: { cardId: string; chosenColor?: string }) => {
      this.handlePlayCard(client, message);
    });

    this.onMessage("draw_card", (client: Client) => {
      this.handleDrawCard(client);
    });

    this.onMessage("restart", () => {
      this.handleRestart();
    });
  }

  onJoin(client: Client, options: any) {
    // Find a bot seat to replace
    const botPlayer = this.findBotSeat();
    if (!botPlayer) return;

    // Replace bot with human (keep hand intact)
    botPlayer.sessionId = client.sessionId;
    botPlayer.name = options?.name || "Player";
    botPlayer.isBot = false;
    botPlayer.connected = true;

    // Set up StateView — player can see their own hand
    client.view = new StateView();
    client.view.add(botPlayer);

    // If all seats are human, lock
    let allHuman = true;
    this.state.players.forEach((p: PlayerInstance) => {
      if (p.isBot) allHuman = false;
    });
    if (allHuman) this.lock();

    // If it's now this player's turn (was a bot turn), reschedule as human
    if (this.state.currentPlayer === botPlayer.seatIndex) {
      this.scheduleTurn();
    }
  }

  async onLeave(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;

    // Convert back to bot
    player.sessionId = `bot-${player.seatIndex}`;
    player.name = `Bot ${player.seatIndex + 1}`;
    player.isBot = true;
    player.connected = false;

    // Unlock so others can join
    this.unlock();

    // If it's this player's turn, schedule bot turn
    if (this.state.currentPlayer === player.seatIndex) {
      this.scheduleTurn();
    }
  }

  onDispose() {
    clearTimeout(this.turnTimeout);
  }

  // ── Helpers ───────────────────────────────────────────────────

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
    const delay = player.isBot ? BOT_TURN_DELAY : HUMAN_TURN_TIMEOUT;

    this.state.turnDeadline = Date.now() + delay;

    this.turnTimeout = setTimeout(() => {
      this.botTurn();
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
    player.hand.splice(cardIndex, 1);
    player.handCount = player.hand.length;

    // Add to discard pile
    this.state.discardPile.push(discardCard);

    // Check win
    if (player.hand.length === 0) {
      this.state.winner = player.seatIndex;
      this.state.phase = "finished";
      clearTimeout(this.turnTimeout);
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
  }

  private botTurn() {
    if (this.state.phase !== "playing" || this.state.winner !== -1) return;

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
      if (canPlaySchema(player.hand[i], topDiscard, this.state.activeColor)) {
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

    // Pick a random playable card
    const cardIndex = playable[Math.floor(Math.random() * playable.length)];
    const card = player.hand[cardIndex];

    // Choose color for wild cards (pick color with most cards in hand)
    let chosenColor: UnoColor | undefined;
    if (card.cardType === "wild") {
      const colorCounts: Record<UnoColor, number> = {
        red: 0,
        blue: 0,
        green: 0,
        yellow: 0,
      };
      for (let i = 0; i < player.hand.length; i++) {
        const c = player.hand[i];
        if (c.cardType === "color") {
          colorCounts[c.color as UnoColor]++;
        }
      }
      chosenColor = (
        Object.entries(colorCounts) as [UnoColor, number][]
      ).sort((a, b) => b[1] - a[1])[0][0];
    }

    this.executePlayCard(player, cardIndex, chosenColor);
  }

  // ── Message Handlers ──────────────────────────────────────────

  private handlePlayCard(
    client: Client,
    message: { cardId: string; chosenColor?: string },
  ) {
    const { cardId, chosenColor } = message;

    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;

    // Validate turn
    if (this.state.currentPlayer !== player.seatIndex) return;
    if (this.state.winner !== -1) return;
    if (this.state.pendingDraw > 0) return;

    // Find card in hand
    let cardIndex = -1;
    for (let i = 0; i < player.hand.length; i++) {
      if (player.hand[i].id === cardId) {
        cardIndex = i;
        break;
      }
    }
    if (cardIndex === -1) return;

    // Validate playability
    const topDiscard = this.state.discardPile[this.state.discardPile.length - 1];
    if (!canPlaySchema(player.hand[cardIndex], topDiscard, this.state.activeColor)) {
      return;
    }

    this.executePlayCard(player, cardIndex, chosenColor as UnoColor | undefined);
  }

  private handleDrawCard(client: Client) {
    const player = this.findPlayerBySession(client.sessionId);
    if (!player) return;
    if (this.state.currentPlayer !== player.seatIndex) return;
    if (this.state.winner !== -1) return;

    const count = this.state.pendingDraw > 0 ? this.state.pendingDraw : 1;
    this.drawCards(player, count);
    this.state.pendingDraw = 0;
    this.state.currentPlayer = this.nextPlayer();
    this.scheduleTurn();
  }

  private handleRestart() {
    clearTimeout(this.turnTimeout);

    // Clear all hands and discard pile
    this.state.players.forEach((player: PlayerInstance) => {
      player.hand.splice(0, player.hand.length);
      player.handCount = 0;
    });
    this.state.discardPile.splice(0, this.state.discardPile.length);

    // Re-deal
    this.dealGame();
    this.state.phase = "playing";
    this.scheduleTurn();
  }
}
