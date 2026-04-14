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

public partial class UnoCardSchema : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public UnoCardSchema() { }
	[Type(0, "string")]
	public string id = default(string);

	[Type(1, "string")]
	public string cardType = default(string);

	[Type(2, "string")]
	public string color = default(string);

	[Type(3, "string")]
	public string value = default(string);

	[Type(4, "string")]
	public string chosenColor = default(string);
}
