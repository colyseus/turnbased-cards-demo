// Main game controller.
// Manages the game table, card rendering, layout, turn indicators,
// active color ring, card interactions, and state synchronization.

import io.colyseus.Room;
import io.colyseus.serializer.schema.Callbacks;
import schema.UnoRoomState;
import schema.PlayerSchema;
import schema.UnoCardSchema;

private typedef CardRender = {
	key:String,
	textureId:String,
	x:Float,
	y:Float,
	z:Float,
	rotZ:Float,
	faceUp:Bool,
	scale:Float,
	shake:Bool,
	initialX:Null<Float>,
	initialY:Null<Float>,
};

private typedef PlayerInfo = {
	seatIndex:Int,
	visualPos:Int,
	player:PlayerSchema,
};

class Game {
	static final SERVER_URL = #if release "wss://uno-demo.colyseus.dev" #else "ws://localhost:2567" #end;

	static final COLOR_HEX:Map<String, Int> = [
		"red" => 0xFF3333,
		"blue" => 0x3377FF,
		"green" => 0x33BB44,
		"yellow" => 0xFFCC00,
	];

	static final FELT_COLOR:Int = 0x1A7A3C;

	// Player angles for turn indicator: 0=bottom, 1=left, 2=top, 3=right
	static final PLAYER_ANGLE:Array<Float> = [Math.PI / 2, Math.PI, -Math.PI / 2, 0];

	var s2d:h2d.Scene;
	var network:Network;
	var room:Room<UnoRoomState>;
	var state:UnoRoomState;

	// Scene layers
	var tableLayer:h2d.Object;
	var cardLayer:h2d.Object;
	var uiLayer:h2d.Object;

	// Table background
	var tableBg:h2d.Graphics;

	// Active color ring
	var colorRing:h2d.Graphics;
	var colorRingScale:Float = 1.0;
	var colorRingVelScale:Float = 0;
	var prevActiveColor:String = "";

	// Turn indicator
	var turnArrow:h2d.Graphics;
	var turnArrowAngle:Float = Math.PI / 2;
	var turnArrowVel:Float = 0;
	var turnArrowTarget:Float = Math.PI / 2;
	var prevCurrentPlayer:Int = -1;
	var dirArrowAngle:Float = 0;

	// Cards
	var cards:Map<String, Card> = new Map();
	var cardTiles:Map<String, h2d.Tile> = new Map();
	var backTile:h2d.Tile;

	// Local cache of players populated via callbacks
	var playerCache:Map<String, PlayerSchema> = new Map();

	// Lobby
	var lobby:Lobby;

	// HUD
	var hud:HUD;

	// Color picker
	var colorPicker:ColorPicker;

	// Game state tracking
	var mySessionId:String = "";
	var localSeatIndex:Int = 0;
	var hoveredCardId:String = "";
	var showcaseCardId:String = "";
	var showcaseTimer:Float = 0;
	var colorPickerForId:String = "";
	// Previous state for animation tracking
	var prevDiscardLen:Int = 0;
	var prevHandCounts:Map<Int, Int> = new Map();
	var prevLocalHandIds:Map<String, Bool> = new Map();
	var prevCurrentPlayerForAnim:Int = -1;

	// Layout
	var screenW:Float = 800;
	var screenH:Float = 600;

	// Winner overlay dim
	var winnerDim:h2d.Graphics;
	var winnerShown:Bool = false;

	public function new(s2d:h2d.Scene) {
		this.s2d = s2d;

		// Load textures
		loadCardTiles();

		// Create layers
		tableLayer = new h2d.Object(s2d);
		cardLayer = new h2d.Object(s2d);
		uiLayer = new h2d.Object(s2d);

		// Table background
		tableBg = new h2d.Graphics(tableLayer);

		// Active color ring
		colorRing = new h2d.Graphics(cardLayer);

		// Turn indicator
		turnArrow = new h2d.Graphics(cardLayer);

		// Winner dim
		winnerDim = new h2d.Graphics(cardLayer);
		winnerDim.visible = false;

		// Color picker
		colorPicker = new ColorPicker(uiLayer);
		colorPicker.onPickColor = onPickColor;

		// HUD
		hud = new HUD(uiLayer);
		hud.onRestart = function() {
			if (network != null)
				network.sendRestart();
		};

		// Lobby
		var heroTile = getCardTile("wild_draw4");
		lobby = new Lobby(uiLayer, heroTile);
		lobby.onQuickPlay = function(name) {
			connect(name, null);
		};
		lobby.onJoinByCode = function(code, name) {
			connect(name, code);
		};

		// Initial layout
		var w = hxd.Window.getInstance();
		screenW = w.width;
		screenH = w.height;
		lobby.resize(screenW, screenH);
		hud.resize(screenW, screenH);
	}

