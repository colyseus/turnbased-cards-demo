import { describe, expect, it } from "vitest";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { UnoCardSchema } from "../src/rooms/schema/UnoRoomState.ts";
import { canPlay, hasWildDrawFourAlternative } from "../shared/uno.ts";

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
  it("treats a stackable draw card as an actionable human turn", () => {
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

    expect(room["playerCanAct"]()).toBe(true);

    room.onDispose();
  });

  it("does not treat pending draw as actionable without a stackable card", () => {
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

    room["handleRestart"]({ sessionId: "human-0" } as never);

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

    room["handleRestart"]({ sessionId: "human-0" } as never);

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

    const client = { sessionId: "human-0", send: () => {} } as never;
    room.onJoin(client, { name: "Human" });
    clearTimeout(room["turnTimeout"]);

    let humanActions = 0;
    for (let turn = 0; turn < 3000 && room.state.winner === -1; turn++) {
      const player = room.state.players.get(String(room.state.currentPlayer))!;
      room["lastActionTime"].clear();

      if (player.isBot) {
        room["botTurn"]();
      } else {
        const topDiscard = room.state.discardPile[room.state.discardPile.length - 1];
        const card = player.hand.find((candidate) => {
          if (!canPlay(candidate, topDiscard, room.state.activeColor, room.state.pendingDraw)) {
            return false;
          }
          return candidate.cardType !== "wild" ||
            candidate.value !== "wild_draw4" ||
            room.state.pendingDraw >= 4 ||
            !hasWildDrawFourAlternative(player.hand, topDiscard, room.state.activeColor);
        });

        if (card) {
          room["handlePlayCard"](client, {
            cardId: card.id,
            chosenColor: card.cardType === "wild" ? "red" : undefined,
          });
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
