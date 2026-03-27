// Lobby screen: name input, quick play, join by code.
// Uses h2d primitives: Text, Graphics, Interactive.

class Lobby {
	public var root:h2d.Object;

	var font:h2d.Font;
	var titleText:h2d.Text;
	var subtitleText:h2d.Text;
	var nameInput:String = "";
	var nameText:h2d.Text;
	var nameBox:h2d.Graphics;
	var nameInter:h2d.Interactive;
	var playBtn:h2d.Interactive;
	var playBtnBg:h2d.Graphics;
	var playBtnText:h2d.Text;
	var dividerText:h2d.Text;
	var codeInput:String = "";
	var codeText:h2d.Text;
	var codeBox:h2d.Graphics;
	var codeInter:h2d.Interactive;
	var joinBtn:h2d.Interactive;
	var joinBtnBg:h2d.Graphics;
	var joinBtnText:h2d.Text;
	var errorText:h2d.Text;
	var statusText:h2d.Text;
	var bg:h2d.Graphics;

	// Card decoration
	var cardBmp:h2d.Bitmap;

	var focusedField:Int = 0; // 0 = name, 1 = code
	var joining:Bool = false;

	var screenW:Float = 800;
	var screenH:Float = 600;

	public var onQuickPlay:Null<(String) -> Void>;
	public var onJoinByCode:Null<(String, String) -> Void>;

	public function new(parent:h2d.Object, ?cardTile:h2d.Tile) {
		root = new h2d.Object(parent);
		font = hxd.res.DefaultFont.get();

		// Background
		bg = new h2d.Graphics(root);

		// Title
		titleText = new h2d.Text(font, root);
		titleText.text = "CARD GAME";
		titleText.textColor = 0xFFCC00;
		titleText.textAlign = Center;
		titleText.setScale(8);

		// Hero card image
		if (cardTile != null) {
			cardBmp = new h2d.Bitmap(cardTile, root);
			cardBmp.setScale(0.7);
			cardBmp.rotation = 0.21; // ~12 degrees
		}

		// Subtitle
		subtitleText = new h2d.Text(font, root);
		subtitleText.text = "COLYSEUS DEMO";
		subtitleText.textColor = 0x80B080;
		subtitleText.textAlign = Center;
		subtitleText.setScale(2.5);

		// Name input box
		nameBox = new h2d.Graphics(root);
		nameText = new h2d.Text(font, root);
		nameText.textColor = 0xFFFFFF;
		nameText.textAlign = Center;
		nameText.setScale(2.5);
		nameInter = new h2d.Interactive(260, 36, root);
		nameInter.onClick = function(_) {
			focusedField = 0;
		};

		// Quick Play button
		playBtnBg = new h2d.Graphics(root);
		playBtnText = new h2d.Text(font, root);
		playBtnText.text = "QUICK PLAY";
		playBtnText.textColor = 0x1A1A1A;
		playBtnText.textAlign = Center;
		playBtnText.setScale(2.5);
		playBtn = new h2d.Interactive(260, 40, root);
		playBtn.onClick = function(_) {
			if (!joining)
				doQuickPlay();
		};

		// Divider
		dividerText = new h2d.Text(font, root);
		dividerText.text = "or join by code";
		dividerText.textColor = 0x597059;
		dividerText.textAlign = Center;
		dividerText.setScale(2.0);

		// Code input
		codeBox = new h2d.Graphics(root);
		codeText = new h2d.Text(font, root);
		codeText.textColor = 0xFFFFFF;
		codeText.textAlign = Center;
		codeText.setScale(2.5);
		codeInter = new h2d.Interactive(160, 36, root);
		codeInter.onClick = function(_) {
			focusedField = 1;
		};

		// Join button
		joinBtnBg = new h2d.Graphics(root);
		joinBtnText = new h2d.Text(font, root);
		joinBtnText.text = "JOIN";
		joinBtnText.textColor = 0x1A1A1A;
		joinBtnText.textAlign = Center;
		joinBtnText.setScale(2.5);
		joinBtn = new h2d.Interactive(90, 40, root);
		joinBtn.onClick = function(_) {
			if (!joining && codeInput.length > 0)
				doJoinByCode();
		};

		// Error
		errorText = new h2d.Text(font, root);
		errorText.textColor = 0xFF6B6B;
		errorText.textAlign = Center;
		errorText.setScale(2.0);
		errorText.text = "";

		// Status
		statusText = new h2d.Text(font, root);
		statusText.textColor = 0xAAAAAA;
		statusText.textAlign = Center;
		statusText.setScale(2.0);
		statusText.text = "";

		// Keyboard input
		hxd.Window.getInstance().addEventTarget(onEvent);
	}

