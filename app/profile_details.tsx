import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser } from "../services/auth";
import { updateProfile } from "../services/profile";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

// Định nghĩa interface User khớp với dữ liệu từ auth.ts
interface User {
  userID: string; // Sửa _id thành userID
  username: string;
  phoneNumber: string;
  DOB: string;
}

export default function ProfileDetails() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [dob, setDob] = useState<Date>(new Date());
  const [displayDob, setDisplayDob] = useState<string>("");
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const insets = useSafeAreaInsets();

  const formatDateForDisplay = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Chưa cập nhật";
      }
      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error parsing date:", error);
      return "Chưa cập nhật";
    }
  };

  const formatDateToApi = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = await getCurrentUser();
        console.log("ProfileDetails.tsx: Fetched userData:", userData);

        if (!userData || !userData.userID || !userData.username || !userData.phoneNumber) {
          console.error("ProfileDetails.tsx: Invalid userData:", userData);
          Alert.alert("Lỗi", "Không thể lấy thông tin người dùng. Vui lòng đăng nhập lại.");
          router.replace("/login");
          return;
        }

        // Dữ liệu đã khớp với interface User, không cần ánh xạ thêm
        setUser(userData);
        setUsername(userData.username);
        setDisplayDob(formatDateForDisplay(userData.DOB));

        try {
          const date = new Date(userData.DOB);
          if (!isNaN(date.getTime())) {
            setDob(date);
          } else {
            setDob(new Date());
          }
        } catch (error) {
          console.error("Error parsing DOB for DateTimePicker:", error);
          setDob(new Date());
        }
      } catch (error) {
        console.error("ProfileDetails.tsx: Error fetching user:", error);
        Alert.alert("Lỗi", "Đã có lỗi xảy ra khi lấy thông tin người dùng.");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Lỗi", "Không có thông tin người dùng để cập nhật.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Lỗi", "Tên không được để trống.");
      return;
    }

    if (!dob) {
      Alert.alert("Lỗi", "Ngày sinh không được để trống.");
      return;
    }

    try {
      const formattedDob = formatDateToApi(dob);
      const updatedUser = await updateProfile(user.userID, username, formattedDob); // Sử dụng userID thay vì _id

      // Cập nhật lại user với dữ liệu mới từ API
      const formattedUpdatedUser: User = {
        userID: updatedUser.userID,
        username: updatedUser.username || user.username,
        phoneNumber: updatedUser.phoneNumber || user.phoneNumber,
        DOB: updatedUser.DOB || user.DOB,
      };

      setUser(formattedUpdatedUser);
      setDisplayDob(formatDateForDisplay(formattedUpdatedUser.DOB));
      setIsEditing(false);
      Alert.alert("Thành công", "Thông tin cá nhân đã được cập nhật.");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật thông tin.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <PaperProvider>
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
          <Text style={styles.title}>Thông tin cá nhân</Text>
        </View>

        <View style={styles.avatarContainer}>
          <Image
            source={require("../assets/images/dog_avatar.gif")}
            style={styles.avatar}
          />
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="person" size={22} color="#007AFF" />
            <Text style={styles.label}>Tên Zalo</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
              />
            ) : (
              <Text style={styles.value}>{user?.username || "Không có tên"}</Text>
            )}
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={22} color="#007AFF" />
            <Text style={styles.label}>Ngày sinh</Text>
            {isEditing ? (
              <TouchableOpacity
                style={styles.datePickerContainer}
                onPress={() => setOpenDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {dob.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.value}>{displayDob || "Chưa cập nhật"}</Text>
            )}
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="call" size={22} color="#007AFF" />
            <Text style={styles.label}>Số điện thoại</Text>
            <Text style={styles.value}>{user?.phoneNumber || "Không có số"}</Text>
          </View>
        </View>

        {/* Date Picker Modal */}
        {isEditing && (
          <CustomDatePickerModal
            locale="vi"
            mode="single"
            visible={openDatePicker}
            onDismiss={() => setOpenDatePicker(false)}
            date={dob}
            onConfirm={({ date }) => {
              setOpenDatePicker(false);
              setDob(date ? new Date(date) : new Date());
            }}
            validRange={{
              endDate: new Date(),
            }}
            saveLabel="Xác nhận"
            closeLabel="Hủy"
            label="Chọn ngày sinh"
            saveLabelDisabled={false}
          />
        )}

        <TouchableOpacity
          style={styles.editButton}
          onPress={isEditing ? handleSave : () => setIsEditing(true)}
        >
          <Ionicons name="create" size={20} color={isEditing ? "#fff" : "#000"} />
          <Text style={styles.editButtonText}>{isEditing ? "Lưu" : "Chỉnh sửa"}</Text>
        </TouchableOpacity>
      </View>
    </PaperProvider>
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
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  avatarContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  infoContainer: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 10,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  label: {
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
  },
  value: {
    fontSize: 16,
    color: "#333",
  },
  input: {
    flex: 1,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#007AFF",
    paddingBottom: 5,
  },
  datePickerContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#007AFF",
    paddingBottom: 5,
    justifyContent: "center",
  },
  dateText: {
    fontSize: 16,
    color: "#333",
  },
  editButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
  },
  editButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});