// ProfileDetails.tsx
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
import DateTimePicker from "@react-native-community/datetimepicker";

// Định nghĩa interface User khớp với dữ liệu từ API
interface User {
  _id: string;
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
  const [dob, setDob] = useState<Date>(new Date()); // Khởi tạo mặc định là ngày hiện tại
  const [displayDob, setDisplayDob] = useState<string>(""); // Định dạng hiển thị: DD/MM/YYYY
  const insets = useSafeAreaInsets();

  // Hàm chuyển định dạng từ yyyy-mm-dd sang dd/mm/yyyy
  const formatDateForDisplay = (dateString: string): string => {
    try {
      // Giả sử dateString là yyyy-mm-dd
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Chưa cập nhật"; // Nếu không parse được, trả về giá trị mặc định
      }
      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }); // Trả về dd/mm/yyyy, ví dụ: 18/10/2003
    } catch (error) {
      console.error("Error parsing date:", error);
      return "Chưa cập nhật";
    }
  };

  // Hàm chuyển định dạng từ Date object sang yyyy-mm-dd
  const formatDateToApi = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Trả về yyyy-mm-dd, ví dụ: 2003-10-18
  };

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getCurrentUser();
      if (!userData) {
        router.replace("/login");
      } else {
        setUser(userData);
        setUsername(userData.username);
        // Chuyển định dạng DOB để hiển thị
        setDisplayDob(formatDateForDisplay(userData.DOB));
        // Chuyển DOB thành Date object để dùng trong DateTimePicker
        try {
          const date = new Date(userData.DOB);
          if (!isNaN(date.getTime())) {
            setDob(date);
          } else {
            setDob(new Date()); // Nếu không parse được, dùng ngày hiện tại
          }
        } catch (error) {
          console.error("Error parsing DOB for DateTimePicker:", error);
          setDob(new Date()); // Giá trị mặc định nếu lỗi
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  // Xử lý cập nhật thông tin
  const handleSave = async () => {
    if (!user) return;

    // Kiểm tra dữ liệu đầu vào
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
      const updatedUser = await updateProfile(user._id, username, formattedDob);
      
      setUser({
        ...user,
        username: updatedUser.username,
        DOB: updatedUser.DOB,
      });
      
      setDisplayDob(formatDateForDisplay(updatedUser.DOB));
      setIsEditing(false);
      Alert.alert("Thành công", "Thông tin cá nhân đã được cập nhật.");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật thông tin.");
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || dob;
    setDob(currentDate);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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
            <DateTimePicker
              value={dob}
              mode="date"
              display={Platform.OS === "ios" ? "default" : "calendar"}
              onChange={onDateChange}
              maximumDate={new Date()}
              style={styles.datePicker}
            />
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

      <TouchableOpacity
        style={styles.editButton}
        onPress={isEditing ? handleSave : () => setIsEditing(true)}
      >
        <Ionicons name="create" size={20} color={isEditing ? "#fff" : "#000"} />
        <Text style={styles.editButtonText}>{isEditing ? "Lưu" : "Chỉnh sửa"}</Text>
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
  datePicker: {
    flex: 1,
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