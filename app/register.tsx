// Register.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { registerUser } from "../services/register";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function Register() {
  const router = useRouter();
  const [isTermsAccepted, setTermsAccepted] = useState(false);
  const [isSocialAccepted, setSocialAccepted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [DOB, setDOB] = useState<Date | null>(null); // Lưu dưới dạng Date object
  const insets = useSafeAreaInsets();

  const handleRegister = async () => {
    if (!isTermsAccepted || !isSocialAccepted) {
      alert("Vui lòng đồng ý với các điều khoản!");
      return;
    }
    if (!phoneNumber || !password || !username || !DOB) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    const formattedDOB = formatDateForAPI(DOB);
    const userData = {
      phoneNumber,
      password,
      username,
      DOB: formattedDOB, // Gửi dạng 20/03/2025
    };
    console.log("User data before calling API:", userData);
    const registeredUser = await registerUser(userData);
    if (registeredUser) {
      router.push("/login");
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || DOB;
    setDOB(currentDate);
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];// Định dạng 20/03/2025 để gửi API
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Platform.OS === "ios" ? insets.top : 3, paddingBottom: 8 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.sub}>Đăng ký</Text>
      </View>

      <Text style={styles.title}>Đăng ký tài khoản</Text>

      {/* Phone Number */}
      <TextInput
        style={styles.input}
        placeholder="Số điện thoại"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />

      {/* Password */}
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* Username */}
      <TextInput
        style={styles.input}
        placeholder="Tên người dùng"
        value={username}
        onChangeText={setUsername}
      />

      {/* Date of Birth */}
      <View style={styles.datePickerRow}>
        <Text style={styles.dateLabel}>Chọn ngày sinh</Text>
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={DOB || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "default" : "calendar"}
            onChange={onDateChange}
            maximumDate={new Date()}
            style={styles.datePicker}
          />
        </View>
      </View>

      {/* Checkbox */}
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          onPress={() => setTermsAccepted(!isTermsAccepted)}
          style={[
            styles.customCheckbox,
            isTermsAccepted && styles.checkboxChecked,
          ]}
        >
          {isTermsAccepted && <Ionicons name="checkmark" size={18} color="white" />}
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>
          Tôi đồng ý với các <Text style={styles.link}>điều khoản sử dụng Zalo</Text>
        </Text>
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          onPress={() => setSocialAccepted(!isSocialAccepted)}
          style={[
            styles.customCheckbox,
            isSocialAccepted && styles.checkboxChecked,
          ]}
        >
          {isSocialAccepted && <Ionicons name="checkmark" size={18} color="white" />}
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>
          Tôi đồng ý với <Text style={styles.link}>điều khoản Mạng xã hội của Zalo</Text>
        </Text>
      </View>

      {/* Button */}
      <TouchableOpacity
        style={[
          styles.button,
          isTermsAccepted && isSocialAccepted && phoneNumber && password && username && DOB
            ? styles.buttonActive
            : styles.buttonDisabled,
        ]}
        onPress={handleRegister}
        disabled={!isTermsAccepted || !isSocialAccepted || !phoneNumber || !password || !username || !DOB}
      >
        <Text
          style={[
            styles.buttonText,
            isTermsAccepted && isSocialAccepted && phoneNumber && password && username && DOB
              ? styles.buttonTextActive
              : styles.buttonTextDisabled,
          ]}
        >
          Đăng ký
        </Text>
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Bạn đã có tài khoản?{" "}
        <Text style={styles.registerLink} onPress={() => router.push("/login")}>
          Đăng nhập ngay
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginHorizontal: -20,
  },
  sub: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginTop: 20,
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 16,
    color: "#007AFF", // Màu xám giống placeholder của TextInput
    marginRight: 10,
    width: 120, // Cố định chiều rộng để căn chỉnh
    fontWeight: "bold",
  },
  datePickerContainer: {
    flex: 1,
  },
  datePicker: {
    width: "100%",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  customCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#000",
  },
  link: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  button: {
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
    width: "80%",
    alignSelf: "center",
  },
  buttonActive: {
    backgroundColor: "#007AFF",
  },
  buttonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonTextActive: {
    color: "#fff",
  },
  buttonTextDisabled: {
    color: "#666",
  },
  registerText: {
    color: "#000",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  registerLink: {
    color: "#007AFF",
    fontWeight: "bold",
  },
});