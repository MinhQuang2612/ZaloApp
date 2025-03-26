import { io, Socket } from "socket.io-client";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
console.log("(NOBRIDGE) LOG API URL:", API_URL);

const socket: Socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 30000,
  autoConnect: false, // Đặt thành false để kiểm soát kết nối thủ công
  transports: ["websocket"],
});

export const connectSocket = () => {
  if (!socket.connected) {
    console.log("(NOBRIDGE) LOG Connecting to socket...");
    socket.connect();
  } else {
    console.log("(NOBRIDGE) LOG Socket already connected:", socket.id);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    console.log("(NOBRIDGE) LOG Disconnecting socket...");
    socket.disconnect();
  }
};

socket.on("connect", () => {
  console.log("(NOBRIDGE) LOG Socket connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.log("(NOBRIDGE) ERROR Socket connection error:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("(NOBRIDGE) LOG Socket disconnected:", reason);
});

export default socket;