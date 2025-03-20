import { Alert } from 'react-native';
import api from './api'; // Import the shared axios instance

interface RegisterRequest {
  phoneNumber: string;
  password: string;
  username: string;
  DOB: string;
}

interface RegisterResponse {
  phoneNumber: string;
  password: string;
  username: string;
  DOB: string;
  [key: string]: any; // For additional data from the backend
}

export const registerUser = async (data: RegisterRequest): Promise<RegisterResponse | null> => {
    console.log('Function registerUser called'); // Kiểm tra hàm có chạy không
    try {
      console.log('Request data:', data);
      console.log('Base URL:', api.defaults.baseURL); // Log riêng baseURL
      console.log('Full URL:', `${api.defaults.baseURL}/api/user`);
      const response = await api.post('/api/user', data);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      const result: RegisterResponse = response.data;
      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Có lỗi xảy ra khi đăng ký";
      console.error('Network error:', errorMessage);
      console.error('Error details:', error); // Log toàn bộ error object
      Alert.alert("Lỗi", errorMessage);
      return null;
    }
  };