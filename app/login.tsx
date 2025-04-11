import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { loginUser } from "../services/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getGmailByPhone, sendOTP, verifyOTP, resetPassword } from "../services/forgot_password";

export default function Login() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState<boolean>(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // State cho quên mật khẩu
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotPhone, setForgotPhone] = useState<string>("");
  const [gmail, setGmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);

  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại và mật khẩu!");
      return;
    }

    setLoading(true);
    try {
      const user = await loginUser(phoneNumber, password);
      Alert.alert("Thành công", `Chào mừng ${user.username || "Người dùng"}!`);
      router.replace("/home");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Đăng nhập thất bại. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // Xử lý quên mật khẩu
  const handleForgotPassword = async () => {
    setShowForgotModal(true);
    setStep("phone");
    setForgotPhone("");
    setGmail("");
    setOtp("");
  };

  const handleNextStep = async () => {
    setForgotLoading(true);
    try {
      if (step === "phone") {
        if (!forgotPhone) {
          Alert.alert("Lỗi", "Vui lòng nhập số điện thoại!");
          return;
        }
        const email = await getGmailByPhone(forgotPhone);
        setGmail(email);
        await sendOTP(email);
        setStep("otp");
        Alert.alert("Thành công", "Đã gửi OTP qua email. Vui lòng kiểm tra thư rác nếu không thấy!");
      } else if (step === "otp") {
        if (!otp) {
          Alert.alert("Lỗi", "Vui lòng nhập mã OTP!");
          return;
        }
        await verifyOTP(gmail, otp);
        const resetMessage = await resetPassword(forgotPhone);
        setStep("success");
        Alert.alert("Thành công", resetMessage);
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Đã xảy ra lỗi. Vui lòng thử lại!");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowForgotModal(false);
    setStep("phone"); // Reset step về ban đầu
    setForgotPhone("");
    setGmail("");
    setOtp("");
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "ios" ? insets.top : 3,
          paddingBottom: 8,
        },
      ]}
    >
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

      <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
        <Text style={styles.forgotText}>Lấy lại mật khẩu</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Text>
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Bạn chưa có tài khoản?{" "}
        <Text style={styles.registerLink} onPress={() => router.push("/register")}>
          Đăng ký ngay
        </Text>
      </Text>

      {/* Modal Quên Mật Khẩu */}
      <Modal
        visible={showForgotModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {step === "phone" && (
              <>
                <Text style={styles.modalTitle}>Lấy lại mật khẩu</Text>
                <Text style={styles.modalInstruction}>Nhập số điện thoại của bạn:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Số điện thoại"
                  keyboardType="phone-pad"
                  value={forgotPhone}
                  onChangeText={setForgotPhone}
                />
              </>
            )}
            {step === "otp" && (
              <>
                <Text style={styles.modalTitle}>Xác thực OTP</Text>
                <Text style={styles.modalInstruction}>Nhập mã OTP đã gửi đến {gmail}:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Mã OTP"
                  keyboardType="numeric"
                  value={otp}
                  onChangeText={setOtp}
                />
              </>
            )}
            {step === "success" && (
              <>
                <Text style={styles.modalTitle}>Thành công</Text>
                <Text style={styles.modalInstruction}>
                  Mật khẩu mới đã được gửi đến Gmail của bạn. Vui lòng kiểm tra email!
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.modalButton, forgotLoading && styles.disabledButton]}
              onPress={step === "success" ? handleCloseModal : handleNextStep}
              disabled={forgotLoading}
            >
              <Text style={styles.modalButtonText}>
                {forgotLoading ? "Đang xử lý..." : step === "success" ? "Đóng" : "Tiếp tục"}
              </Text>
            </TouchableOpacity>
            {step !== "success" && (
              <TouchableOpacity onPress={handleCloseModal}>
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
    backgroundColor: "#F5F5F5",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "85%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 15,
  },
  modalInstruction: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 15,
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#999",
  },
  cancelText: {
    color: "#FF3B30",
    fontSize: 14,
    marginTop: 10,
  },
});