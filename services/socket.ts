import { io, Socket } from "socket.io-client";
<<<<<<< HEAD
import { getAccessToken, refreshAccessToken } from "../services/auth"; 
=======
import { getAccessToken, refreshAccessToken } from "../services/auth";
>>>>>>> 20350c187f3d028ac37132d85d0ea87eb325b80a

const API_URL = process.env.EXPO_PUBLIC_API_URL;
console.log("(NOBRIDGE) LOG API URL:", API_URL);

const socket: Socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 30000,
  autoConnect: false,
  transports: ["websocket"],
  auth: {},
});

export const connectSocket = async () => {
  try {
    let token = await getAccessToken();
    if (!token) {
      console.log("(NOBRIDGE) ERROR No access token found, attempting to refresh...");
      const refreshedTokens = await refreshAccessToken();
      if (!refreshedTokens) {
        console.log("(NOBRIDGE) ERROR Cannot refresh token, cannot connect to socket");
        return;
      }
      token = refreshedTokens.accessToken;
    }

    socket.auth = { token };
    console.log("(NOBRIDGE) LOG Socket auth updated with token:", token);

    if (!socket.connected) {
      console.log("(NOBRIDGE) LOG Connecting to socket...");
      socket.connect();
    } else {
      console.log("(NOBRIDGE) LOG Socket already connected:", socket.id);
    }
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Failed to connect socket:", error);
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

socket.on("connect_error", async (error) => {
  console.log("(NOBRIDGE) ERROR Socket connection error:", error.message);

  if (error.message === "Invalid token") {
    try {
      console.log("(NOBRIDGE) LOG Attempting to refresh token...");
      const refreshedTokens = await refreshAccessToken();
      if (!refreshedTokens) {
        console.log("(NOBRIDGE) ERROR Cannot refresh token, cannot reconnect");
        return;
      }

      socket.auth = { token: refreshedTokens.accessToken };
      socket.connect();
    } catch (refreshError) {
      console.error("(NOBRIDGE) ERROR Failed to refresh token:", refreshError);
<<<<<<< HEAD
      // Có thể yêu cầu người dùng đăng nhập lại
      // Ví dụ: router.replace("/login");
=======
      // Optionally redirect to login screen
      // router.replace("/login");
>>>>>>> 20350c187f3d028ac37132d85d0ea87eb325b80a
    }
  }
});

socket.on("disconnect", (reason) => {
  console.log("(NOBRIDGE) LOG Socket disconnected:", reason);
  if (reason === "io server disconnect" || reason === "io client disconnect") {
    // Reconnect if the disconnection was initiated by the server or client
    connectSocket();
  }
});

export default socket;