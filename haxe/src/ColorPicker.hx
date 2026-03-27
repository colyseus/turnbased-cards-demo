// Color picker overlay for wild card color selection.
// Shows 4 colored circles in a diamond pattern with spring animations.

class ColorPicker {
	static final PICKER_COLORS:Array<String> = ["red", "yellow", "green", "blue"];
	static final PICKER_HEX:Array<Int> = [0xFF3333, 0xFFCC00, 0x33BB44, 0x3377FF];
	static final STAGGER_MS:Float = 0.08; // seconds between each circle appearing
	var circleRadius:Float = 35;
	var orbitRadius:Float = 60;
	static final STIFFNESS:Float = 200;
	static final DAMPING:Float = 30;

	public var root:h2d.Object;

	var overlay:h2d.Graphics;
	var circles:Array<h2d.Interactive>;
	var circleGfx:Array<h2d.Graphics>;
	var circleScales:Array<Float>;
	var circleVels:Array<Float>;
	var overlayAlpha:Float = 0;
	var overlayVel:Float = 0;
	var elapsed:Float = 0;
	var hoveredIndex:Int = -1;

	public var visible(get, set):Bool;
	public var onPickColor:Null<(String) -> Void>;
	public var hoveredColor:Null<String>;

	var screenW:Float;
	var screenH:Float;

	public function new(parent:h2d.Object) {
		root = new h2d.Object(parent);
		root.visible = false;

		overlay = new h2d.Graphics(root);

		circles = [];
		circleGfx = [];
		circleScales = [];
		circleVels = [];

		for (i in 0...4) {
			var gfx = new h2d.Graphics(root);
			circleGfx.push(gfx);

			var inter = new h2d.Interactive(circleRadius * 2, circleRadius * 2, root);
			inter.x = 0;
			inter.y = 0;

			var idx = i;
			inter.onOver = function(_) {
				hoveredIndex = idx;
				hoveredColor = PICKER_COLORS[idx];
			};
			inter.onOut = function(_) {
				if (hoveredIndex == idx) {
					hoveredIndex = -1;
					hoveredColor = null;
				}
			};
			inter.onClick = function(_) {
				if (onPickColor != null)
					onPickColor(PICKER_COLORS[idx]);
			};
			circles.push(inter);
			circleScales.push(0);
			circleVels.push(0);
		}
	}

	public function show(sw:Float, sh:Float) {
		screenW = sw;
		screenH = sh;
		var unit = Math.min(sw, sh);
		circleRadius = unit * 0.06;
		orbitRadius = unit * 0.1;
		root.visible = true;
		elapsed = 0;
		overlayAlpha = 0;
		overlayVel = 0;
		hoveredIndex = -1;
		hoveredColor = null;
		for (i in 0...4) {
			circleScales[i] = 0;
			circleVels[i] = 0;
		}
		layoutOverlay();
	}

	public function hide() {
		root.visible = false;
		hoveredColor = null;
		hoveredIndex = -1;
	}

	function layoutOverlay() {
		overlay.clear();
		overlay.beginFill(0x000000, 0.5);
		overlay.drawRect(0, 0, screenW, screenH);
		overlay.endFill();
		overlay.x = -screenW * 0.5;
		overlay.y = -screenH * 0.5;
	}

	public function update(dt:Float, centerX:Float, centerY:Float) {
		if (!root.visible)
			return;

		dt = Math.min(dt, 0.05);
		elapsed += dt;

		// Spring overlay alpha
		var accO = STIFFNESS * (0.5 - overlayAlpha) - DAMPING * overlayVel;
		overlayVel += accO * dt;
		overlayAlpha += overlayVel * dt;
		overlay.alpha = Math.max(0, Math.min(1, overlayAlpha));

		// Position the root at screen center
		root.x = centerX;
		root.y = centerY;

		// Update each circle
		for (i in 0...4) {
			var delay = (i + 1) * STAGGER_MS;
			var target:Float = 0;
			if (elapsed > delay) {
				target = hoveredIndex == i ? 1.3 : 1.0;
			}

			var acc = STIFFNESS * (target - circleScales[i]) - DAMPING * circleVels[i];
			circleVels[i] += acc * dt;
			circleScales[i] = Math.max(0, circleScales[i] + circleVels[i] * dt);

			var angle = (i / 4.0) * Math.PI * 2 - Math.PI / 4;
			var cx = Math.cos(angle) * orbitRadius;
			var cy = Math.sin(angle) * orbitRadius;

			var gfx = circleGfx[i];
			gfx.clear();
			var r = circleRadius * circleScales[i];
			if (r > 0.5) {
				gfx.beginFill(PICKER_HEX[i]);
				gfx.drawCircle(0, 0, r);
				gfx.endFill();
			}
			gfx.x = cx;
			gfx.y = cy;

			// Update interactive hit area
			var inter = circles[i];
			inter.x = cx - circleRadius;
			inter.y = cy - circleRadius;
			inter.width = circleRadius * 2;
			inter.height = circleRadius * 2;
		}
	}

	function get_visible():Bool {
		return root.visible;
	}

	function set_visible(v:Bool):Bool {
		root.visible = v;
		return v;
	}
}
