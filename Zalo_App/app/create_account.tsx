import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons"; 

export default function CreateAccount() {
  const router = useRouter();
  const { phone } = useLocalSearchParams(); // Nhận số điện thoại từ màn OTP
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Kiểm tra mật khẩu nhập lại
  const validatePassword = (value: string) => {
    setConfirmPassword(value);
    if (value === password) {
      setPasswordError(""); // Xóa lỗi ngay khi nhập đúng
    } else {
      setPasswordError("Mật khẩu nhập lại không khớp!");
    }
  };

  // Xử lý tạo tài khoản
  const handleRegister = () => {
    if (!username || !password || !confirmPassword) {
      alert("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    if (password !== confirmPassword) {
      alert("Mật khẩu nhập lại không khớp!");
      return;
    }

    alert("Tạo tài khoản thành công! (Chưa có logic lưu dữ liệu)");
    router.push("/login"); // Chuyển về màn hình đăng nhập
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.sub}>Tạo tài khoản</Text>
      </View>

      <Text style={styles.phoneText}>Số điện thoại: {phone ? `(+84) ${phone}` : "Chưa có số điện thoại"}</Text>

      {/* Nhập tên người dùng */}
      <View style={[styles.inputContainer, isUsernameFocused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
          placeholder="Tên người dùng (5-30 ký tự)"
          value={username}
          onChangeText={setUsername}
          onFocus={() => setIsUsernameFocused(true)}
          onBlur={() => setIsUsernameFocused(false)}
        />
      </View>

      {/* Nhập mật khẩu */}
      <View style={[styles.inputContainer, isPasswordFocused && styles.inputFocused]}>
        <TextInput
          style={styles.inputField}
          placeholder="Mật khẩu"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setIsPasswordFocused(true)}
          onBlur={() => setIsPasswordFocused(false)}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.togglePassword}>
          <Text style={{ color: "#999", fontWeight: "bold" }}>{showPassword ? "ẨN" : "HIỆN"}</Text>
        </TouchableOpacity>
      </View>

      {/* Nhập lại mật khẩu */}
      <View style={[styles.inputContainer, isConfirmPasswordFocused && styles.inputFocused]}>
        <TextInput
          style={styles.inputField}
          placeholder="Nhập lại mật khẩu"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={validatePassword}
          onFocus={() => setIsConfirmPasswordFocused(true)}
          onBlur={() => setIsConfirmPasswordFocused(false)}
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.togglePassword}>
          <Text style={{ color: "#999", fontWeight: "bold" }}>{showConfirmPassword ? "ẨN" : "HIỆN"}</Text>
        </TouchableOpacity>
      </View>

      {/* Hiển thị lỗi nếu mật khẩu nhập lại không đúng */}
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

      {/* Nút tạo tài khoản */}
      <TouchableOpacity
        style={[styles.button, passwordError || !username || !password || !confirmPassword ? styles.buttonDisabled : {}]}
        onPress={handleRegister}
        disabled={!!passwordError || !username || !password || !confirmPassword}
      >
        <Text style={styles.buttonText}>Tạo tài khoản</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 25,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginHorizontal: -20,
  },
  backButton: {
    marginRight: 10,
  },
  sub: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 3,
  },
  phoneText: {
    fontSize: 16,
    textAlign: "center",
    color: "#000",
    marginVertical: 35,
    fontWeight: "bold",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 5,
    marginBottom: 15,
  },
  inputFocused: {
    borderBottomColor: "#007AFF", // Viền xanh khi focus
    borderBottomWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  togglePassword: {
    marginLeft: 10,
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "left",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 30,
    width: "75%",
    alignSelf: "center",
  },
  buttonDisabled: {
    backgroundColor: "#A0C8F0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
