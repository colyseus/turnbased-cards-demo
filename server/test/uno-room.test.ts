import { describe, expect, it } from "vitest";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { UnoCardSchema } from "../src/rooms/schema/UnoRoomState.ts";
import { canPlay } from "../shared/uno.ts";
import { makeTestClient } from "./testClients.ts";

type RoomTestAccess = UnoRoom & {
  drawPile: Array<{ type: "color"; color: string; value: string; id: string }>;
};

function makeSchemaCard(
  id: string,
  color: string,
  value: string,
): InstanceType<typeof UnoCardSchema> {
  const card = new UnoCardSchema();
  card.id = id;
  card.cardType = "color";
  card.color = color;
  card.value = value;
  card.chosenColor = "";
  return card;
}

describe("UnoRoom turn scheduling logic", () => {
  it("does not treat draw2 as actionable while a draw penalty is pending", () => {
    const room = new UnoRoom();
    room.onCreate();

    const currentPlayer = room.state.players.get(String(room.state.currentPlayer))!;
    currentPlayer.isBot = false;
    currentPlayer.connected = true;
    currentPlayer.hand.splice(0, currentPlayer.hand.length);
    currentPlayer.hand.push(makeSchemaCard("blue_draw2_stack", "blue", "draw2"));
    currentPlayer.handCount = currentPlayer.hand.length;

    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("red_draw2_top", "red", "draw2"));
    room.state.activeColor = "red";
    room.state.pendingDraw = 2;

    expect(room["playerCanAct"]()).toBe(false);

    room.onDispose();
  });

  it("forces the next player to draw 2 when UNO was not called in time", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const missedUnoSeat = room.state.currentPlayer;
    const penalizedSeat = (missedUnoSeat + 1) % 4;
    const penalizedPlayer = room.state.players.get(String(penalizedSeat))!;
    const beforeHandCount = penalizedPlayer.hand.length;
    const expectedNextSeat = ((penalizedSeat + room.state.direction) % 4 + 4) % 4;

    room.state.unoCaller = missedUnoSeat;
    room.state.currentPlayer = penalizedSeat;

    room["scheduleTurn"]();

    expect(room.state.unoCaller).toBe(-1);
    expect(room.state.currentPlayer).toBe(expectedNextSeat);
    expect(penalizedPlayer.hand.length).toBe(beforeHandCount + 2);

    room.onDispose();
  });

  it("does not treat pending draw as actionable without a playable card", () => {
    const room = new UnoRoom();
    room.onCreate();

    const currentPlayer = room.state.players.get(String(room.state.currentPlayer))!;
    currentPlayer.isBot = false;
    currentPlayer.connected = true;
    currentPlayer.hand.splice(0, currentPlayer.hand.length);
    currentPlayer.hand.push(makeSchemaCard("red_5_blocked", "red", "5"));
    currentPlayer.handCount = currentPlayer.hand.length;

    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("red_draw2_top", "red", "draw2"));
    room.state.activeColor = "red";
    room.state.pendingDraw = 2;

    expect(room["playerCanAct"]()).toBe(false);

    room.onDispose();
  });

  it("lets a player play the card they just drew, but not another card", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const player = room.state.players.get("0")!;
    player.sessionId = "human-0";
    player.isBot = false;
    player.connected = true;
    player.hand.splice(0, player.hand.length);
    player.hand.push(makeSchemaCard("red_5_existing", "red", "5"));
    player.hand.push(makeSchemaCard("green_9_existing", "green", "9"));
    room.state.currentPlayer = 0;
    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("red_7_top", "red", "7"));
    room.state.activeColor = "red";
    room.state.direction = 1;
    room.state.unoCaller = -1;
    room.state.pendingDraw = 0;
    room.state.lastDrawnCardId = "";
    room.state.wildDraw4ChallengePending = false;
    (room as RoomTestAccess).drawPile = [{ type: "color", color: "red", value: "2", id: "red_2_drawn" }];

    const client = makeTestClient("human-0");

    room["handleDrawCard"](client);

    expect(room.state.currentPlayer).toBe(0);
    expect(room.state.lastDrawnCardId).toBe("red_2_drawn");

    room["lastActionTime"].clear();
    room["handlePlayCard"](client, { cardId: "red_5_existing" });
    expect(player.hand.some((card) => card.id === "red_5_existing")).toBe(true);

    room["lastActionTime"].clear();
    let playError: { message: string; code: string } | null = null;
    const drawPlayClient = makeTestClient("human-0", (type: string, data: { message: string; code: string }) => {
      if (type === "error") playError = data;
    });
    room["handlePlayCard"](drawPlayClient, { cardId: "red_2_drawn" });
    expect(playError).toBeNull();
    expect(player.hand.some((card) => card.id === "red_2_drawn")).toBe(false);
    expect(room.state.currentPlayer).toBe(1);

    room.onDispose();
  });

  it("keeps the draw-only lock when another seat disconnects", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const player = room.state.players.get("0")!;
    player.sessionId = "human-0";
    player.isBot = false;
    player.connected = true;
    player.hand.splice(0, player.hand.length);
    player.hand.push(makeSchemaCard("red_5_existing", "red", "5"));
    player.hand.push(makeSchemaCard("green_9_existing", "green", "9"));
    room.state.currentPlayer = 0;
    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("red_7_top", "red", "7"));
    room.state.activeColor = "red";
    room.state.direction = 1;
    room.state.pendingDraw = 0;
    room.state.lastDrawnCardId = "";
    (room as RoomTestAccess).drawPile = [{ type: "color", color: "red", value: "2", id: "red_2_drawn" }];

    const currentClient = makeTestClient("human-0");
    room["handleDrawCard"](currentClient);
    expect(room.state.lastDrawnCardId).toBe("red_2_drawn");

    const otherSeat = room.state.players.get("1")!;
    otherSeat.sessionId = "human-1";
    otherSeat.isBot = false;
    otherSeat.connected = true;
    room.onLeave(makeTestClient("human-1"));

    room["lastActionTime"].clear();
    let playError: { message: string; code: string } | null = null;
    const playClient = makeTestClient("human-0", (type: string, data: { message: string; code: string }) => {
      if (type === "error") playError = data;
    });
    room["handlePlayCard"](playClient, { cardId: "red_5_existing" });

    expect(playError?.code).toBe("DRAWN_CARD_ONLY");
    expect(room.state.lastDrawnCardId).toBe("red_2_drawn");
    expect(player.hand.some((card) => card.id === "red_5_existing")).toBe(true);

    room.onDispose();
  });

  it("rejects a stale play once the pending UNO penalty advances the turn", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const player = room.state.players.get("1")!;
    player.sessionId = "human-1";
    player.isBot = false;
    player.connected = true;
    player.hand.splice(0, player.hand.length);
    player.hand.push(makeSchemaCard("blue_5_playable", "blue", "5"));
    player.handCount = player.hand.length;

    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("blue_7_top", "blue", "7"));
    room.state.activeColor = "blue";
    room.state.currentPlayer = 1;
    room.state.unoCaller = 0;
    room.state.direction = 1;

    let errorReceived: { message: string; code: string } | null = null;
    const client = makeTestClient("human-1", (type: string, data: { message: string; code: string }) => {
      if (type === "error") errorReceived = data;
    });

    room["handlePlayCard"](client, { cardId: "blue_5_playable" });

    expect(errorReceived?.code).toBe("NOT_YOUR_TURN");
    expect(room.state.unoCaller).toBe(-1);
    expect(room.state.currentPlayer).toBe(2);
    expect(player.hand.some((card) => card.id === "blue_5_playable")).toBe(true);
    expect(player.hand.length).toBe(3);

    room.onDispose();
  });
});

