import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Kiểm tra mật khẩu hiện tại
export const verifyCurrentPassword = async (phoneNumber: string, currentPassword: string) => {
  try {
    const response = await api.post("/api/auth/login", {
      phoneNumber,
      password: currentPassword,
    });
    if (response.status !== 200 || !response.data.message.includes("đăng nhập thành công")) {
      throw new Error("Mật khẩu hiện tại không đúng."); 
    }
    return true;
  } catch (error: any) {
    throw new Error("Mật khẩu hiện tại không đúng."); 
  }
};

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

  // Kiểm tra mật khẩu hiện tại
  await verifyCurrentPassword(phoneNumber, currentPassword);

  // Gọi API đổi mật khẩu
  try {
    const response = await api.put(`/api/user/changePassword/${phoneNumber}`, {
      newPassword,
    });
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Có lỗi xảy ra khi cập nhật mật khẩu.");
  }
};