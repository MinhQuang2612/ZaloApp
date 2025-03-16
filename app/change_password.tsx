import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { changePassword, validateNewPassword } from "../services/password"; 

export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // Kiểm tra khi người dùng nhập mật khẩu mới
  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    const error = validateNewPassword(text);
    setNewPasswordError(error);
  };

  // Kiểm tra khi người dùng nhập lại mật khẩu
  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text && text !== newPassword) {
      setConfirmPasswordError("Mật khẩu nhập lại không khớp.");
    } else {
      setConfirmPasswordError(null);
    }
  };

  // Kiểm tra điều kiện để bật nút "CẬP NHẬT"
  const isButtonEnabled = () => {
    return (
      currentPassword.length > 0 &&
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      !newPasswordError &&
      !confirmPasswordError
    );
  };

  // Hàm xử lý đổi mật khẩu
  const handleUpdatePassword = async () => {
    if (!isButtonEnabled()) {
      Alert.alert("Lỗi", "Vui lòng kiểm tra lại thông tin nhập.");
      return;
    }
  
    setLoading(true);
  
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      Alert.alert("Thành công", "Mật khẩu đã được cập nhật.");
      router.back();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Có lỗi xảy ra.");
    }
  
    setLoading(false);
  };
  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Cập nhật mật khẩu</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.instruction}>
          Mật khẩu phải gồm chữ và số, không được chứa năm sinh, username và tên Zalo của bạn.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Mật khẩu hiện tại:</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showPassword}
            placeholder="Nhập mật khẩu hiện tại"
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showText}>{showPassword ? "ẨN" : "HIỆN"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Mật khẩu mới:</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showPassword}
            placeholder="Nhập mật khẩu mới"
            value={newPassword}
            onChangeText={handleNewPasswordChange}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showText}>{showPassword ? "ẨN" : "HIỆN"}</Text>
          </TouchableOpacity>
        </View>
        {newPasswordError && <Text style={styles.errorText}>{newPasswordError}</Text>}

        <Text style={styles.label}>Nhập lại mật khẩu mới:</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            secureTextEntry={!showPassword}
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showText}>{showPassword ? "ẨN" : "HIỆN"}</Text>
          </TouchableOpacity>
        </View>
        {confirmPasswordError && <Text style={styles.errorText}>{confirmPasswordError}</Text>}
      </View>

      <TouchableOpacity
        style={[styles.updateButton, !isButtonEnabled() && styles.disabledButton]}
        onPress={handleUpdatePassword}
        disabled={!isButtonEnabled() || loading}
      >
        <Text style={styles.updateText}>{loading ? "ĐANG CẬP NHẬT..." : "CẬP NHẬT"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  infoBox: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 10,
    paddingHorizontal: 7,
    marginBottom: 15,
    marginHorizontal: -20,
  },
  instruction: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#007AFF",
    paddingBottom: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  showText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    fontSize: 12,
    marginTop: 5,
  },
  updateButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  disabledButton: {
    backgroundColor: "#B0BEC5",
  },
  updateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});