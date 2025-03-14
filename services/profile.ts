import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hàm cập nhật thông tin cá nhân
export const updateProfile = async (username: string, DOB: string) => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy tài khoản");

    const user = JSON.parse(userData);

    const response = await api.put(`/api/user/${user._id}`, {
      username,
      DOB,
    });

    // Cập nhật lại user trong AsyncStorage
    await AsyncStorage.setItem("user", JSON.stringify(response.data.user));

    return response.data.user;
  } catch (error: any) {
    console.error("Lỗi cập nhật thông tin:", error);
    throw error.response?.data?.message || "Không thể cập nhật thông tin";
  }
};
