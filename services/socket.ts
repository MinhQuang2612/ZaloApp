import { io, Socket } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "../services/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://3.95.192.17:3000";
console.log("Socket API URL:", API_URL);

const socket: Socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
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

export const joinGroupRoom = (groupID: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Socket không kết nối. Vui lòng thử lại."));
      return;
    }

    socket.emit("joinGroupRoom", groupID, (response: string) => {
      console.log("Join group room response:", response);
      if (response === "Đã tham gia phòng nhóm") {
        resolve(response);
      } else {
        reject(new Error(response));
      }
    });

    setTimeout(() => {
      reject(new Error("joinGroupRoom timeout"));
    }, 5000); // Timeout sau 5 giây
  });
};

export const joinGroup = (userID: string, groupID: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    socket.emit("joinGroup", userID, groupID, (response: string) => {
      console.log("Join group response:", response);
      if (response === "Tham gia nhóm thành công") {
        resolve(response);
      } else {
        reject(new Error(response));
      }
    });
  });
};

export const addGroupMember = (userID: string, groupID: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    socket.emit("addGroupMember", userID, groupID, (response: string) => {
      console.log("Add group member response:", response);
      if (response === "Thêm thành viên thành công") {
        resolve(response);
      } else {
        reject(new Error(response));
      }
    });
  });
};

export const deleteGroup = (userID: string, groupID: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
      if (!socket.connected) {
          console.log("Socket chưa kết nối, đang thử kết nối lại...");
          try {
              await connectSocket();
          } catch (error) {
              reject(new Error("Không thể kết nối socket"));
              return;
          }
      }
      socket.emit("deleteGroup", userID, groupID, (response: string) => {
          console.log("Delete group response:", response);
          if (response === "Xóa nhóm thành công") {
              resolve(response);
          } else {
              reject(new Error(response));
          }
      });
  });
};

// Hàm kick thành viên
export const kickMember = (userID: string, groupID: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    socket.emit("kickMember", { userID, groupID }, (response: string) => {
      if (response.includes("Thành công")) {
        resolve(response);
      } else {
        reject(new Error(response));
      }
    });
  });
};

// Hàm rời nhóm
export const leaveGroup = (userID: string, groupID: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    socket.emit("leaveGroup", { userID, groupID }, (response: string) => {
      if (response.includes("Thành công")) {
        resolve(response);
      } else {
        reject(new Error(response));
      }
    });
  });
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