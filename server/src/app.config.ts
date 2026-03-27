import { defineServer, defineRoom, playground, monitor } from "colyseus";
import { UnoRoom } from "./rooms/UnoRoom.ts";

export default defineServer({
  rooms: {
    uno: defineRoom(UnoRoom)
  },
  express: (app) => {
    app.use("/", playground());
    app.use("/monitor", monitor());
  },
})
