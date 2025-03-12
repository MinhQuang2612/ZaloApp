import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

interface User {
  _id: string;
  userID: string;
  phoneNumber: string;
  username: string;
  accountRole: string;
  DOB: string;
  __v: number;
}

interface LoginResponse {
  message: string;
  user: User;
}

// Hàm đăng nhập
export const loginUser = async (phoneNumber: string, password: string): Promise<User> => {
  try {
    const response = await api.post("/api/user/login", { phoneNumber, password });

    console.log("Dữ liệu API trả về:", response.data);

    if (!response.data || typeof response.data !== "object" || !response.data.user) {
      throw new Error("API không trả về thông tin người dùng hợp lệ!");
    }

    const user = response.data.user as User;

    // Lưu thông tin user vào AsyncStorage
    await AsyncStorage.setItem("user", JSON.stringify(user));
    console.log("Đã lưu user vào AsyncStorage:", user); // Thêm log để kiểm tra

    // Nếu API trả về token, lưu token
    if (response.data.token) {
      await AsyncStorage.setItem("userToken", response.data.token);
      console.log("Đã lưu token vào AsyncStorage:", response.data.token);
    }

    return user;
  } catch (error: any) {
    console.error("Lỗi khi đăng nhập:", error);
    throw error.response?.data?.message || "Đăng nhập thất bại.";
  }
};

// Lấy user từ AsyncStorage
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem("user"); 
    if (!userData) {
      console.log("Không tìm thấy user trong AsyncStorage");
      return null;
    }
    const parsedUser = JSON.parse(userData) as User;
    console.log("User lấy từ AsyncStorage:", parsedUser); // Log để kiểm tra
    return parsedUser;
  } catch (error) {
    console.error("Lỗi khi lấy user từ AsyncStorage:", error);
    return null;
  }
};

// Hàm đăng xuất
export const logoutUser = async () => {
  await AsyncStorage.removeItem("user");
  await AsyncStorage.removeItem("userToken"); // Xóa token nếu có
};