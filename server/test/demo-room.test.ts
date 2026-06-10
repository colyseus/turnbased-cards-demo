import { describe, expect, it } from "vitest";
import { DemoRoom } from "../src/rooms/DemoRoom.ts";
import { pickBestPlayableCard } from "../shared/gameLogic.ts";

describe("DemoRoom lifecycle", () => {
  it("clears the scheduled tick timer on dispose", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["startGame"]();
    expect(room["tickTimer"]).toBeDefined();

    room.onDispose();
    expect(room["tickTimer"]).toBeUndefined();
  });

  it("preserves the visible discard card when recycling the draw pile", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["drawPile"] = [];
    room["currentState"] = {
      hands: [[], [], [], []],
      discardPile: [
        { type: "color", color: "red", value: "5", id: "discard-0" },
        { type: "color", color: "blue", value: "7", id: "discard-1" },
        { type: "color", color: "green", value: "9", id: "discard-2" },
      ],
      currentPlayer: 0,
      direction: 1,
      activeColor: "green",
      pendingDraw: 0,
      winner: null,
    };

    room["recycleDiscard"]();

    expect(room["currentState"].discardPile).toHaveLength(1);
    expect(room["currentState"].discardPile[0].id).toBe("discard-2");
    expect(room["drawPile"]).toHaveLength(2);

    room.onDispose();
  });

  it("keeps only one active tick timer across pause and resume cycles", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["startGame"]();
    const firstTimer = room["tickTimer"];
    expect(firstTimer).toBeDefined();

    room["resumeGame"]();
    expect(room["tickTimer"]).toBe(firstTimer);

    room["pauseGame"]();
    expect(room["tickTimer"]).toBeUndefined();

    room["resumeGame"]();
    expect(room["tickTimer"]).toBeDefined();
    expect(room["tickTimer"]).not.toBe(firstTimer);

    room.onDispose();
  });

  it("prefers matching-color action cards over matching-color number cards", () => {
    const room = new DemoRoom();
    room.onCreate();

    const playable = [
      { type: "color", color: "red", value: "5", id: "red-5" },
      { type: "color", color: "red", value: "skip", id: "red-skip" },
      { type: "wild", wildType: "wild", chosenColor: null, id: "wild-0" },
    ];

    expect(pickBestPlayableCard(playable, "red").id).toBe("red-skip");

    room.onDispose();
  });

  it("prefers same-value action cards over wilds when color does not match", () => {
    const room = new DemoRoom();
    room.onCreate();

    const playable = [
      { type: "color", color: "green", value: "skip", id: "green-skip" },
      { type: "wild", wildType: "wild", chosenColor: null, id: "wild-0" },
    ];

    expect(pickBestPlayableCard(playable, "red").id).toBe("green-skip");

    room.onDispose();
  });

  it("prefers draw2 over wilds when no better action is available", () => {
    const room = new DemoRoom();
    room.onCreate();

    const playable = [
      { type: "color", color: "green", value: "draw2", id: "green-draw2" },
      { type: "wild", wildType: "wild", chosenColor: null, id: "wild-0" },
    ];

    expect(pickBestPlayableCard(playable, "red").id).toBe("green-draw2");

    room.onDispose();
  });

  it("prefers same-value number cards over wilds when color does not match", () => {
    const room = new DemoRoom();
    room.onCreate();

    const playable = [
      { type: "color", color: "green", value: "7", id: "green-7" },
      { type: "wild", wildType: "wild", chosenColor: null, id: "wild-0" },
    ];

    expect(pickBestPlayableCard(playable, "red", "7").id).toBe("green-7");

    room.onDispose();
  });

  it("advances the turn after drawing and immediately playing a legal card", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      hands: [
        [{ type: "color", color: "blue", value: "9", id: "hand-0" }],
        [],
        [],
        [],
      ],
      discardPile: [{ type: "color", color: "red", value: "5", id: "top-0" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "green",
      pendingDraw: 0,
      winner: null,
    };
    room["drawPile"] = [{ type: "color", color: "blue", value: "5", id: "drawn-legal" }];
    room["state"].demo.phase = "running";
    room["paused"] = false;

    room["tick"]();

    expect(room["currentState"].hands[0]).toHaveLength(1);
    expect(room["currentState"].hands[0][0].id).toBe("hand-0");
    expect(room["currentState"].discardPile[room["currentState"].discardPile.length - 1].id).toBe(
      "drawn-legal",
    );
    expect(room["currentState"].currentPlayer).toBe(1);
    expect(room["currentState"].activeColor).toBe("blue");

    room.onDispose();
  });

  it("records the seat that forced-drew cards", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      hands: [[], [], [], []],
      discardPile: [{ type: "color", color: "red", value: "5", id: "top-0" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 2,
      winner: null,
    };
    room["drawPile"] = [
      { type: "color", color: "blue", value: "1", id: "draw-1" },
      { type: "color", color: "green", value: "2", id: "draw-2" },
    ];
    room["state"].demo.phase = "running";
    room["state"].turnHistory = [];
    room["paused"] = false;

    room["tick"]();

    expect(room["state"].turnHistory).toHaveLength(1);
    expect(room["state"].turnHistory[0].player).toBe(0);
    expect(room["state"].turnHistory[0].action).toBe("draw");
    expect(room["currentState"].currentPlayer).toBe(1);

    room.onDispose();
  });

  it("records turn history with the seat that actually acted", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      hands: [
        [{ type: "color", color: "blue", value: "9", id: "hand-0" }],
        [],
        [],
        [],
      ],
      discardPile: [{ type: "color", color: "red", value: "5", id: "top-0" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "green",
      pendingDraw: 0,
      winner: null,
    };
    room["drawPile"] = [{ type: "color", color: "blue", value: "5", id: "drawn-legal" }];
    room["state"].demo.phase = "running";
    room["state"].turnHistory = [];
    room["paused"] = false;

    room["tick"]();

    expect(room["state"].turnHistory).toHaveLength(1);
    expect(room["state"].turnHistory[0].player).toBe(0);
    expect(room["state"].turnHistory[0].action).toBe("play");

    room.onDispose();
  });

  it("persists the chosen color when drawing and immediately playing a wild card", () => {
    const room = new DemoRoom();
    room.onCreate();

    room["currentState"] = {
      hands: [
        [
          { type: "color", color: "blue", value: "7", id: "hand-blue-1" },
          { type: "color", color: "blue", value: "9", id: "hand-blue-2" },
          { type: "color", color: "green", value: "3", id: "hand-green" },
        ],
        [],
        [],
        [],
      ],
      discardPile: [{ type: "color", color: "red", value: "5", id: "top-0" }],
      currentPlayer: 0,
      direction: 1,
      activeColor: "red",
      pendingDraw: 0,
      winner: null,
    };
    room["drawPile"] = [{ type: "wild", wildType: "wild", chosenColor: null, id: "drawn-wild" }];
    room["state"].demo.phase = "running";
    room["state"].turnHistory = [];
    room["paused"] = false;

    room["tick"]();

    const topDiscard = room["currentState"].discardPile[room["currentState"].discardPile.length - 1];
    expect(topDiscard.id).toBe("drawn-wild");
    expect(topDiscard.chosenColor).toBe("blue");
    expect(room["state"].turnHistory).toHaveLength(1);
    expect(room["state"].turnHistory[0].player).toBe(0);
    expect(room["state"].turnHistory[0].action).toBe("play");
    expect(room["state"].turnHistory[0].chosenColor).toBe("blue");

    room.onDispose();
  });
});
