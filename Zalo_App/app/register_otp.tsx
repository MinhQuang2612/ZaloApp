import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons"; // Import icon

export default function RegisterOTP() {
  const router = useRouter();
  const { phone } = useLocalSearchParams(); // Nhận số điện thoại từ query params
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [resendDisabled, setResendDisabled] = useState(true);

  // Tạo ref để điều hướng giữa các ô nhập OTP
  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

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

  const handleOtpChange = (value: string, index: number) => {
    if (/^\d$/.test(value) || value === "") {
      let newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Nếu nhập xong thì tự động nhảy sang ô tiếp theo
      if (value !== "" && index < 3) {
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

      <Text style={styles.callingText}>
        Đang gọi đến số {phone ? `(+84) ${phone}` : "(+84) XXX XXX XXX"}
      </Text>
      <Text style={styles.callingSubText}>Vui lòng bắt máy để nghe mã</Text>

      {/* OTP Input */}
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
        style={styles.button}
        onPress={() => {
          // Chuyển đến màn hình "create_account" và truyền số điện thoại đã xác thực
          router.push({ pathname: "/create_account", params: { phone } });
        }}
      >
        <Text style={styles.buttonText}>Tiếp tục</Text>
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
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: "#007AFF",
    textAlign: "center",
    fontSize: 18,
    marginHorizontal: 8,
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
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
