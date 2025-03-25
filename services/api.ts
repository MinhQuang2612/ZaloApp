import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Timeout 30 giây (30000ms)
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor để thêm header Authorization với accessToken
api.interceptors.request.use(
  async (config) => {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor để xử lý lỗi 401 (token hết hạn)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("Không tìm thấy refreshToken");
        }

        // Gọi API refresh token
        const response = await axios.post(`${API_BASE_URL}/api/auth/refreshToken`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        // Lưu token mới
        await AsyncStorage.setItem("accessToken", newAccessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem("refreshToken", newRefreshToken);
        }

        // Thêm token mới vào header và thử lại request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Lỗi khi refresh token:", refreshError);
        // Nếu refresh token thất bại, đăng xuất user
        await AsyncStorage.removeItem("user");
        await AsyncStorage.removeItem("accessToken");
        await AsyncStorage.removeItem("refreshToken");
        return Promise.reject(new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."));
      }
    }
    return Promise.reject(error);
  }
);

export default api;