describe("UnoRoom restart logic", () => {
  it("does not allow a connected human to restart an active unfinished game", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const player = room.state.players.get("0")!;
    player.sessionId = "human-0";
    player.isBot = false;
    player.connected = true;

    room.state.phase = "playing";
    room.state.winner = -1;
    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("marker_red_5", "red", "5"));
    const originalDeadline = room.state.turnDeadline;

    room["handleRestart"](makeTestClient("human-0"));

    expect(room.state.phase).toBe("playing");
    expect(room.state.winner).toBe(-1);
    expect(room.state.discardPile.map((card) => card.id)).toEqual(["marker_red_5"]);
    expect(room.state.turnDeadline).toBe(originalDeadline);

    room.onDispose();
  });

  it("restarts a finished game into a clean playable round", () => {
    const room = new UnoRoom();
    room.onCreate();

    const player = room.state.players.get("0")!;
    player.sessionId = "human-0";
    player.isBot = false;
    player.connected = true;

    room.state.phase = "finished";
    room.state.winner = 2;
    room.state.pendingDraw = 6;
    room.state.unoCaller = 1;
    room.state.rematchVotes.push(0, 1);
    room.state.discardPile.push(makeSchemaCard("extra_red_5", "red", "5"));

    room["handleRestart"](makeTestClient("human-0"));

    const handCounts = [...room.state.players.values()].map((p) => p.hand.length);
    expect(room.state.phase).toBe("playing");
    expect(room.state.winner).toBe(-1);
    expect(room.state.unoCaller).toBe(-1);
    expect(room.state.rematchVotes).toHaveLength(0);
    expect(room.state.discardPile).toHaveLength(1);
    expect(handCounts).toEqual([7, 7, 7, 7]);
    expect(room.state.drawPileCount).toBe(79);
    expect([0, 1, 3]).toContain(room.state.currentPlayer);
    expect([1, -1]).toContain(room.state.direction);
    expect(["red", "blue", "green", "yellow"]).toContain(room.state.activeColor);
    expect([0, 2]).toContain(room.state.pendingDraw);

    room.onDispose();
  });

  it("clears pending bot takeover callbacks when restarting", () => {
    const room = new UnoRoom();
    room.onCreate();

    const pendingTimeout = setTimeout(() => undefined, 10_000);
    room["turnCallbacks"].set(2, pendingTimeout);
    room["seatsHandedToBot"].add(2);
    room["lastActionTime"].set("human-0", Date.now());

    room.state.phase = "finished";
    room.state.winner = 1;
    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("marker_red_5", "red", "5"));

    room["handleRestart"](makeTestClient("bot-0"));

    expect(room["turnCallbacks"].size).toBe(0);
    expect(room["seatsHandedToBot"].size).toBe(0);
    expect(room["lastActionTime"].size).toBe(0);

    room.onDispose();
  });

  it("cancels in-progress rematch votes when a player disconnects", () => {
    const room = new UnoRoom();
    room.onCreate();

    const human = room.state.players.get("0")!;
    human.sessionId = "human-0";
    human.isBot = false;
    human.connected = true;

    const otherHuman = room.state.players.get("1")!;
    otherHuman.sessionId = "human-1";
    otherHuman.isBot = false;
    otherHuman.connected = true;

    room.state.phase = "finished";
    room.state.winner = 2;
    room.state.rematchVotes.push(0);

    room.onLeave(makeTestClient("human-0"));

    expect(room.state.rematchVotes).toHaveLength(0);
    expect(room.state.players.get("0")!.isBot).toBe(true);
    expect(room.state.players.get("0")!.connected).toBe(false);

    room.onDispose();
  });
});

