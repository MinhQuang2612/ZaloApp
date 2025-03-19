import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hàm kiểm tra mật khẩu hiện tại
export const verifyCurrentPassword = async (phoneNumber: string, currentPassword: string) => {
  try {
    const response = await api.post("/api/user/login", {
      phoneNumber,
      password: currentPassword,
    });
    if (!response.data || !response.data.user) {
      throw new Error("Mật khẩu hiện tại không đúng.");
    }
    return response.data.user;
  } catch (error) {
    throw new Error("Mật khẩu hiện tại không đúng.");
  }
};

// Hàm kiểm tra tính hợp lệ của mật khẩu mới
export const validateNewPassword = (newPassword: string): string | null => {
  if (newPassword.length < 6) {
    return "Mật khẩu mới phải có ít nhất 6 ký tự.";
  }
  if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
    return "Mật khẩu phải chứa cả chữ cái và số.";
  }
  return null;
};

// Hàm đổi mật khẩu
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) => {
  // Kiểm tra mật khẩu xác nhận
  if (newPassword !== confirmPassword) {
    throw new Error("Mật khẩu mới và mật khẩu nhập lại không khớp.");
  }

  // Kiểm tra tính hợp lệ của mật khẩu mới
  const passwordError = validateNewPassword(newPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }

  // Lấy thông tin user từ AsyncStorage
  const userData = await AsyncStorage.getItem("user");
  if (!userData) {
    throw new Error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
  }

  const user = JSON.parse(userData);
  const phoneNumber = user.phoneNumber;

  // 1️⃣ Kiểm tra mật khẩu hiện tại
  await verifyCurrentPassword(phoneNumber, currentPassword);

  // 2️⃣ Nếu đúng, gọi API để đổi mật khẩu
  try {
    const response = await api.put(`/api/user/changePassword/${phoneNumber}`, {
      newPassword, // API yêu cầu trường newPassword
    });

    if (response.status !== 200 || !response.data || response.data.message !== "Đổi mật khẩu thành công") {
      throw new Error("Không thể cập nhật mật khẩu.");
    }

    // 3️⃣ Cập nhật thông tin user trong AsyncStorage
    user.password = newPassword;
    await AsyncStorage.setItem("user", JSON.stringify(user));

    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Có lỗi xảy ra khi cập nhật mật khẩu.");
  }
};