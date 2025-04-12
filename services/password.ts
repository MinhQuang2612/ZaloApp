import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Kiểm tra tính hợp lệ của mật khẩu mới
export const validateNewPassword = (newPassword: string, currentPassword?: string): string | null => {
  if (!newPassword) return null;
  if (newPassword.length < 6) {
    return "Mật khẩu mới phải có ít nhất 6 ký tự.";
  }
  if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
    return "Mật khẩu phải chứa cả chữ cái và số.";
  }
  if (currentPassword && newPassword === currentPassword) {
    return "Mật khẩu mới không được trùng với mật khẩu hiện tại.";
  }
  return null;
};

// Đổi mật khẩu
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) => {
  if (newPassword !== confirmPassword) {
    throw new Error("Mật khẩu mới và mật khẩu nhập lại không khớp.");
  }

  const passwordError = validateNewPassword(newPassword, currentPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const userData = await AsyncStorage.getItem("user");
  if (!userData) {
    throw new Error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
  }

  const user = JSON.parse(userData);
  const phoneNumber = user.phoneNumber;

  // Gọi API đổi mật khẩu
  try {
    const response = await api.put(`/api/user/changePassword/${phoneNumber}`, {
      oldPassword: currentPassword, // Gửi mật khẩu cũ
      newPassword, // Gửi mật khẩu mới
    });
    return response.data.message;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || "Có lỗi xảy ra khi cập nhật mật khẩu.";
    // Tùy chỉnh thông báo khi mật khẩu sai
    if (errorMessage === "mật khẩu sai") {
      throw new Error("Mật khẩu hiện tại không đúng. Vui lòng kiểm tra lại!");
    }
    throw new Error(errorMessage);
  }
};