describe("UnoRoom bot-only completion", () => {
  function totalRoomCards(room: UnoRoom) {
    const handTotal = [...room.state.players.values()].reduce(
      (sum, player) => sum + player.hand.length,
      0,
    );
    return room.state.drawPileCount + room.state.discardPile.length + handTotal;
  }

  function playBotRoomToCompletion(room: UnoRoom, maxTurns = 3000) {
    const initialTotal = totalRoomCards(room);

    for (let turn = 0; turn < maxTurns && room.state.winner === -1; turn++) {
      room["botTurn"]();

      expect(room.state.currentPlayer).toBeGreaterThanOrEqual(0);
      expect(room.state.currentPlayer).toBeLessThan(4);
      expect([1, -1]).toContain(room.state.direction);
      expect(["red", "blue", "green", "yellow"]).toContain(room.state.activeColor);
      expect(room.state.pendingDraw).toBeGreaterThanOrEqual(0);
      expect(room.state.discardPile.length).toBeGreaterThan(0);
      expect(totalRoomCards(room)).toBe(initialTotal);
      clearTimeout(room["turnTimeout"]);
    }
  }

  it("can complete an actual room game to a single winner through bot turns", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    playBotRoomToCompletion(room);

    expect(room.state.phase).toBe("finished");
    expect(room.state.winner).toBeGreaterThanOrEqual(0);
    expect(room.state.winner).toBeLessThan(4);

    const handCounts = [...room.state.players.values()].map((player) => player.hand.length);
    expect(handCounts.filter((count) => count === 0)).toHaveLength(1);
    expect(handCounts[room.state.winner]).toBe(0);

    room.onDispose();
  });

  it("repeatedly completes actual room games within a practical turn limit", () => {
    for (let game = 0; game < 25; game++) {
      const room = new UnoRoom();
      room.onCreate();
      clearTimeout(room["turnTimeout"]);

      playBotRoomToCompletion(room);

      expect(room.state.phase).toBe("finished");
      expect(room.state.winner).not.toBe(-1);
      expect(room.state.players.get(String(room.state.winner))!.hand).toHaveLength(0);

      room.onDispose();
    }
  });
});

describe("UnoRoom regular human match", () => {
  it("lets a connected human play a complete game against bots through room messages", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0");
    room.onJoin(client, { name: "Human" });
    clearTimeout(room["turnTimeout"]);

    let humanActions = 0;
    for (let turn = 0; turn < 3000 && room.state.winner === -1; turn++) {
      const player = room.state.players.get(String(room.state.currentPlayer))!;
      room["lastActionTime"].clear();

      if (room.state.wildDraw4ChallengePending) {
        if (player.isBot) {
          room["botTurn"]();
        } else {
          room["handleDrawCard"](client);
        }
      } else if (player.isBot) {
        room["botTurn"]();
      } else {
        const topDiscard = room.state.discardPile[room.state.discardPile.length - 1];
        const drawnCardId = room.state.lastDrawnCardId ?? "";
        const card = player.hand.find((candidate) => {
          if (drawnCardId && candidate.id !== drawnCardId) {
            return false;
          }
          if (!canPlay(candidate, topDiscard, room.state.activeColor, room.state.pendingDraw)) {
            return false;
          }
          return true;
        });

        if (card) {
          room["handlePlayCard"](client, {
            cardId: card.id,
            chosenColor: card.cardType === "wild" ? "red" : undefined,
          });
        } else if (drawnCardId) {
          room["botTurn"]();
        } else {
          room["handleDrawCard"](client);
        }
        humanActions++;
      }

      clearTimeout(room["turnTimeout"]);
    }

    expect(humanActions).toBeGreaterThan(0);
    expect(room.state.phase).toBe("finished");
    expect(room.state.winner).toBeGreaterThanOrEqual(0);
    expect(room.state.winner).toBeLessThan(4);

    room.onDispose();
  });
});
