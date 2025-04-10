import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterOTP() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [error, setError] = useState("");
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const insets = useSafeAreaInsets();

  const otpRefs = Array(6).fill(null).map(() => useRef<TextInput>(null));

  const sendOTP = async () => {
    if (!email) {
      setError("Vui lòng nhập email!");
      return;
    }
    try {
      const response = await fetch("http://localhost:3000/api/OTP/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gmail: email }),
      });
      const data = await response.json();
      if (response.ok) {
        setTimer(60);
        setResendDisabled(true);
        setIsOTPSent(true);
        setError("");
      } else {
        setError(data.message || "Lỗi khi gửi OTP");
      }
    } catch (err) {
      setError("Không thể kết nối đến server");
    }
  };

  const verifyOTP = async (otpValue: string) => {
    if (isVerifying) return;

    setIsVerifying(true);
    try {
      const response = await fetch("http://localhost:3000/api/OTP/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gmail: email, OTP: otpValue }),
      });
      const data = await response.json();
      if (response.ok) {
        router.push({ pathname: "/register", params: { email } });
      } else {
        setError(data.message || "OTP không đúng");
      }
    } catch (err) {
      setError("Không thể kết nối đến server");
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (isOTPSent) {
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
    }
  }, [isOTPSent]);

  const handleOtpChange = (value: string, index: number) => {
    if (/^\d$/.test(value) || value === "") {
      let newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value !== "" && index < 5) {
        otpRefs[index + 1].current?.focus();
      }

      if (value === "" && index > 0) {
        otpRefs[index - 1].current?.focus();
      }

      // Tính toán OTP ngay tại đây và gọi verifyOTP
      if (index === 5 && value !== "" && !error && !isVerifying) {
        const enteredOTP = [...newOtp].join(""); // Sử dụng newOtp để đảm bảo giá trị mới nhất
        verifyOTP(enteredOTP);
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Platform.OS === "ios" ? insets.top : 3, paddingBottom: 8 },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.sub}>Xác thực email</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.instruction}>
          Vui lòng nhập email để nhận mã OTP
        </Text>
      </View>

      {!isOTPSent ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Nhập email của bạn"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.button} onPress={sendOTP}>
            <Text style={styles.buttonText}>Gửi OTP</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.callingText}>
            Mã OTP đã được gửi đến {email}
          </Text>
          <Text style={styles.callingSubText}>
            Vui lòng nhập mã 6 số vào ô bên dưới
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

          <View style={styles.resendContainer}>
            <TouchableOpacity disabled={resendDisabled} onPress={sendOTP}>
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
            onPress={() => verifyOTP(otp.join(""))} // Truyền giá trị OTP trực tiếp
            disabled={isVerifying}
          >
            <Text style={styles.buttonText}>Xác thực</Text>
          </TouchableOpacity>
        </>
      )}

      {error && !isOTPSent ? <Text style={styles.errorText}>{error}</Text> : null}
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
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  otpBox: {
    width: 45,
    height: 45,
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