import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hàm cập nhật thông tin cá nhân
export const updateProfile = async (userID: string, username: string, DOB: string) => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy tài khoản");

    const user = JSON.parse(userData);
    const correctUserID = user.userID || user._id; // Đảm bảo lấy đúng userID

    console.log("User ID được sử dụng:", correctUserID);

    const response = await api.put(`/api/user/${correctUserID}`, { username, DOB });

    if (!response.data || !response.data.user) {
      throw new Error("API không trả về thông tin user sau khi cập nhật. Vui lòng kiểm tra server.");
    }

    const updatedUser = {
      ...user,
      username: response.data.user.username,
      DOB: response.data.user.DOB,
    };
    await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

    return updatedUser;
  } catch (error: any) {
    console.error("Lỗi cập nhật thông tin:", error);
    throw new Error(error.response?.data?.message || "Không thể cập nhật thông tin");
  }
};