	function loadCardTiles() {
		var colors = ["red", "blue", "green", "yellow"];
		var values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"];

		for (color in colors) {
			for (value in values) {
				var id = color + "_" + value;
				loadTile(id);
			}
		}
		loadTile("wild");
		loadTile("wild_draw4");
		loadTile("back");

		backTile = getCardTile("back");
	}

	function loadTile(id:String) {
		try {
			var tile = hxd.Res.load("cards/" + id + ".png").toTile();
			cardTiles.set(id, tile);
		} catch (e:Dynamic) {
			trace("Warning: Could not load card tile: " + id);
		}
	}

	function getCardTile(id:String):h2d.Tile {
		var t = cardTiles.get(id);
		if (t != null)
			return t;
		return backTile != null ? backTile : h2d.Tile.fromColor(0xFF00FF, 64, 100);
	}

	function connect(name:String, ?roomCode:String) {
		network = new Network(SERVER_URL);
		if (roomCode != null && roomCode.length > 0) {
			network.joinById(roomCode, name, onJoined, function(err) {
				lobby.showError("Failed to join: " + Std.string(err));
			});
		} else {
			network.joinOrCreate(name, onJoined, function(err) {
				lobby.showError("Failed to connect: " + Std.string(err));
			});
		}
	}

	function onJoined(room:Room<UnoRoomState>) {
		this.room = room;
		this.state = room.state;
		mySessionId = room.sessionId;

		lobby.root.visible = false;
		hud.setRoomId(room.roomId);

		bindRoomEvents();
	}

	function bindRoomEvents() {
		var cb = Callbacks.get(room);

		// Players
		cb.onAdd("players", function(player:Dynamic, key:Dynamic) {
			var p:PlayerSchema = cast player;
			var k:String = Std.string(key);
			playerCache.set(k, p);

			if (p.sessionId == mySessionId)
				localSeatIndex = Std.int(p.seatIndex);

			cb.listen(p, "handCount", function(val:Dynamic, prev:Dynamic) {});
			cb.listen(p, "name", function(val:Dynamic, prev:Dynamic) {});
			cb.listen(p, "seatIndex", function(val:Dynamic, prev:Dynamic) {
				if (p.sessionId == mySessionId)
					localSeatIndex = Std.int(p.seatIndex);
			});
		});

		cb.onRemove("players", function(player:Dynamic, key:Dynamic) {
			var k:String = Std.string(key);
			playerCache.remove(k);
		});

		// Discard pile — just need the callbacks registered for Colyseus sync
		cb.onAdd("discardPile", function(card:Dynamic, key:Dynamic) {});
		cb.onRemove("discardPile", function(card:Dynamic, key:Dynamic) {});
	}

	// ── Card texture mapping ────────────────────────────────────────

	function cardTextureFromSchema(card:UnoCardSchema):String {
		if (card.cardType == "wild")
			return card.value;
		return card.color + "_" + card.value;
	}

	function canPlayCard(card:UnoCardSchema, topCard:UnoCardSchema, activeColor:String):Bool {
		if (card.cardType == "wild")
			return true;
		if (card.color == activeColor)
			return true;
		if (topCard.cardType == "color" && card.value == topCard.value)
			return true;
		return false;
	}

	// ── Visual position helpers ─────────────────────────────────────

	function getVisualPosition(seatIndex:Int):Int {
		return ((seatIndex - localSeatIndex) + 4) % 4;
	}

