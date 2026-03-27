import io.colyseus.Client;
import io.colyseus.Room;
import schema.UnoRoomState;

class Network {
	var client:Client;

	public var room:Room<UnoRoomState>;

	public function new(serverUrl:String) {
		client = new Client(serverUrl);
	}

	public function joinOrCreate(name:String, onJoin:(Room<UnoRoomState>) -> Void, onError:(Dynamic) -> Void) {
		client.joinOrCreate("uno", ["name" => name], UnoRoomState, function(err, room) {
			if (err != null) {
				onError(err);
				return;
			}
			this.room = room;
			onJoin(room);
		});
	}

	public function joinById(roomId:String, name:String, onJoin:(Room<UnoRoomState>) -> Void, onError:(Dynamic) -> Void) {
		client.joinById(roomId, ["name" => name], UnoRoomState, function(err, room) {
			if (err != null) {
				onError(err);
				return;
			}
			this.room = room;
			onJoin(room);
		});
	}

	public function sendPlayCard(cardId:String, ?chosenColor:String) {
		if (room == null)
			return;
		if (chosenColor != null)
			room.send("play_card", {cardId: cardId, chosenColor: chosenColor});
		else
			room.send("play_card", {cardId: cardId});
	}

	public function sendDrawCard() {
		if (room != null)
			room.send("draw_card", {});
	}

	public function sendRestart() {
		if (room != null)
			room.send("restart", {});
	}
}
