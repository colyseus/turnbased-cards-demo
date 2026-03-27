// HUD overlay: player labels with card counts, room code, winner overlay.
// All rendered using h2d.Text and h2d.Graphics on top of the game scene.

import schema.UnoRoomState;
import schema.PlayerSchema;

class HUD {
	public var root:h2d.Object;

	var font:h2d.Font;

	// Player labels: index = visual position 0-3
	var labelContainers:Array<h2d.Object>;
	var nameTexts:Array<h2d.Text>;
	var countTexts:Array<h2d.Text>;
	var countBgs:Array<h2d.Graphics>;
	var timerGraphics:Array<h2d.Graphics>;

	// Room code
	var roomCodeText:h2d.Text;
	var roomId:String = "";

	// Winner overlay
	var winnerRoot:h2d.Object;
	var winnerBg:h2d.Graphics;
	var winnerText:h2d.Text;
	var newGameBtn:h2d.Interactive;
	var newGameBg:h2d.Graphics;
	var newGameLabel:h2d.Text;
	var winnerVisible:Bool = false;

	public var onRestart:Null<() -> Void>;

	var screenW:Float = 800;
	var screenH:Float = 600;

	public function new(parent:h2d.Object) {
		root = new h2d.Object(parent);
		font = hxd.res.DefaultFont.get();

		labelContainers = [];
		nameTexts = [];
		countTexts = [];
		countBgs = [];
		timerGraphics = [];

		for (i in 0...4) {
			var container = new h2d.Object(root);
			labelContainers.push(container);

			var timerGfx = new h2d.Graphics(container);
			timerGraphics.push(timerGfx);

			var nt = new h2d.Text(font, container);
			nt.textColor = 0xB3B3B3;
			nt.setScale(2.5);
			nameTexts.push(nt);

			var cbg = new h2d.Graphics(container);
			countBgs.push(cbg);

			var ct = new h2d.Text(font, container);
			ct.textColor = 0xFFFFFF;
			ct.setScale(2.0);
			countTexts.push(ct);
		}

		// Room code
		roomCodeText = new h2d.Text(font, root);
		roomCodeText.textColor = 0x808080;
		roomCodeText.x = 16;
		roomCodeText.y = 12;

		// Winner overlay
		winnerRoot = new h2d.Object(root);
		winnerRoot.visible = false;

		winnerBg = new h2d.Graphics(winnerRoot);
		winnerText = new h2d.Text(font, winnerRoot);
		winnerText.textColor = 0xFFCC00;
		winnerText.textAlign = Center;
		winnerText.setScale(7);

		newGameBg = new h2d.Graphics(winnerRoot);
		newGameLabel = new h2d.Text(font, winnerRoot);
		newGameLabel.text = "NEW GAME";
		newGameLabel.textColor = 0x1A1A1A;
		newGameLabel.textAlign = Center;
		newGameLabel.setScale(3.0);

		newGameBtn = new h2d.Interactive(260, 60, winnerRoot);
		newGameBtn.onClick = function(_) {
			if (onRestart != null)
				onRestart();
		};
	}

	public function setRoomId(id:String) {
		roomId = id;
		roomCodeText.text = id;
	}

	public function updateState(state:UnoRoomState, localSeatIndex:Int) {
		if (state == null)
			return;

		// Gather players from the map
		var players:Array<PlayerSchema> = [];
		for (key in state.players.items.keys()) {
			var p = state.players.items.get(key);
			if (p != null)
				players.push(p);
		}

		// Clear all labels first
		for (i in 0...4) {
			labelContainers[i].visible = false;
		}

		for (p in players) {
			var visualPos = ((Std.int(p.seatIndex) - localSeatIndex) + 4) % 4;
			if (visualPos < 0 || visualPos > 3)
				continue;

			labelContainers[visualPos].visible = true;
			var isActive = Std.int(state.currentPlayer) == Std.int(p.seatIndex) && state.winner == -1;

			nameTexts[visualPos].text = p.name;
			var unit = Math.min(screenW, screenH);
			nameTexts[visualPos].textColor = isActive ? 0xFFCC00 : 0xB3B3B3;
			nameTexts[visualPos].setScale(isActive ? unit * 0.0047 : unit * 0.004);

			countTexts[visualPos].text = Std.string(Std.int(p.handCount));

			// Timer — horizontal bar near name
			var timerGfx = timerGraphics[visualPos];
			timerGfx.clear();
			if (isActive && state.turnDeadline > 0) {
				var now = haxe.Timer.stamp() * 1000;
				var duration:Float = p.isBot ? 800 : 7000;
				var remaining = Math.max(0, state.turnDeadline - now);
				var progress = Math.min(1, remaining / duration);

				var timerColor:Int = 0x33BB44;
				if (progress <= 0.2)
					timerColor = 0xFF4444;
				else if (progress <= 0.5)
					timerColor = 0xFFCC00;

				var barW = unit * 0.12;
				var barH = unit * 0.01;
				var barR = barH * 0.5;
				var nameH = nameTexts[visualPos].textHeight * nameTexts[visualPos].scaleY;
				var barGap = unit * 0.01;
				var barX:Float = 0;
				var barY:Float = 0;

				// Position based on visual position
				if (visualPos == 0) {
					// Bottom player: bar above name
					barX = -barW * 0.5;
					barY = -barH - barGap;
				} else if (visualPos == 2) {
					// Top player: bar below name
					barX = -barW * 0.5;
					barY = nameH + barGap;
				} else if (visualPos == 1) {
					// Left player: bar below name, left-aligned
					barX = 0;
					barY = nameH + barGap;
				} else {
					// Right player: bar below name, right-aligned
					barX = -barW;
					barY = nameH + barGap;
				}

				// Background track
				timerGfx.beginFill(0x262626);
				timerGfx.drawRoundedRect(barX, barY, barW, barH, barR);
				timerGfx.endFill();

				// Progress fill
				if (progress > 0.01) {
					timerGfx.beginFill(timerColor);
					timerGfx.drawRoundedRect(barX, barY, barW * progress, barH, barR);
					timerGfx.endFill();
				}
			}
		}

		layoutLabels();

		// Winner overlay
		var showWinner = state.winner != -1;
		if (showWinner != winnerVisible) {
			winnerVisible = showWinner;
			winnerRoot.visible = showWinner;

			if (showWinner) {
				var winnerName = "Player";
				for (p in players) {
					if (Std.int(p.seatIndex) == Std.int(state.winner))
						winnerName = p.name;
				}
				winnerText.text = winnerName + " wins!";
				layoutWinner();
			}
		}
	}

