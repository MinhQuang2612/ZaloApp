// services/forgotPassword.ts
import api from "./api";

export const getGmailByPhone = async (phoneNumber: string): Promise<string> => {
  try {
    console.log("Sending request to get Gmail:", { phoneNumber });
    const response = await api.get(`/api/user/${phoneNumber}/gmail`); 
    console.log("Response from /api/user/gmail:", response.data);
    return response.data.gmail;
  } catch (error: any) {
    console.error("Error in getGmailByPhone:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Không tìm thấy Gmail");
  }
};

export const sendOTP = async (gmail: string): Promise<string> => {
  try {
    const response = await api.post("/api/OTP/send", { gmail });
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Lỗi khi gửi OTP");
  }
};

export const verifyOTP = async (gmail: string, OTP: string): Promise<string> => {
  try {
    const response = await api.post("/api/OTP/verify", { gmail, OTP });
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "OTP không đúng");
  }
};

export const resetPassword = async (phoneNumber: string): Promise<string> => {
  try {
    const response = await api.post(`/api/user/resetPassword/${phoneNumber}`);
    return response.data.message;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Lỗi khi reset mật khẩu");
  }
};