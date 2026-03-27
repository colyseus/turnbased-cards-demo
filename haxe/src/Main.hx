class Main extends hxd.App {
	var game:Game;

	override function init() {
		hxd.Res.initEmbed();
		game = new Game(s2d);
	}

	override function update(dt:Float) {
		if (game != null)
			game.update(dt);
	}

	static function main() {
		new Main();
	}
}
