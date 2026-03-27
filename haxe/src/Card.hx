// Card entity with spring physics animation.
// Each card is rendered as a pair of h2d.Bitmap faces (front + back)
// wrapped in h2d.Object groups for position, rotation, and flip.

class Card {
	static final STIFFNESS:Float = 200;
	static final DAMPING:Float = 30;

	// The outer group holds position and rotation-Z
	public var group:h2d.Object;

	var frontBmp:h2d.Bitmap;
	var backBmp:h2d.Bitmap;

	// Target state
	public var targetX:Float = 0;
	public var targetY:Float = 0;
	public var targetZ:Float = 0; // used for draw ordering only
	public var targetRotZ:Float = 0;
	public var targetScale:Float = 1;
	public var targetFaceUp:Bool = true;

	// Shake
	public var shake:Bool = false;
	var shakeTime:Float = 0;

	// Spring velocities
	var velX:Float = 0;
	var velY:Float = 0;
	var velRotZ:Float = 0;
	var velScale:Float = 0;
	var velFlip:Float = 0;

	// Current animated values
	var currentScale:Float = 1;
	var currentFlip:Float = 0; // 0 = face up, PI = face down

	var mounted:Bool = false;
	var hasInitialPos:Bool = false;
	var initialX:Float = 0;
	var initialY:Float = 0;

	// Unique key for identity tracking
	public var key:String = "";

	// Texture ID for front face
	public var textureId:String = "";

	public function new(parent:h2d.Object, frontTile:h2d.Tile, backTile:h2d.Tile) {
		group = new h2d.Object(parent);

		// Front face
		frontBmp = new h2d.Bitmap(frontTile, group);
		frontBmp.visible = true;

		// Back face
		backBmp = new h2d.Bitmap(backTile, group);
		backBmp.visible = false;

		// Center the bitmaps on origin
		centerBitmap(frontBmp);
		centerBitmap(backBmp);
	}

	function centerBitmap(bmp:h2d.Bitmap) {
		if (bmp.tile != null) {
			bmp.x = -bmp.tile.width * 0.5;
			bmp.y = -bmp.tile.height * 0.5;
		}
	}

	public function setFrontTile(tile:h2d.Tile) {
		frontBmp.tile = tile;
		centerBitmap(frontBmp);
	}

	public function setInitialPosition(ix:Float, iy:Float) {
		hasInitialPos = true;
		initialX = ix;
		initialY = iy;
	}

	public function update(dt:Float) {
		dt = Math.min(dt, 0.05);

		if (!mounted) {
			mounted = true;
			if (hasInitialPos) {
				group.x = initialX;
				group.y = initialY;
				currentFlip = Math.PI; // start face-down
				currentScale = targetScale;
			} else {
				group.x = targetX;
				group.y = targetY;
				currentFlip = targetFaceUp ? 0 : Math.PI;
				currentScale = targetScale;
			}
			group.rotation = targetRotZ;
			applyVisuals();
			return;
		}

		// Spring position X
		var acc = STIFFNESS * (targetX - group.x) - DAMPING * velX;
		velX += acc * dt;
		group.x += velX * dt;

		// Spring position Y
		acc = STIFFNESS * (targetY - group.y) - DAMPING * velY;
		velY += acc * dt;
		group.y += velY * dt;

		// Spring rotation Z
		acc = STIFFNESS * (targetRotZ - group.rotation) - DAMPING * velRotZ;
		velRotZ += acc * dt;
		group.rotation += velRotZ * dt;

		// Shake effect
		if (shake) {
			shakeTime += dt;
			group.rotation += Math.sin(shakeTime * 22) * 0.06 + Math.sin(shakeTime * 37) * 0.03;
		}

		// Spring flip
		var targetFlipVal:Float = targetFaceUp ? 0.0 : Math.PI;
		acc = STIFFNESS * (targetFlipVal - currentFlip) - DAMPING * velFlip;
		velFlip += acc * dt;
		currentFlip += velFlip * dt;

		// Spring scale
		acc = STIFFNESS * (targetScale - currentScale) - DAMPING * velScale;
		velScale += acc * dt;
		currentScale += velScale * dt;

		applyVisuals();
	}

	function applyVisuals() {
		// Simulate Y-flip via scaleX: when flip > PI/2, show back
		var flipCos = Math.cos(currentFlip);
		var showFront = flipCos >= 0;
		frontBmp.visible = showFront;
		backBmp.visible = !showFront;

		// Use absolute cos for scaleX to simulate 3D flip
		var flipScale = Math.abs(flipCos);
		if (flipScale < 0.01)
			flipScale = 0.01;

		group.scaleX = currentScale * flipScale;
		group.scaleY = currentScale;
	}

	public function dispose() {
		group.remove();
	}
}