	function hashRotation(id:String, index:Int):Float {
		var h = index * 7;
		for (i in 0...id.length) {
			h = (h * 31 + id.charCodeAt(i));
			h = h & 0x7FFFFFFF;
		}
		return ((h % 40) - 20) * (Math.PI / 180);
	}

	// ── Helper: gather players ──────────────────────────────────────

	function gatherPlayers():Array<PlayerInfo> {
		var result:Array<PlayerInfo> = [];
		for (p in playerCache) {
			var si = Std.int(p.seatIndex);
			result.push({
				seatIndex: si,
				visualPos: getVisualPosition(si),
				player: p,
			});
		}
		result.sort(function(a, b) return a.visualPos - b.visualPos);
		return result;
	}

	function getLocalHand(players:Array<PlayerInfo>):Array<UnoCardSchema> {
		var localHand:Array<UnoCardSchema> = [];
		for (info in players) {
			if (info.visualPos == 0 && info.player.hand != null) {
				for (i in 0...info.player.hand.items.length) {
					var card = info.player.hand.items[i];
					if (card != null)
						localHand.push(card);
				}
			}
		}
		return localHand;
	}

	function getLocalHandDirect():Array<UnoCardSchema> {
		var localHand:Array<UnoCardSchema> = [];
		for (p in playerCache) {
			if (p.sessionId == mySessionId && p.hand != null) {
				for (i in 0...p.hand.items.length) {
					var card = p.hand.items[i];
					if (card != null)
						localHand.push(card);
				}
			}
		}
		return localHand;
	}

	// ── Layout computation ──────────────────────────────────────────

	function computeLayout():{
		playerScale:Float,
		playerSpacing:Float,
		playerHoverScale:Float,
		hoverLift:Float,
		bottomY:Float,
		opponentScale:Float,
		hSpacing:Float,
		vSpacing:Float,
		topY:Float,
		sideX:Float,
		sideYOffset:Float,
		pileX:Float,
		pileScale:Float,
		discardScale:Float,
		showcaseScale:Float,
	} {
		var vw = screenW;
		var vh = screenH;
		var portrait = vw < vh;
		var unit = Math.min(vw, vh);

		var playerScale = portrait ? vw * 0.07 : unit * 0.06;
		var playerSpacing = playerScale * (portrait ? 0.55 : 0.7);
		var playerHoverScale = playerScale * 1.12;
		var hoverLift = playerScale * 0.3;
		var bottomY = vh * 0.88;

		var opponentScale = portrait ? vw * 0.055 : unit * 0.045;
		var hSpacing = opponentScale * 0.35;
		var vSpacing = opponentScale * 0.35;
		var topY = vh * 0.08;
		var sideX = clamp(vw * 0.42, unit * 0.3, vw * 0.45);
		var sideYOffset = vh * 0.47;

		var pileX = clamp(unit * 0.18, 60, 180);
		var pileScale = portrait ? vw * 0.05 : unit * 0.038;
		var discardScale = portrait ? vw * 0.055 : unit * 0.042;
		var showcaseScale = portrait ? vw * 0.18 : unit * 0.14;

		return {
			playerScale: playerScale,
			playerSpacing: playerSpacing,
			playerHoverScale: playerHoverScale,
			hoverLift: hoverLift,
			bottomY: bottomY,
			opponentScale: opponentScale,
			hSpacing: hSpacing,
			vSpacing: vSpacing,
			topY: topY,
			sideX: sideX,
			sideYOffset: sideYOffset,
			pileX: pileX,
			pileScale: pileScale,
			discardScale: discardScale,
			showcaseScale: showcaseScale,
		};
	}

	// ── Build card renders ──────────────────────────────────────────