	function onEvent(e:hxd.Event) {
		if (!root.visible)
			return;
		if (joining)
			return;

		switch (e.kind) {
			case ETextInput:
				var char = String.fromCharCode(e.charCode);
				if (focusedField == 0 && nameInput.length < 16) {
					nameInput += char;
					updateInputTexts();
				} else if (focusedField == 1 && codeInput.length < 20) {
					codeInput += char;
					updateInputTexts();
				}
			case EKeyDown:
				if (e.keyCode == hxd.Key.BACKSPACE) {
					if (focusedField == 0 && nameInput.length > 0) {
						nameInput = nameInput.substr(0, nameInput.length - 1);
						updateInputTexts();
					} else if (focusedField == 1 && codeInput.length > 0) {
						codeInput = codeInput.substr(0, codeInput.length - 1);
						updateInputTexts();
					}
				}
				if (e.keyCode == hxd.Key.ENTER) {
					if (focusedField == 0)
						doQuickPlay();
					else if (codeInput.length > 0)
						doJoinByCode();
				}
				if (e.keyCode == hxd.Key.TAB) {
					focusedField = focusedField == 0 ? 1 : 0;
				}
			default:
		}
	}

	function updateInputTexts() {
		nameText.text = nameInput.length > 0 ? nameInput : "Enter your name...";
		nameText.textColor = nameInput.length > 0 ? 0xFFFFFF : 0x666666;
		codeText.text = codeInput.length > 0 ? codeInput : "Room code...";
		codeText.textColor = codeInput.length > 0 ? 0xFFFFFF : 0x666666;
	}

	function doQuickPlay() {
		joining = true;
		errorText.text = "";
		statusText.text = "Connecting...";
		var name = nameInput.length > 0 ? nameInput : "Player";
		if (onQuickPlay != null)
			onQuickPlay(name);
	}

	function doJoinByCode() {
		joining = true;
		errorText.text = "";
		statusText.text = "Joining...";
		var name = nameInput.length > 0 ? nameInput : "Player";
		if (onJoinByCode != null)
			onJoinByCode(codeInput, name);
	}

	public function showError(msg:String) {
		joining = false;
		statusText.text = "";
		errorText.text = msg;
	}

	public function resize(sw:Float, sh:Float) {
		screenW = sw;
		screenH = sh;
		layout();
	}

