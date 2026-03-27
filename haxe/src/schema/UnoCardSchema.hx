package schema;

import io.colyseus.serializer.schema.Schema;

class UnoCardSchema extends Schema {
	@:type("string")
	public var id:String = "";

	@:type("string")
	public var cardType:String = "";

	@:type("string")
	public var color:String = "";

	@:type("string")
	public var value:String = "";

	@:type("string")
	public var chosenColor:String = "";
}