	function buildCardRenders():Array<CardRender> {
		if (state == null)
			return [];

		var L = computeLayout();
		var result:Array<CardRender> = [];
		var placed = new Map<String, Bool>();

		var cx = screenW * 0.5;
		var cy = screenH * 0.5;

		var playersByVisualPos = gatherPlayers();
		var localHand = getLocalHand(playersByVisualPos);

		// Compute playable set
		var playableSet = new Map<String, Bool>();
		if (state.currentPlayer == localSeatIndex && showcaseCardId == "" && colorPickerForId == "" && state.winner == -1
			&& state.pendingDraw == 0
			&& state.discardPile.items.length > 0) {
			var topCard = state.discardPile.items[state.discardPile.items.length - 1];
			if (topCard != null) {
				for (card in localHand) {
					if (canPlayCard(card, topCard, state.activeColor)) {
						playableSet.set(card.id, true);
					}
				}
			}
		}

		// Compute animation origins for new cards
		var newCardAnims = new Map<String, {x:Float, y:Float}>();
		computeNewCardAnimations(newCardAnims, localHand, playersByVisualPos, L, cx, cy);

		var discardLen = state.discardPile.items.length;
		var discardBaseZ:Float = 50;

		// --- Showcase card ---
		if (showcaseCardId != "") {
			var card:UnoCardSchema = null;
			for (c in localHand) {
				if (c.id == showcaseCardId) {
					card = c;
					break;
				}
			}
			if (card == null) {
				for (i in 0...discardLen) {
					var c = state.discardPile.items[i];
					if (c != null && c.id == showcaseCardId) {
						card = c;
						break;
					}
				}
			}
			if (card != null) {
				placed.set(card.id, true);
				result.push({
					key: card.id,
					textureId: cardTextureFromSchema(card),
					x: cx,
					y: cy * 0.8,
					z: discardBaseZ + discardLen + 100,
					rotZ: 0,
					faceUp: true,
					scale: L.showcaseScale / 100,
					shake: false,
					initialX: null,
					initialY: null,
				});
			}
		}

		// --- Discard pile ---
		for (i in 0...discardLen) {
			var card = state.discardPile.items[i];
			if (card == null)
				continue;
			if (placed.exists(card.id))
				continue;
			placed.set(card.id, true);

			var anim = newCardAnims.get(card.id);

			result.push({
				key: card.id,
				textureId: cardTextureFromSchema(card),
				x: cx + L.pileX + (((i * 13) % 7) - 3) * 0.5,
				y: cy + (((i * 7) % 5) - 2) * 0.5,
				z: discardBaseZ + i,
				rotZ: hashRotation(card.id, i),
				faceUp: true,
				scale: L.discardScale / 100,
				shake: false,
				initialX: anim != null ? anim.x : null,
				initialY: anim != null ? anim.y : null,
			});
		}

		// --- Local player hand ---
		var hand0:Array<UnoCardSchema> = [];
		for (c in localHand) {
			if (!placed.exists(c.id))
				hand0.push(c);
		}

		for (i in 0...hand0.length) {
			var card = hand0[i];
			placed.set(card.id, true);
			var center:Float = i - (hand0.length - 1) / 2.0;
			var playable = playableSet.exists(card.id);
			var hovered = playable && card.id == hoveredCardId;

			var colorMatch = false;
			if (colorPicker.hoveredColor != null && card.cardType == "color" && card.color == colorPicker.hoveredColor) {
				colorMatch = true;
			}

			var fanAngle = center * 0.03;
			var lift:Float = 0;
			if (colorMatch)
				lift = L.hoverLift * 0.7;
			else if (playable)
				lift = L.hoverLift * 0.55;

			var anim = newCardAnims.get(card.id);

			result.push({
				key: card.id,
				textureId: cardTextureFromSchema(card),
				x: cx + center * L.playerSpacing,
				y: L.bottomY - (hovered ? L.hoverLift : lift) - Math.abs(center) * 0.5,
				z: 10 + i + (hovered ? 5 : 0),
				rotZ: fanAngle,
				faceUp: true,
				scale: (hovered ? L.playerHoverScale : L.playerScale) / 100,
				shake: hand0.length == 1 && state.winner == -1,
				initialX: anim != null ? anim.x : null,
				initialY: anim != null ? anim.y : null,
			});
		}

		// --- Opponents ---
		for (info in playersByVisualPos) {
			if (info.visualPos == 0)
				continue;

			var hc = Std.int(info.player.handCount);
			for (i in 0...hc) {
				var center:Float = i - (hc - 1) / 2.0;
				var px:Float = 0;
				var py:Float = 0;
				var rot:Float = 0;

				if (info.visualPos == 1) {
					px = cx - L.sideX;
					py = center * L.vSpacing + L.sideYOffset;
					rot = Math.PI / 2;
				} else if (info.visualPos == 2) {
					px = cx + center * L.hSpacing;
					py = L.topY;
					rot = 0;
				} else {
					px = cx + L.sideX;
					py = center * L.vSpacing + L.sideYOffset;
					rot = -Math.PI / 2;
				}

				var opKey = "opponent-" + info.seatIndex + "-" + i;
				var anim = newCardAnims.get(opKey);

				result.push({
					key: opKey,
					textureId: "back",
					x: px,
					y: py,
					z: i,
					rotZ: rot,
					faceUp: false,
					scale: L.opponentScale / 100,
					shake: hc == 1 && state.winner == -1,
					initialX: anim != null ? anim.x : null,
					initialY: anim != null ? anim.y : null,
				});
			}
		}

		// --- Draw pile ---
		var drawCount = Std.int(state.drawPileCount);
		var visibleCount = Std.int(Math.min(drawCount, 8));
		var drawCardW = L.pileScale / 100 * 240; // rendered card width in pixels
		for (i in 0...visibleCount) {
			var depth:Float = visibleCount > 1 ? (visibleCount - 1 - i) / (visibleCount - 1) : 0;
			result.push({
				key: "draw-" + i,
				textureId: "back",
				x: cx - L.pileX + depth * drawCardW * 0.06,
				y: cy - depth * drawCardW * 0.12,
				z: i,
				rotZ: 0,
				faceUp: false,
				scale: L.pileScale / 100,
				shake: false,
				initialX: null,
				initialY: null,
			});
		}

		// Update prev tracking
		updatePrevState(localHand, playersByVisualPos);

		return result;
	}

