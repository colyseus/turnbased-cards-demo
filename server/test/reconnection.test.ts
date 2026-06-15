import { describe, expect, it } from "vitest";
import { UnoRoom } from "../src/rooms/UnoRoom.ts";
import { UnoCardSchema } from "../src/rooms/schema/UnoRoomState.ts";
import { makeTestClient } from "./testClients.ts";

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

describe("UnoRoom reconnection behavior", () => {
  it("restores the same seat and hand when a player reconnects to an abandoned seat", () => {
    const room = new UnoRoom();
    room.onCreate();
    clearTimeout(room["turnTimeout"]);

    const client = makeTestClient("human-0", () => undefined);

    room.onJoin(client, { name: "Player 1" });

    const player = room.state.players.get("0")!;
    player.hand.splice(0, player.hand.length);
    player.hand.push(makeSchemaCard("red_5", "red", "5"));
    player.hand.push(makeSchemaCard("blue_2", "blue", "2"));
    room.state.phase = "playing";
    room.state.winner = -1;
    room.state.currentPlayer = 0;
    room.state.discardPile.splice(0, room.state.discardPile.length);
    room.state.discardPile.push(makeSchemaCard("green_7", "green", "7"));
    room.state.activeColor = "green";

    const originalHandIds = player.hand.map((card) => card.id);

    room.onLeave(client);
    expect(player.isBot).toBe(true);
    expect(player.connected).toBe(false);
    expect(room["seatsHandedToBot"].has(0)).toBe(true);

    room["rateLimiter"].clear();
    room.onJoin(client, { name: "Player 1" });

    expect(player.isBot).toBe(false);
    expect(player.connected).toBe(true);
    expect(room["seatsHandedToBot"].has(0)).toBe(false);
    expect(player.hand.map((card) => card.id)).toEqual(originalHandIds);
    expect(room.state.currentPlayer).toBe(0);

    room.onDispose();
  });
});
