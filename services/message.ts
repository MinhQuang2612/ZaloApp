import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  senderID: string;
  receiverID?: string | null; 
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
      response = await api.get(`/api/message/single/${userID1}/${receiverID}`);
    }

    // Ánh xạ dữ liệu từ API (content -> context, đảm bảo đầy đủ các trường)
    const messages = (response.data || []).map((msg: any) => ({
      senderID: msg.senderID,
      receiverID: msg.receiverID || undefined, // Chỉ có trong SingleChat
      messageTypeID: msg.messageTypeID || "type1", // Mặc định là type1 nếu không có
      context: msg.content || msg.context || "", // Ánh xạ content thành context
      createdAt: msg.createdAt || new Date().toISOString(),
      groupID: msg.groupID || undefined, // Chỉ có trong GroupChat
      messageID: msg.messageID || undefined, // Có trong GroupChat
      seenStatus: msg.seenStatus || [],
      file: msg.file || undefined,
      deleteStatusByUser: msg.deleteStatusByUser || undefined,
      recallStatus: msg.recallStatus || undefined,
    }));

    return messages;
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