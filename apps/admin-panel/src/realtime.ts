import { io } from "socket.io-client";

export const createRealtimeClient = (url = "http://localhost:4000") =>
  io(url, {
    autoConnect: false,
    transports: ["websocket"]
  });
