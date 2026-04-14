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

public partial class UnoRoomState : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public UnoRoomState() { }
	[Type(0, "map", typeof(MapSchema<PlayerSchema>))]
	public MapSchema<PlayerSchema> players = null;

	[Type(1, "array", typeof(ArraySchema<UnoCardSchema>))]
	public ArraySchema<UnoCardSchema> discardPile = null;

	[Type(2, "uint8")]
	public byte drawPileCount = default(byte);

	[Type(3, "int8")]
	public sbyte currentPlayer = default(sbyte);

	[Type(4, "int8")]
	public sbyte direction = default(sbyte);

	[Type(5, "string")]
	public string activeColor = default(string);

	[Type(6, "uint8")]
	public byte pendingDraw = default(byte);

	[Type(7, "int8")]
	public sbyte winner = default(sbyte);

	[Type(8, "string")]
	public string phase = default(string);

	[Type(9, "float64")]
	public double turnDeadline = default(double);
}
