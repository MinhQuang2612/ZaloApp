import { io, Socket } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "../services/auth";

// Cập nhật URL để dùng HTTPS nếu EC2 đã có SSL, hoặc dùng HTTP để kiểm tra
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://3.95.192.17:3000"; // Thay đổi nếu đã có HTTPS
console.log("Socket API URL:", API_URL);

const socket: Socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity, // Thử kết nối lại vô số lần
  reconnectionDelay: 1000, // Delay giữa các lần thử (1 giây)
  timeout: 30000,
  autoConnect: false,
  transports: ["websocket"],
  auth: {},
});

let isConnecting = false;

export const connectSocket = async (): Promise<void> => {
  if (isConnecting || socket.connected) {
    console.log("Socket already connected or connecting:", socket.id);
    return;
  }

  isConnecting = true;
  try {
    let token = await getAccessToken();
    if (!token) {
      console.log("No access token found, attempting to refresh...");
      const refreshedTokens = await refreshAccessToken();
      if (!refreshedTokens) {
        console.log("Cannot refresh token, cannot connect to socket");
        return;
      }
      token = refreshedTokens.accessToken;
    }

    socket.auth = { token };
    console.log("Socket auth updated with token:", socket.auth);

    console.log("Connecting to socket...");
    socket.connect();
  } catch (error) {
    console.error("Failed to connect socket:", error);
  } finally {
    isConnecting = false;
  }
};

export const joinGroupRoom = (groupID: string) => {
  socket.emit("joinGroupRoom", groupID);
  console.log("Joined group room:", groupID);
};

export const disconnectSocket = () => {
  if (socket.connected) {
    console.log("Disconnecting socket...");
    socket.disconnect();
  }
};

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("connect_error", async (error) => {
  console.log("Socket connection error:", error.message);
  if (error.message === "Invalid token" && !isConnecting) {
    try {
      console.log("Attempting to refresh token...");
      const refreshedTokens = await refreshAccessToken();
      if (!refreshedTokens) {
        console.log("Cannot refresh token, cannot reconnect");
        return;
      }
      socket.auth = { token: refreshedTokens.accessToken };
      connectSocket();
    } catch (refreshError) {
      console.error("Failed to refresh token:", refreshError);
    }
  }
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
  if (reason === "io server disconnect" || reason === "transport error") {
    console.log("Attempting to reconnect due to:", reason);
    if (!isConnecting) {
      connectSocket();
    }
  }
});

export const deleteMessage = (messageID: string, userID: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    socket.emit("deleteMessage", { messageID, userID }, (response: string) => {
      console.log("Delete message response:", response);
      if (response === "Xóa tin nhắn thành công") {
        resolve(true);
      } else {
        reject(new Error(response));
      }
    });
  });
};

export const recallMessage = (messageID: string, userID: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    socket.emit("recallMessage", { messageID, userID }, (response: string) => {
      console.log("Recall message response:", response);
      if (response === "Thu hồi tin nhắn thành công") {
        resolve(true);
      } else {
        reject(new Error(response));
      }
    });
  });
};

export const registerSocketListeners = (listeners: { event: string; handler: (...args: any[]) => void }[]) => {
  listeners.forEach(({ event, handler }) => {
    socket.off(event);
    socket.on(event, handler);
  });
};

export const removeSocketListeners = (events: string[]) => {
  events.forEach((event) => socket.off(event));
};

export default socket;