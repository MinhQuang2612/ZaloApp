import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Contact {
  id?: string;
  userID: string;
  username: string;
  avatar?: string;
  phoneNumber?: string;
}

// Hàm lấy danh sách tất cả liên hệ của người dùng
export const fetchContacts = async (userID: string): Promise<Contact[]> => {
  try {
    const response = await api.get(`/api/user/${userID}/contacts`);
    const contacts = response.data;

    // Lấy thông tin chi tiết của từng liên hệ
    const detailedContacts = await Promise.all(
      contacts.map(async (contact: any) => {
        try {
          const contactDetails = await api.get(`/api/user/${contact.userID}`);
          return {
            userID: contact.userID,
            username: contactDetails.data.username || "Không xác định",
            avatar: contactDetails.data.avatar || "https://via.placeholder.com/50",
            phoneNumber: contactDetails.data.phoneNumber || "Không có số điện thoại",
          };
        } catch (error) {
          console.error(`Lỗi khi lấy thông tin user ${contact.userID}:`, error);
          return {
            userID: contact.userID,
            username: "Không xác định",
            avatar: "https://via.placeholder.com/50",
            phoneNumber: "Không có số điện thoại",
          };
        }
      })
    );

    return detailedContacts;
  } catch (error) {
    console.error("Lỗi khi lấy danh bạ:", error);
    throw new Error("Không thể tải danh bạ.");
  }
};

// Hàm lấy thông tin user theo ID
export const fetchUserByID = async (userID: string): Promise<Contact | null> => {
  try {
    const response = await api.get(`/api/user/${userID}`);
    return {
      userID: response.data.userID,
      username: response.data.username || "Không xác định",
      avatar: response.data.avatar || "https://via.placeholder.com/50",
      phoneNumber: response.data.phoneNumber || "Không có số điện thoại",
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin user:", error);
    return null;
  }
};

// Hàm lấy danh sách tất cả người dùng (dùng trong màn hình add_contact)
export const fetchAllUsers = async (): Promise<Contact[]> => {
  try {
    const response = await api.get("/api/user");
    return response.data.map((user: any) => ({
      userID: user.userID,
      username: user.username || "Không xác định",
      avatar: user.avatar || "https://via.placeholder.com/50",
      phoneNumber: user.phoneNumber || "Không có số điện thoại",
    }));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error);
    throw new Error("Không thể tải danh sách người dùng.");
  }
};

// Hàm thêm liên hệ
export const addContact = async (userID: string, contactID: string): Promise<string> => {
  try {
    const response = await api.put(`/api/user/${userID}/contacts/add`, { contactID });
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Không thể thêm liên hệ.");
  }
};

// Hàm xóa liên hệ
export const deleteContact = async (userID: string, contactID: string): Promise<string> => {
  try {
    const response = await api.put(`/api/user/${userID}/contacts/delete`, { contactID });
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Không thể xóa liên hệ.");
  }
};