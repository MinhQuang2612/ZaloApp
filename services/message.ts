import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  senderID: string;
  receiverID: string;
  messageTypeID: string;
  context: string;
  createdAt: string;
  groupID?: string;
}

export const fetchMessages = async (receiverID: string): Promise<Message[]> => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy thông tin người dùng.");

    const user = JSON.parse(userData);
    const userID1 = user.userID; // userID hiện tại (75e9f681)
    if (!userID1 || !receiverID) throw new Error("Thiếu userID hoặc receiverID.");

    const response = await api.get(`/api/message/${userID1}/${receiverID}`);
    return response.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy tin nhắn:", error.message);
    return [];
  }
};

export const sendMessage = async (message: { receiverID: string; context: string; messageTypeID: string; groupID?: string }) => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy thông tin người dùng.");

    const user = JSON.parse(userData);
    const senderID = user.userID; // Lấy userID hiện tại (75e9f681)

    const fullMessage = {
      senderID,
      receiverID: message.receiverID,
      context: message.context,
      messageTypeID: message.messageTypeID,
      groupID: message.groupID,
      createdAt: new Date().toISOString(),
    };

    const response = await api.post("/api/message", fullMessage);
    return response.data;
  } catch (error: any) {
    console.error("Lỗi khi gửi tin nhắn:", error.message);
  }
};