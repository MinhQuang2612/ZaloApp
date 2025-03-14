import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hàm đổi mật khẩu
export const changePassword = async (currentPassword: string, newPassword: string) => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy tài khoản");

    const user = JSON.parse(userData);

    await api.put(`/api/user/${user._id}/change-password`, {
      currentPassword,
      newPassword,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Lỗi cập nhật mật khẩu:", error);
    throw error.response?.data?.message || "Không thể cập nhật mật khẩu";
  }
};
