package schema;

import io.colyseus.serializer.schema.Schema;
import io.colyseus.serializer.schema.types.ArraySchema;

class PlayerSchema extends Schema {
	@:type("string")
	public var sessionId:String = "";

	@:type("number")
	public var seatIndex:Float = 0;

	@:type("string")
	public var name:String = "";

	@:type("boolean")
	public var isBot:Bool = false;

	@:type("boolean")
	public var connected:Bool = true;

	@:type("array", UnoCardSchema)
	public var hand:ArraySchema<UnoCardSchema> = new ArraySchema<UnoCardSchema>();

	@:type("number")
	public var handCount:Float = 0;
}
