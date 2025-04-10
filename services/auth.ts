import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { jwtDecode } from "jwt-decode";

interface User {
  userID: string;
  phoneNumber: string;
  username: string;
  DOB: string;
  gmail: string; // Thêm trường email
}

interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// Hàm đăng nhập
export const loginUser = async (phoneNumber: string, password: string): Promise<User> => {
  try {
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
    const errorMessage = error.response?.data?.message || "Đăng nhập thất bại.";
    throw new Error(errorMessage);
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

// Lấy accessToken từ AsyncStorage và kiểm tra thời gian hết hạn
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("accessToken");
    if (!token) {
      console.log("Không tìm thấy accessToken trong AsyncStorage");
      return null;
    }

    // Giải mã token để kiểm tra thời gian hết hạn
    const decoded: any = jwtDecode(token);
    const currentTime = Date.now() / 1000; // Thời gian hiện tại (giây)
    if (decoded.exp < currentTime) {
      console.log("Access token đã hết hạn, cần làm mới");
      return null; // Token hết hạn, trả về null để kích hoạt làm mới
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

// Hàm làm mới token
export const refreshAccessToken = async (): Promise<RefreshTokenResponse | null> => {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      console.log("Không tìm thấy refreshToken để làm mới");
      return null;
    }

    const response = await api.post("/api/auth/refreshToken", { refreshToken });
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

    // Lưu token mới vào AsyncStorage
    await AsyncStorage.setItem("accessToken", newAccessToken);
    await AsyncStorage.setItem("refreshToken", newRefreshToken);
    console.log("Đã làm mới token:", { newAccessToken, newRefreshToken });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error: any) {
    console.error("Lỗi khi làm mới token:", error);
    const errorMessage = error.response?.data?.message || "Không thể làm mới token.";
    throw new Error(errorMessage);
  }
};

// Hàm đăng xuất
export const logoutUser = async (): Promise<void> => {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await api.post("/api/auth/logout", { refreshToken });
      console.log("Đã gọi API logout để xóa refreshToken trên server");
    }
  } catch (error: any) {
    console.error("Lỗi khi gọi API logout:", error);
    throw new Error(error.response?.data?.message || "Không thể đăng xuất trên server.");
  } finally {
    // Xóa dữ liệu cục bộ
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("accessToken");
    await AsyncStorage.removeItem("refreshToken");
    console.log("Đã xóa thông tin đăng nhập cục bộ");
  }
};