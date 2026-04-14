//
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
//
// GENERATED USING @colyseus/schema 4.0.18
//

using Colyseus.Schema;
#if UNITY_5_3_OR_NEWER
using UnityEngine.Scripting;
#endif

public partial class PlayerSchema : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public PlayerSchema() { }
	[Type(0, "string")]
	public string sessionId = default(string);

	[Type(1, "uint8")]
	public byte seatIndex = default(byte);

	[Type(2, "string")]
	public string name = default(string);

	[Type(3, "boolean")]
	public bool isBot = default(bool);

	[Type(4, "boolean")]
	public bool connected = default(bool);

	[Type(5, "array", typeof(ArraySchema<UnoCardSchema>))]
	public ArraySchema<UnoCardSchema> hand = null;

	[Type(6, "uint8")]
	public byte handCount = default(byte);
}
