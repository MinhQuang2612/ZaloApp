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
  deleteStatusByUser?: string[];
  recallStatus?: boolean;
}

export interface Contact {
  userID: string;
  username: string;
  avatar?: string;
}

export interface Group {
  groupID: string;
  groupName: string;
  avatar?: string;
  members?: string[];
}

export const fetchMessages = async (receiverID: string, isGroup: boolean = false): Promise<Message[]> => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy thông tin người dùng.");

    const user = JSON.parse(userData);
    const userID1 = user.userID;
    if (!userID1) throw new Error("Thiếu userID.");

    let response;
    if (isGroup) {
      if (!receiverID) throw new Error("Thiếu groupID.");
      response = await api.get(`/api/message/group/${receiverID}`);
    } else {
      if (!receiverID) throw new Error("Thiếu receiverID.");
      response = await api.get(`/api/message/${userID1}/${receiverID}`);
    }
    return response.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy tin nhắn:", error.message);
    return [];
  }
};

export const fetchContacts = async (userID: string): Promise<Contact[]> => {
  try {
    if (!userID) throw new Error("Thiếu userID.");
    const response = await api.get(`/api/contacts/${userID}`);
    return response.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy danh bạ:", error.message);
    return [];
  }
};

export const fetchUserGroups = async (userID: string): Promise<Group[]> => {
  try {
    if (!userID) throw new Error("Thiếu userID.");
    const response = await api.get(`/api/groups/${userID}`);
    return response.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách nhóm:", error.message);
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