	function layout() {
		var cx = screenW * 0.5;
		var unit = Math.min(screenW, screenH);
		var baseY = screenH * 0.15;
		var spacing = unit * 0.12;
		var rounding = unit * 0.015;

		// Responsive text scales
		titleText.setScale(unit * 0.013);
		subtitleText.setScale(unit * 0.004);
		nameText.setScale(unit * 0.004);
		playBtnText.setScale(unit * 0.004);
		dividerText.setScale(unit * 0.0033);
		codeText.setScale(unit * 0.004);
		joinBtnText.setScale(unit * 0.004);
		errorText.setScale(unit * 0.0033);
		statusText.setScale(unit * 0.0033);

		// Background gradient (simplified as solid)
		bg.clear();
		bg.beginFill(0x1A7A3C);
		bg.drawRect(0, 0, screenW, screenH);
		bg.endFill();
		bg.beginFill(0x0D3D20, 0.5);
		bg.drawRect(0, 0, screenW, screenH);
		bg.endFill();

		// Title
		titleText.x = cx;
		titleText.y = baseY;
		var titleH = titleText.textHeight * titleText.scaleY;

		// Hero card
		if (cardBmp != null) {
			cardBmp.setScale(unit * 0.001);
			cardBmp.x = cx + unit * 0.42;
			cardBmp.y = baseY - unit * 0.03;
		}

		// Subtitle
		subtitleText.x = cx;
		subtitleText.y = baseY + titleH + spacing * 0.2;

		// Name input
		var inputY = baseY + titleH + spacing * 1.2;
		var inputW = unit * 0.65;
		var inputH = unit * 0.08;
		nameBox.clear();
		nameBox.beginFill(0x000000, 0.3);
		nameBox.drawRoundedRect(cx - inputW * 0.5, inputY, inputW, inputH, rounding);
		nameBox.endFill();
		if (focusedField == 0) {
			nameBox.lineStyle(unit * 0.003, 0xFFCC00);
			nameBox.drawRoundedRect(cx - inputW * 0.5, inputY, inputW, inputH, rounding);
			nameBox.lineStyle();
		}
		nameText.x = cx;
		nameText.y = inputY + inputH * 0.2;
		nameInter.x = cx - inputW * 0.5;
		nameInter.y = inputY;
		nameInter.width = inputW;
		nameInter.height = inputH;
		updateInputTexts();

		// Play button
		var btnY = inputY + spacing;
		var btnH = unit * 0.09;
		playBtnBg.clear();
		playBtnBg.beginFill(joining ? 0x806600 : 0xFFCC00);
		playBtnBg.drawRoundedRect(cx - inputW * 0.5, btnY, inputW, btnH, rounding);
		playBtnBg.endFill();
		playBtnText.x = cx;
		playBtnText.y = btnY + btnH * 0.22;
		playBtn.x = cx - inputW * 0.5;
		playBtn.y = btnY;
		playBtn.width = inputW;
		playBtn.height = btnH;

		// Divider
		dividerText.x = cx;
		dividerText.y = btnY + spacing;

		// Code row
		var codeY = btnY + spacing * 1.8;
		var codeW = unit * 0.4;
		var joinW = unit * 0.22;
		var gap = unit * 0.02;
		var rowW = codeW + gap + joinW;
		var rowX = cx - rowW * 0.5;

		codeBox.clear();
		codeBox.beginFill(0x000000, 0.3);
		codeBox.drawRoundedRect(rowX, codeY, codeW, inputH, rounding);
		codeBox.endFill();
		if (focusedField == 1) {
			codeBox.lineStyle(unit * 0.003, 0xFFCC00);
			codeBox.drawRoundedRect(rowX, codeY, codeW, inputH, rounding);
			codeBox.lineStyle();
		}
		codeText.x = rowX + codeW * 0.5;
		codeText.y = codeY + inputH * 0.2;
		codeInter.x = rowX;
		codeInter.y = codeY;
		codeInter.width = codeW;
		codeInter.height = inputH;

		var joinX = rowX + codeW + gap;
		joinBtnBg.clear();
		joinBtnBg.beginFill(codeInput.length > 0 ? 0xFFCC00 : 0x806600);
		joinBtnBg.drawRoundedRect(joinX, codeY, joinW, btnH, rounding);
		joinBtnBg.endFill();
		joinBtnText.x = joinX + joinW * 0.5;
		joinBtnText.y = codeY + btnH * 0.22;
		joinBtn.x = joinX;
		joinBtn.y = codeY;
		joinBtn.width = joinW;
		joinBtn.height = btnH;

		// Error / Status
		errorText.x = cx;
		errorText.y = codeY + inputH + unit * 0.03;
		statusText.x = cx;
		statusText.y = codeY + inputH + unit * 0.03;
	}

	public function dispose() {
		hxd.Window.getInstance().removeEventTarget(onEvent);
		root.remove();
	}
}