	function computeNewCardAnimations(anims:Map<String, {x:Float, y:Float}>, localHand:Array<UnoCardSchema>,
			playersByVisualPos:Array<PlayerInfo>, L:Dynamic, cx:Float, cy:Float) {
		if (state == null)
			return;

		var discardLen = state.discardPile.items.length;

		function handCenter(vp:Int):{x:Float, y:Float} {
			return switch (vp) {
				case 1: {x: cx - L.sideX, y: L.sideYOffset};
				case 2: {x: cx, y: L.topY};
				case 3: {x: cx + L.sideX, y: L.sideYOffset};
				default: {x: cx, y: L.bottomY};
			};
		}

		var drawPileOrigin = {x: cx - L.pileX, y: cy};

		// New discard card from opponent
		if (discardLen > prevDiscardLen && prevCurrentPlayerForAnim >= 0) {
			var newCard = state.discardPile.items[discardLen - 1];
			if (newCard != null) {
				var fromVisualPos = getVisualPosition(prevCurrentPlayerForAnim);
				if (fromVisualPos != 0) {
					var hc = handCenter(fromVisualPos);
					anims.set(newCard.id, hc);
				}
			}
		}

		// New opponent hand cards from draw pile
		for (info in playersByVisualPos) {
			if (info.visualPos == 0)
				continue;
			var si = Std.int(info.player.seatIndex);
			var hc = Std.int(info.player.handCount);
			var prevCount = prevHandCounts.exists(si) ? prevHandCounts.get(si) : 0;
			if (hc > prevCount) {
				for (i in prevCount...hc) {
					anims.set("opponent-" + si + "-" + i, drawPileOrigin);
				}
			}
		}

		// New local hand cards from draw pile
		for (card in localHand) {
			if (!prevLocalHandIds.exists(card.id)) {
				anims.set(card.id, drawPileOrigin);
			}
		}
	}

	function updatePrevState(localHand:Array<UnoCardSchema>, playersByVisualPos:Array<PlayerInfo>) {
		if (state == null)
			return;
		prevDiscardLen = state.discardPile.items.length;
		prevCurrentPlayerForAnim = Std.int(state.currentPlayer);
		for (info in playersByVisualPos) {
			prevHandCounts.set(Std.int(info.player.seatIndex), Std.int(info.player.handCount));
		}
		prevLocalHandIds = new Map();
		for (card in localHand) {
			prevLocalHandIds.set(card.id, true);
		}
	}

	// ── Card entity management ──────────────────────────────────────

