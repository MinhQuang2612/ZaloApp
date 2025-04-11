import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hàm cập nhật thông tin cá nhân (xóa tham số gmail)
export const updateProfile = async (userID: string, username: string, DOB: string) => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy tài khoản");

    const user = JSON.parse(userData);
    const correctUserID = user.userID || user._id;

    console.log("User ID được sử dụng:", correctUserID);

    const response = await api.put(`/api/user/${correctUserID}`, { username, DOB });

    if (!response.data || !response.data.user) {
      throw new Error("API không trả về thông tin user sau khi cập nhật. Vui lòng kiểm tra server.");
    }

    const updatedUser = {
      ...user,
      username: response.data.user.username,
      DOB: response.data.user.DOB,
      avatar: response.data.user.avatar || user.avatar,
    };
    await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

    return updatedUser;
  } catch (error: any) {
    console.error("Lỗi cập nhật thông tin:", error);
    throw new Error(error.response?.data?.message || "Không thể cập nhật thông tin");
  }
};

// Hàm cập nhật avatar (giữ nguyên)
export const updateAvatar = async (userID: string, avatarUri: string) => {
  try {
    const userData = await AsyncStorage.getItem("user");
    if (!userData) throw new Error("Không tìm thấy tài khoản");

    const user = JSON.parse(userData);
    const correctUserID = user.userID || user._id;

    const formData = new FormData();
    formData.append("avatar", {
      uri: avatarUri,
      name: `avatar-${correctUserID}.jpg`,
      type: "image/jpeg",
    } as any);

    const response = await api.put(`/api/user/${correctUserID}/avatar`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.data || !response.data.user) {
      throw new Error("API không trả về thông tin user sau khi cập nhật avatar.");
    }

    const updatedUser = {
      ...user,
      avatar: response.data.user.avatar,
    };
    await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

    return updatedUser;
  } catch (error: any) {
    console.error("Lỗi cập nhật avatar:", error);
    throw new Error(error.response?.data?.message || "Không thể cập nhật avatar");
  }
};