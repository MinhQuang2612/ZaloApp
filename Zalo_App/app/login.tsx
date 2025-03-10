import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // Import icon
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("0838849375");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Đăng nhập</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.instruction}>Vui lòng nhập số điện thoại và mật khẩu để đăng nhập</Text>
      </View>

      <View style={[styles.inputContainer, isPhoneFocused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
          placeholder="Số điện thoại"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          onFocus={() => setIsPhoneFocused(true)}
          onBlur={() => setIsPhoneFocused(false)}
        />
        {phoneNumber.length > 0 && (
          <TouchableOpacity onPress={() => setPhoneNumber("")} style={styles.clearIcon}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.inputContainer, isPasswordFocused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
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

      <TouchableOpacity style={styles.forgotPassword}>
        <Text style={styles.forgotText}>Lấy lại mật khẩu</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => alert("Đăng nhập thành công! (Chưa có logic thực tế)")}
      >
        <Text style={styles.buttonText}>Đăng nhập</Text>
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Bạn chưa có tài khoản?{" "}
        <Text style={styles.registerLink} onPress={() => router.push("/register")}>
          Đăng ký ngay
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingTop: 0, 
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  infoBox: {
    backgroundColor: "#F5F5F5", // Màu xám nhạt
    paddingVertical: 10,
    paddingHorizontal: 25,
    marginBottom: 15,
    marginHorizontal: -20, 
  },
  instruction: {
    fontSize: 14,
    color: "#666",
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
    borderBottomColor: "#007AFF", 
    borderBottomWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  clearIcon: {
    marginLeft: 10,
  },
  togglePassword: {
    marginLeft: 10,
  },
  forgotPassword: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  forgotText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 20,
    width: "75%",
    alignSelf: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerText: {
    color: "#000",
    fontSize: 14,
    textAlign: "center",
  },
  registerLink: {
    color: "#007AFF",
    fontWeight: "bold",
  },
});
