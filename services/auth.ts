import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { jwtDecode } from "jwt-decode";

interface User {
  userID: string;
  phoneNumber: string;
  username: string;
  DOB: string;
  gmail: string;
  avatar?: string;
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
    if (!response.data || typeof response.data !== "object" || !response.data.user) {
      throw new Error("API không trả về thông tin người dùng hợp lệ!");
    }

    const { user, accessToken, refreshToken } = response.data;

    await AsyncStorage.setItem("user", JSON.stringify(user));
    if (accessToken) {
      await AsyncStorage.setItem("accessToken", accessToken);
    }
    if (refreshToken) {
      await AsyncStorage.setItem("refreshToken", refreshToken);
    }

    return user;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || "Đăng nhập thất bại.";
    // Tùy chỉnh thông báo khi mật khẩu sai
    if (errorMessage === "mật khẩu sai") {
      throw new Error("Mật khẩu không đúng. Vui lòng kiểm tra lại!");
    }
    throw new Error(errorMessage);
  }
};

// Lấy user từ AsyncStorage
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) {
      return null;
    }
    const parsedUser = JSON.parse(userData) as User;
    return parsedUser;
  } catch (error) {
    return null;
  }
};

// Lấy accessToken từ AsyncStorage và kiểm tra thời gian hết hạn
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("accessToken");
    if (!token) {
      return null;
    }

    const decoded: any = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    if (decoded.exp < currentTime) {
      return null;
    }

    return token;
  } catch (error) {
    return null;
  }
};

// Lấy refreshToken từ AsyncStorage
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("refreshToken");
    if (!token) {
      return null;
    }
    return token;
  } catch (error) {
    return null;
  }
};

// Hàm làm mới token
export const refreshAccessToken = async (): Promise<RefreshTokenResponse | null> => {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    const response = await api.post("/api/auth/refreshToken", { refreshToken });
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

    await AsyncStorage.setItem("accessToken", newAccessToken);
    await AsyncStorage.setItem("refreshToken", newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error: any) {
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
    }
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Không thể đăng xuất trên server.");
  } finally {
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("accessToken");
    await AsyncStorage.removeItem("refreshToken");
  }
};