import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

interface User {
  userID: string;
  phoneNumber: string;
  username: string;
  DOB: string;
}

interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Hàm đăng nhập
export const loginUser = async (phoneNumber: string, password: string): Promise<User> => {
  try {
    // Gọi endpoint mới /api/auth/login
    const response = await api.post("/api/auth/login", { phoneNumber, password });

    console.log("Dữ liệu API trả về:", response.data);

    if (!response.data || typeof response.data !== "object" || !response.data.user) {
      throw new Error("API không trả về thông tin người dùng hợp lệ!");
    }

    const { user, accessToken, refreshToken } = response.data;

    // Lưu thông tin user vào AsyncStorage
    await AsyncStorage.setItem("user", JSON.stringify(user));
    console.log("Đã lưu user vào AsyncStorage:", user);

    // Lưu accessToken và refreshToken
    if (accessToken) {
      await AsyncStorage.setItem("accessToken", accessToken);
      console.log("Đã lưu accessToken vào AsyncStorage:", accessToken);
    }
    if (refreshToken) {
      await AsyncStorage.setItem("refreshToken", refreshToken);
      console.log("Đã lưu refreshToken vào AsyncStorage:", refreshToken);
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
    console.log("User lấy từ AsyncStorage:", parsedUser);
    return parsedUser;
  } catch (error) {
    console.error("Lỗi khi lấy user từ AsyncStorage:", error);
    return null;
  }
};

// Lấy accessToken từ AsyncStorage
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("accessToken");
    if (!token) {
      console.log("Không tìm thấy accessToken trong AsyncStorage");
      return null;
    }
    return token;
  } catch (error) {
    console.error("Lỗi khi lấy accessToken từ AsyncStorage:", error);
    return null;
  }
};

// Lấy refreshToken từ AsyncStorage
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("refreshToken");
    if (!token) {
      console.log("Không tìm thấy refreshToken trong AsyncStorage");
      return null;
    }
    return token;
  } catch (error) {
    console.error("Lỗi khi lấy refreshToken từ AsyncStorage:", error);
    return null;
  }
};

// Hàm đăng xuất
export const logoutUser = async () => {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // Gọi API logout để xóa refreshToken trên server
      await api.post("/api/auth/logout", { refreshToken });
      console.log("Đã gọi API logout để xóa refreshToken trên server");
    }
  } catch (error) {
    console.error("Lỗi khi gọi API logout:", error);
  } finally {
    // Xóa dữ liệu cục bộ
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("accessToken");
    await AsyncStorage.removeItem("refreshToken");
    console.log("Đã xóa thông tin đăng nhập cục bộ");
  }
};