	function syncCards(renders:Array<CardRender>) {
		var activeKeys = new Map<String, Bool>();

		for (r in renders) {
			activeKeys.set(r.key, true);

			var card = cards.get(r.key);
			if (card == null) {
				var frontTile = getCardTile(r.textureId);
				card = new Card(cardLayer, frontTile, backTile);
				card.key = r.key;
				card.textureId = r.textureId;

				if (r.initialX != null && r.initialY != null) {
					card.setInitialPosition(r.initialX, r.initialY);
				}

				cards.set(r.key, card);
			} else {
				if (card.textureId != r.textureId) {
					card.textureId = r.textureId;
					card.setFrontTile(getCardTile(r.textureId));
				}
			}

			card.targetX = r.x;
			card.targetY = r.y;
			card.targetZ = r.z;
			card.targetRotZ = r.rotZ;
			card.targetFaceUp = r.faceUp;
			card.targetScale = r.scale;
			card.shake = r.shake;
		}

		// Remove cards no longer rendered
		var toRemove:Array<String> = [];
		for (key in cards.keys()) {
			if (!activeKeys.exists(key))
				toRemove.push(key);
		}
		for (key in toRemove) {
			var card = cards.get(key);
			if (card != null)
				card.dispose();
			cards.remove(key);
		}

		// Sort children by Z for proper draw order
		sortCardsByZ();
	}

	function sortCardsByZ() {
		var sorted:Array<Card> = [];
		for (card in cards) {
			sorted.push(card);
		}
		sorted.sort(function(a, b) {
			if (a.targetZ < b.targetZ)
				return -1;
			if (a.targetZ > b.targetZ)
				return 1;
			return 0;
		});

		for (i in 0...sorted.length) {
			cardLayer.addChild(sorted[i].group);
		}
	}

	// ── Interaction ─────────────────────────────────────────────────

	function handleClick(mx:Float, my:Float) {
		if (state == null || room == null)
			return;
		if (state.winner != -1 || showcaseCardId != "" || colorPickerForId != "")
			return;
		if (state.currentPlayer != localSeatIndex)
			return;

		var L = computeLayout();
		var cx = screenW * 0.5;
		var localHand = getLocalHandDirect();

		if (state.discardPile.items.length == 0)
			return;
		var topCard = state.discardPile.items[state.discardPile.items.length - 1];
		if (topCard == null)
			return;

		// Actual card pixel half-dimensions at rendered scale
		var cardScale = L.playerScale / 100;
		var cardHalfW = 240 * cardScale * 0.5;
		var cardHalfH = 375 * cardScale * 0.5;

		// Check from last card (topmost visually) down — full card bounds, first hit wins
		var i = localHand.length - 1;
		while (i >= 0) {
			var card = localHand[i];
			if (canPlayCard(card, topCard, state.activeColor)) {
				var center:Float = i - (localHand.length - 1) / 2.0;
				var cardX = cx + center * L.playerSpacing;
				var cardY = L.bottomY - L.hoverLift * 0.35 - Math.abs(center) * 0.5;

				if (mx >= cardX - cardHalfW && mx <= cardX + cardHalfW && my >= cardY - cardHalfH && my <= cardY + cardHalfH) {
					onPlayCard(card);
					return;
				}
			}
			i--;
		}
	}

	function updateHover(mx:Float, my:Float) {
		if (state == null || state.currentPlayer != localSeatIndex || state.winner != -1 || showcaseCardId != "")
			return;

		var L = computeLayout();
		var cx = screenW * 0.5;
		hoveredCardId = "";

		var localHand = getLocalHandDirect();

		if (state.discardPile.items.length == 0)
			return;
		var topCard = state.discardPile.items[state.discardPile.items.length - 1];
		if (topCard == null)
			return;

		// Actual card pixel half-dimensions at rendered scale
		var cardScale = L.playerScale / 100;
		var cardHalfW = 240 * cardScale * 0.5;
		var cardHalfH = 375 * cardScale * 0.5;

		var i = localHand.length - 1;
		while (i >= 0) {
			var card = localHand[i];
			if (canPlayCard(card, topCard, state.activeColor)) {
				var center:Float = i - (localHand.length - 1) / 2.0;
				var cardX = cx + center * L.playerSpacing;
				var cardY = L.bottomY - L.hoverLift * 0.35 - Math.abs(center) * 0.5;

				if (mx >= cardX - cardHalfW && mx <= cardX + cardHalfW && my >= cardY - cardHalfH && my <= cardY + cardHalfH) {
					hoveredCardId = card.id;
					return;
				}
			}
			i--;
		}
	}

