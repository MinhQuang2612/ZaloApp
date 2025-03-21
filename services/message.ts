import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  senderID: string;
  receiverID: string;
  messageTypeID: string;
  context: string;
  createdAt: string;
  groupID?: string;
  messageID?: string;
  seenStatus?: string[];
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

export const sendMessage = async (message: {
  senderID: string;
  receiverID: string;
  context: string;
  messageTypeID: string;
  groupID?: string;
  messageID?: string;
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

export const sendFileMessage = async (formData: FormData) => {
  try {
    console.log("Sending FormData to API:", formData);
    const response = await api.post("/api/message/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    console.log("API response:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Lỗi khi gửi file qua API:", error.message, error.response?.data);
    throw error;
  }
};