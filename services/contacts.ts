import api from "./api";

export interface Contact {
    id: string; // Nếu API trả về id
    userID: string; // Đảm bảo có userID
    username: string;
    avatar: string;
    phoneNumber: string;
  }

// Hàm lấy danh sách tất cả liên hệ (users)
export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const response = await api.get("/api/user"); // Gọi API từ backend
    return response.data;
  } catch (error) {
    console.error("Lỗi khi lấy danh bạ:", error);
    throw new Error("Không thể tải danh bạ.");
  }
};

export const fetchUserByID = async (userID: string) => {
    try {
      const response = await api.get(`/api/user/${userID}`);
      return response.data;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin user:", error);
      return null;
    }
  };