	public function resize(sw:Float, sh:Float) {
		screenW = sw;
		screenH = sh;
		var unit = Math.min(sw, sh);
		roomCodeText.setScale(unit * 0.0033);
		layoutLabels();
		if (winnerVisible)
			layoutWinner();
	}

	function layoutLabels() {
		var unit = Math.min(screenW, screenH);
		var nameScale = unit * 0.004;
		var countScale = unit * 0.0033;
		var gap = unit * 0.012;
		var badgeW = unit * 0.06;
		var badgeH = unit * 0.045;
		var badgeR = unit * 0.018;

		for (i in 0...4) {
			nameTexts[i].setScale(nameScale);
			countTexts[i].setScale(countScale);
		}

		// Position 0 (bottom)
		if (labelContainers[0].visible) {
			labelContainers[0].x = screenW * 0.5;
			labelContainers[0].y = screenH * 0.94;
			nameTexts[0].textAlign = Center;
			nameTexts[0].x = 0;
			nameTexts[0].y = 0;
			layoutBadge(0, nameTexts[0].textWidth * nameTexts[0].scaleX * 0.5 + gap, badgeW, badgeH, badgeR);
		}

		// Position 1 (left)
		if (labelContainers[1].visible) {
			labelContainers[1].x = screenW * 0.02;
			labelContainers[1].y = screenH * 0.5;
			nameTexts[1].textAlign = Left;
			nameTexts[1].x = 0;
			nameTexts[1].y = 0;
			layoutBadge(1, nameTexts[1].textWidth * nameTexts[1].scaleX + gap, badgeW, badgeH, badgeR);
		}

		// Position 2 (top)
		if (labelContainers[2].visible) {
			labelContainers[2].x = screenW * 0.5;
			labelContainers[2].y = screenH * 0.04;
			nameTexts[2].textAlign = Center;
			nameTexts[2].x = 0;
			nameTexts[2].y = 0;
			layoutBadge(2, nameTexts[2].textWidth * nameTexts[2].scaleX * 0.5 + gap, badgeW, badgeH, badgeR);
		}

		// Position 3 (right)
		if (labelContainers[3].visible) {
			labelContainers[3].x = screenW * 0.98;
			labelContainers[3].y = screenH * 0.5;
			nameTexts[3].textAlign = Right;
			nameTexts[3].x = 0;
			nameTexts[3].y = 0;
			layoutBadge(3, gap, badgeW, badgeH, badgeR);
		}
	}

	function layoutBadge(idx:Int, offsetX:Float, badgeW:Float, badgeH:Float, badgeR:Float) {
		var bg = countBgs[idx];
		var ct = countTexts[idx];
		bg.clear();
		bg.beginFill(0x000000, 0.4);
		bg.drawRoundedRect(offsetX, -2, badgeW, badgeH, badgeR);
		bg.endFill();
		ct.x = offsetX + badgeW * 0.5 - ct.textWidth * ct.scaleX * 0.5;
		ct.y = 0;
	}

	function layoutWinner() {
		var unit = Math.min(screenW, screenH);

		winnerBg.clear();
		winnerBg.beginFill(0x000000, 0.5);
		winnerBg.drawRect(0, 0, screenW, screenH);
		winnerBg.endFill();

		winnerText.setScale(unit * 0.012);
		winnerText.x = screenW * 0.5;
		winnerText.y = screenH * 0.4;

		newGameLabel.setScale(unit * 0.005);
		var btnW = unit * 0.42;
		var btnH = unit * 0.1;
		var btnX = screenW * 0.5 - btnW * 0.5;
		var btnY = screenH * 0.55;

		newGameBg.clear();
		newGameBg.beginFill(0xFFCC00);
		newGameBg.drawRoundedRect(btnX, btnY, btnW, btnH, unit * 0.02);
		newGameBg.endFill();

		newGameLabel.x = screenW * 0.5;
		newGameLabel.y = btnY + btnH * 0.2;

		newGameBtn.x = btnX;
		newGameBtn.y = btnY;
		newGameBtn.width = btnW;
		newGameBtn.height = btnH;
	}
}
