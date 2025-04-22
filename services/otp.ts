const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const sendOTP = async (email: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/api/OTP/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gmail: email }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Lỗi khi gửi OTP");
    }
  } catch (error: any) {
    throw new Error(error.message || "Không thể kết nối đến server");
  }
};

export const verifyOTP = async (email: string, otp: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/api/OTP/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gmail: email, OTP: otp }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "OTP không đúng");
    }
  } catch (error: any) {
    throw new Error(error.message || "Không thể kết nối đến server");
  }
};