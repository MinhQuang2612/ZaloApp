import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signInWithPhoneNumber } from "firebase/auth";

// Lấy auth trực tiếp mà không cần initializeApp thủ công
const auth = getAuth();

export default function RegisterOTP() {
  const router = useRouter();
  const { phone } = useLocalSearchParams(); // Nhận số điện thoại từ query params
  const [otp, setOtp] = useState(["", "", "", "", "", ""]); // Hỗ trợ 6 chữ số
  const [timer, setTimer] = useState(60);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Tạo ref để điều hướng giữa các ô nhập OTP (6 ô)
  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // Gửi OTP khi component được mount
  useEffect(() => {
    if (phone) {
      sendOtp();
    }
  }, [phone]);

  // Đếm ngược thời gian để gửi lại mã
  useEffect(() => {
    let countdown = setInterval(() => {
      setTimer((prev) => {
        if (prev === 1) {
          clearInterval(countdown);
          setResendDisabled(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [resendDisabled]);

  // Hàm gửi OTP
  const sendOtp = async () => {
    try {
      // Tự động thêm mã quốc gia +84 khi gửi OTP
      const phoneNumber = `+84${phone}`;
      // Trên mobile, Firebase tự động xử lý reCAPTCHA, nên không cần verifier
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber);
      setConfirmation(confirmationResult);
      Alert.alert("Thành công", "Mã OTP đã được gửi đến số điện thoại của bạn!");
    } catch (error) {
      console.error("Lỗi khi gửi OTP:", error);
      Alert.alert("Lỗi", "Không thể gửi mã OTP. Vui lòng thử lại!");
    }
  };

  // Hàm xác thực OTP
  const verifyOtp = async () => {
    if (!confirmation) {
      Alert.alert("Lỗi", "Không có mã xác thực. Vui lòng gửi lại OTP!");
      return;
    }

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ mã OTP (6 chữ số)!");
      return;
    }

    setIsVerifying(true);
    try {
      await confirmation.confirm(otpCode);
      Alert.alert("Thành công", "Xác thực OTP thành công!");
      // Chuyển đến màn hình Register với số điện thoại đã xác thực
      router.push({ pathname: "/register", params: { phone } });
    } catch (error) {
      console.error("Lỗi khi xác thực OTP:", error);
      Alert.alert("Lỗi", "Mã OTP không đúng. Vui lòng thử lại!");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (/^\d$/.test(value) || value === "") {
      let newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Nếu nhập xong thì tự động nhảy sang ô tiếp theo
      if (value !== "" && index < 5) {
        otpRefs[index + 1].current?.focus();
      }

      // Nếu xóa thì quay lại ô trước
      if (value === "" && index > 0) {
        otpRefs[index - 1].current?.focus();
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.sub}>Kích hoạt tài khoản</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.instruction}>
          Vui lòng không chia sẻ mã xác thực để tránh mất tài khoản
        </Text>
      </View>

      {/* Hiển thị số điện thoại không có mã quốc gia */}
      <Text style={styles.callingText}>
        Tin nhắn được gửi đến số {phone || "XXX XXX XXX"}
      </Text>
      <Text style={styles.callingSubText}>Vui lòng nhập mã 6 chữ số vào ô bên dưới</Text>

      {/* OTP Input (6 ô) */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={otpRefs[index]}
            style={styles.otpBox}
            keyboardType="numeric"
            maxLength={1}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
          />
        ))}
      </View>

      {/* Gửi lại mã */}
      <View style={styles.resendContainer}>
        <TouchableOpacity
          disabled={resendDisabled}
          onPress={() => {
            setResendDisabled(true);
            setTimer(60);
            sendOtp();
          }}
        >
          <Text
            style={[styles.resendText, resendDisabled && { color: "#ccc" }]}
          >
            Gửi lại mã
          </Text>
        </TouchableOpacity>
        <Text style={styles.timer}>
          {" "}
          {timer < 10 ? `00:0${timer}` : `00:${timer}`}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, isVerifying && styles.buttonDisabled]}
        onPress={verifyOtp}
        disabled={isVerifying}
      >
        <Text style={styles.buttonText}>
          {isVerifying ? "Đang xác thực..." : "Tiếp tục"}
        </Text>
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
    marginHorizontal: -10,
  },
  backButton: {
    marginRight: 15,
  },
  sub: {
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
  callingText: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
  },
  callingSubText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    marginTop: 5,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  otpBox: {
    width: 40,
    height: 50,
    borderWidth: 2,
    borderColor: "#007AFF",
    textAlign: "center",
    fontSize: 18,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  resendText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  timer: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 5,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 10,
    width: "75%",
    alignSelf: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});