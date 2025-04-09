import { io, Socket } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "../services/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
console.log("Socket API URL:", API_URL);

const socket: Socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 30000,
  autoConnect: false,
  transports: ["websocket"],
  auth: {},
});

// Hàm kết nối socket với retry logic
export const connectSocket = async (): Promise<void> => {
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

    if (!socket.connected) {
      console.log("Connecting to socket...");
      socket.connect();
    } else {
      console.log("Socket already connected:", socket.id);
    }
  } catch (error) {
    console.error("Failed to connect socket:", error);
  }
};

// Ngắt kết nối socket
export const disconnectSocket = () => {
  if (socket.connected) {
    console.log("Disconnecting socket...");
    socket.disconnect();
  }
};

// Xử lý sự kiện kết nối
socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

// Xử lý lỗi kết nối
socket.on("connect_error", async (error) => {
  console.log("Socket connection error:", error.message);
  if (error.message === "Invalid token") {
    try {
      console.log("Attempting to refresh token...");
      const refreshedTokens = await refreshAccessToken();
      if (!refreshedTokens) {
        console.log("Cannot refresh token, cannot reconnect");
        return;
      }
      socket.auth = { token: refreshedTokens.accessToken };
      socket.connect();
    } catch (refreshError) {
      console.error("Failed to refresh token:", refreshError);
    }
  }
});

// Xử lý ngắt kết nối và tự động reconnect
socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
  if (reason === "io server disconnect" || reason === "io client disconnect") {
    connectSocket();
  }
});

// Hàm xóa tin nhắn
export const deleteMessage = (messageID: string, userID: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    socket.emit("deleteMessage", messageID, userID, (response: string) => {
      console.log("Delete message response:", response);
      if (response === "Đã xóa tin nhắn thành công") {
        resolve(true);
      } else {
        reject(new Error(response));
      }
    });
  });
};

// Hàm thu hồi tin nhắn
export const recallMessage = (messageID: string, userID: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    socket.emit("recallMessage", messageID, userID, (response: string) => {
      console.log("Recall message response:", response);
      if (response === "Thu hồi tin nhắn thành công") {
        resolve(true);
      } else {
        reject(new Error(response));
      }
    });
  });
};

// Hàm để đăng ký lại listener từ các component
export const registerSocketListeners = (listeners: { event: string; handler: (...args: any[]) => void }[]) => {
  listeners.forEach(({ event, handler }) => {
    socket.off(event); // Xóa listener cũ để tránh trùng lặp
    socket.on(event, handler);
  });
};

// Hàm để xóa listener khi component unmount
export const removeSocketListeners = (events: string[]) => {
  events.forEach((event) => socket.off(event));
};

export default socket;