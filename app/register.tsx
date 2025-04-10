import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router"; // Thêm useLocalSearchParams
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { registerUser } from "../services/register";
import { Provider as PaperProvider } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

// Khai báo kiểu thủ công cho DatePickerModal
interface CustomDatePickerModalProps {
  locale?: string;
  mode: "single" | "range" | "multiple";
  visible: boolean;
  onDismiss: () => void;
  date?: Date;
  onConfirm: (params: { date: Date | null }) => void;
  validRange?: {
    startDate?: Date;
    endDate?: Date;
  };
  saveLabel?: string;
  closeLabel?: string;
  label?: string;
  saveLabelDisabled?: boolean;
}

// Ép kiểu DatePickerModal để sử dụng kiểu thủ công
const CustomDatePickerModal = DatePickerModal as React.ComponentType<CustomDatePickerModalProps>;

export default function Register() {
  const router = useRouter();
  const { email } = useLocalSearchParams(); // Lấy email từ params
  const [isTermsAccepted, setTermsAccepted] = useState(false);
  const [isSocialAccepted, setSocialAccepted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [DOB, setDOB] = useState<Date | null>(null);
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const insets = useSafeAreaInsets();

  const handleRegister = async () => {
    if (!isTermsAccepted || !isSocialAccepted) {
      alert("Vui lòng đồng ý với các điều khoản!");
      return;
    }
    if (!email || !phoneNumber || !password || !username || !DOB) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    const formattedDOB = formatDateForAPI(DOB);
    const userData = {
      gmail: email as string, // Ép kiểu email từ params  
      phoneNumber,
      password,
      username,
      DOB: formattedDOB,
    };
    console.log("User data before calling API:", userData);

    try {
      const registeredUser = await registerUser(userData);
      if (registeredUser) {
        alert("Đăng ký thành công!");
        setTimeout(() => {
          router.push("/login");
        }, 1000);
      }
    } catch (error) {
      alert("Đăng ký thất bại, vui lòng thử lại!");
      console.error("Registration error:", error);
    }
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return "Chọn ngày sinh";
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <PaperProvider>
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

        {/* Email (hiển thị readonly) */}
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={email as string || ""}
          editable={false} // Không cho chỉnh sửa
          placeholder="Email"
        />

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
          <Text style={styles.dateLabel}>Ngày sinh</Text>
          <TouchableOpacity
            style={styles.datePickerContainer}
            onPress={() => setOpenDatePicker(true)}
          >
            <Text style={styles.dateText}>{formatDateForDisplay(DOB)}</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        <CustomDatePickerModal
          locale="vi"
          mode="single"
          visible={openDatePicker}
          onDismiss={() => setOpenDatePicker(false)}
          date={DOB || new Date()}
          onConfirm={({ date }) => {
            setOpenDatePicker(false);
            setDOB(date ? new Date(date) : null);
          }}
          validRange={{
            endDate: new Date(),
          }}
          saveLabel="Xác nhận"
          closeLabel="Hủy"
          label="Chọn ngày sinh"
          saveLabelDisabled={false}
        />

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
            isTermsAccepted && isSocialAccepted && email && phoneNumber && password && username && DOB
              ? styles.buttonActive
              : styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={!isTermsAccepted || !isSocialAccepted || !email || !phoneNumber || !password || !username || !DOB}
        >
          <Text
            style={[
              styles.buttonText,
              isTermsAccepted && isSocialAccepted && email && phoneNumber && password && username && DOB
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
    </PaperProvider>
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
  disabledInput: {
    backgroundColor: "#F5F5F5", // Màu nền khác để chỉ rõ là readonly
    color: "#666", // Màu chữ nhạt hơn
  },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 16,
    color: "#007AFF",
    marginRight: 10,
    width: 120,
    fontWeight: "bold",
  },
  datePickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  dateText: {
    fontSize: 16,
    color: "#000",
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