	function onPlayCard(card:UnoCardSchema) {
		if (card.cardType == "wild") {
			colorPickerForId = card.id;
			colorPicker.show(screenW, screenH);
			return;
		}

		network.sendPlayCard(card.id);
		hoveredCardId = "";
		showcaseCardId = card.id;
		showcaseTimer = 0.7;
	}

	function onPickColor(color:String) {
		if (colorPickerForId == "")
			return;
		var cardId = colorPickerForId;

		network.sendPlayCard(cardId, color);
		colorPicker.hide();
		colorPickerForId = "";
		hoveredCardId = "";
		showcaseCardId = cardId;
		showcaseTimer = 0.7;
	}

	// ── Drawing ─────────────────────────────────────────────────────

	function drawTable() {
		tableBg.clear();
		tableBg.beginFill(FELT_COLOR);
		tableBg.drawRect(0, 0, screenW, screenH);
		tableBg.endFill();
	}

	function drawColorRing() {
		colorRing.clear();
		if (state == null || state.phase != "playing")
			return;

		var L = computeLayout();
		var cx = screenW * 0.5;
		var cy = screenH * 0.5;

		var activeColor = state.activeColor;
		var colorHex = COLOR_HEX.exists(activeColor) ? COLOR_HEX.get(activeColor) : 0xFF3333;

		if (activeColor != prevActiveColor) {
			prevActiveColor = activeColor;
			colorRingScale = 1.8;
			colorRingVelScale = 0;
		}

		var cardW = L.discardScale / 100 * 240; // rendered card width in pixels
		var outerR = 0.62 * cardW * colorRingScale;
		var innerR = 0.55 * cardW * colorRingScale;

		if (outerR > 1) {
			colorRing.beginFill(colorHex);
			colorRing.drawCircle(0, 0, outerR);
			colorRing.endFill();
			colorRing.beginFill(FELT_COLOR);
			colorRing.drawCircle(0, 0, innerR);
			colorRing.endFill();
		}

		colorRing.x = cx + L.pileX;
		colorRing.y = cy;
	}

