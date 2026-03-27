package schema;

import io.colyseus.serializer.schema.Schema;
import io.colyseus.serializer.schema.types.ArraySchema;
import io.colyseus.serializer.schema.types.MapSchema;

class UnoRoomState extends Schema {
	@:type("map", PlayerSchema)
	public var players:MapSchema<PlayerSchema> = new MapSchema<PlayerSchema>();

	@:type("array", UnoCardSchema)
	public var discardPile:ArraySchema<UnoCardSchema> = new ArraySchema<UnoCardSchema>();

	@:type("number")
	public var drawPileCount:Float = 0;

	@:type("number")
	public var currentPlayer:Float = 0;

	@:type("number")
	public var direction:Float = 1;

	@:type("string")
	public var activeColor:String = "red";

	@:type("number")
	public var pendingDraw:Float = 0;

	@:type("number")
	public var winner:Float = -1;

	@:type("string")
	public var phase:String = "waiting";

	@:type("number")
	public var turnDeadline:Float = 0;
}
