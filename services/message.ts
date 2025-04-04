import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  senderID: string;
  receiverID?: string;
  messageTypeID: string;
  context: string;
  createdAt: string;
  groupID?: string;
  messageID?: string;
  seenStatus?: string[];
  file?: {
    name: string;
    data: string; // Base64 string
  };
}

export const fetchMessages = async (receiverID: string): Promise<Message[]> => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy thông tin người dùng.");

    const user = JSON.parse(userData);
    const userID1 = user.userID;
    if (!userID1 || !receiverID) throw new Error("Thiếu userID hoặc receiverID.");

    const response = await api.get(`/api/message/${userID1}/${receiverID}`);
    return response.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy tin nhắn:", error.message);
    return [];
  }
};

export const fetchGroupMessages = async (groupID: string): Promise<Message[]> => {
  try {
    if (!groupID) throw new Error("Thiếu groupID.");

    const response = await api.get(`/api/message/group/${groupID}`);
    return response.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy tin nhắn nhóm:", error.message);
    return [];
  }
};

export const sendMessage = async (message: {
  senderID: string;
  receiverID?: string;
  context: string;
  messageTypeID: string;
  groupID?: string;
  messageID?: string;
  file?: { name: string; data: string };
}) => {
  try {
    const response = await api.post("/api/message", {
      ...message,
      createdAt: new Date().toISOString(),
    });
    return response.data;
  } catch (error: any) {
    console.error("Lỗi khi gửi tin nhắn qua API:", error.message);
    throw error;
  }
};