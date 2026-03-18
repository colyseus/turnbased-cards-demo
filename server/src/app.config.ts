import config from "@colyseus/tools";
import { UnoRoom } from "./rooms/UnoRoom.ts";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("uno", UnoRoom);
  },
});