	function drawTurnIndicator(dt:Float) {
		turnArrow.clear();
		if (state == null || state.phase != "playing" || state.winner != -1)
			return;

		var cx = screenW * 0.5;
		var cy = screenH * 0.5;
		var vh = screenH;
		var vw = screenW;
		var radius = Math.min(vh * 0.28, vw * 0.32);

		var currentVisualPos = getVisualPosition(Std.int(state.currentPlayer));
		var targetAngle = PLAYER_ANGLE[currentVisualPos];

		if (prevCurrentPlayer != currentVisualPos) {
			var diff = targetAngle - turnArrowAngle;
			while (diff > Math.PI)
				diff -= Math.PI * 2;
			while (diff < -Math.PI)
				diff += Math.PI * 2;
			if (Math.abs(diff) < 0.01)
				diff = state.direction * Math.PI * 2;
			turnArrowTarget = turnArrowAngle + diff;
			prevCurrentPlayer = currentVisualPos;
		}

		// Spring (stiffness 120, damping 22)
		var acc = 120 * (turnArrowTarget - turnArrowAngle) - 22 * turnArrowVel;
		turnArrowVel += acc * dt;
		turnArrowAngle += turnArrowVel * dt;

		// Main arrow
		var s = radius * 0.15;
		var ax = cx + Math.cos(turnArrowAngle) * radius;
		var ay = cy + Math.sin(turnArrowAngle) * radius;

		turnArrow.beginFill(0xFFFFFF, 0.8);
		var tipX = ax + Math.cos(turnArrowAngle) * s;
		var tipY = ay + Math.sin(turnArrowAngle) * s;
		var leftX = ax + Math.cos(turnArrowAngle + 2.5) * s * 0.6;
		var leftY = ay + Math.sin(turnArrowAngle + 2.5) * s * 0.6;
		var rightX = ax + Math.cos(turnArrowAngle - 2.5) * s * 0.6;
		var rightY = ay + Math.sin(turnArrowAngle - 2.5) * s * 0.6;
		turnArrow.moveTo(tipX, tipY);
		turnArrow.lineTo(leftX, leftY);
		turnArrow.lineTo(rightX, rightY);
		turnArrow.endFill();

		// Direction arrows (spinning slowly)
		var spinSpeed:Float = state.direction == 1 ? 0.1 : -0.1;
		dirArrowAngle += spinSpeed * dt;

		var ds = radius * 0.08;
		for (j in 0...4) {
			var a = dirArrowAngle + (j / 4.0) * Math.PI * 2 + Math.PI / 4;
			var tangent = a + (state.direction == 1 ? Math.PI / 2 : -Math.PI / 2);
			var dx = cx + Math.cos(a) * radius * 0.85;
			var dy = cy + Math.sin(a) * radius * 0.85;

			turnArrow.beginFill(0xFFFFFF, 0.3);
			var dtipX = dx + Math.cos(tangent) * ds;
			var dtipY = dy + Math.sin(tangent) * ds;
			var dleftX = dx + Math.cos(tangent + 2.5) * ds * 0.5;
			var dleftY = dy + Math.sin(tangent + 2.5) * ds * 0.5;
			var drightX = dx + Math.cos(tangent - 2.5) * ds * 0.5;
			var drightY = dy + Math.sin(tangent - 2.5) * ds * 0.5;
			turnArrow.moveTo(dtipX, dtipY);
			turnArrow.lineTo(dleftX, dleftY);
			turnArrow.lineTo(drightX, drightY);
			turnArrow.endFill();
		}
	}

	function drawWinnerDim() {
		if (state == null)
			return;
		var showWinner = state.winner != -1;
		if (showWinner != winnerShown) {
			winnerShown = showWinner;
			winnerDim.visible = showWinner;
			if (showWinner) {
				winnerDim.clear();
				winnerDim.beginFill(0x000000, 0.5);
				winnerDim.drawRect(0, 0, screenW, screenH);
				winnerDim.endFill();
			}
		}
	}

	// ── Main update loop ────────────────────────────────────────────

	public function update(dt:Float) {
		var w = hxd.Window.getInstance();
		if (w.width != screenW || w.height != screenH) {
			screenW = w.width;
			screenH = w.height;
			lobby.resize(screenW, screenH);
			hud.resize(screenW, screenH);
		}

		if (room == null)
			return;

		if (state == null)
			return;

		// Showcase timer
		if (showcaseTimer > 0) {
			showcaseTimer -= dt;
			if (showcaseTimer <= 0) {
				showcaseCardId = "";
			}
		}

		// Mouse hover
		updateHover(s2d.mouseX, s2d.mouseY);

		// Draw table
		drawTable();

		// Spring the color ring scale
		var clamped_dt = Math.min(dt, 0.05);
		var accRing = 200 * (1.0 - colorRingScale) - 30 * colorRingVelScale;
		colorRingVelScale += accRing * clamped_dt;
		colorRingScale += colorRingVelScale * clamped_dt;

		// Draw overlays
		drawColorRing();
		drawTurnIndicator(clamped_dt);
		drawWinnerDim();

		// Build and sync card entities
		var renders = buildCardRenders();
		syncCards(renders);

		// Update card springs
		for (card in cards) {
			card.update(clamped_dt);
		}

		// Color picker
		colorPicker.update(clamped_dt, screenW * 0.5, screenH * 0.5);

		// HUD
		hud.updateState(state, localSeatIndex);

		// Input
		handleInput();
	}

	function handleInput() {
		if (hxd.Key.isPressed(hxd.Key.MOUSE_LEFT)) {
			handleClick(s2d.mouseX, s2d.mouseY);
		}
	}

	static function clamp(v:Float, lo:Float, hi:Float):Float {
		return Math.min(hi, Math.max(lo, v));
	}
}
