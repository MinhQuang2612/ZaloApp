import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Switch,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router"; // Thêm useFocusEffect
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, logoutUser } from "../services/auth";
import Footer from "../components/Footer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { disconnectSocket } from "../services/socket";

interface User {
  userID: string;
  phoneNumber: string;
  username: string;
  DOB: string;
  gmail: string;
  avatar?: string;
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState<boolean>(true);
  const insets = useSafeAreaInsets();

  const fetchUser = async () => {
    try {
      const userData = await getCurrentUser();
      console.log("Profile.js: Fetched userData:", userData); // Log để kiểm tra
      if (!userData) {
        router.replace("/login");
      } else {
        setUser(userData);
      }
      setLoading(false);
    } catch (error) {
      console.error("Profile.js: Error fetching user:", error);
      router.replace("/login");
      setLoading(false);
    }
  };

  // Load user khi trang được focus (để cập nhật avatar sau khi quay lại từ ProfileDetails)
  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [])
  );

  const handleLogout = async () => {
    await logoutUser();
    disconnectSocket();
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 3, paddingBottom: 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Tài khoản và bảo mật</Text>
      </View>

      <Text style={styles.sectionTitle}>Tài khoản</Text>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/profile_details")}>
        <View style={styles.row}>
          {/* Hiển thị avatar từ user.avatar, nếu không có thì dùng ảnh mặc định */}
          {user?.avatar && user.avatar !== "NONE" ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.avatar}
              onError={(e) => console.log("Error loading avatar:", e.nativeEvent.error)} // Log lỗi nếu không tải được ảnh
            />
          ) : (
            <Image source={require("../assets/images/dog_avatar.gif")} style={styles.avatar} />
          )}
          <View style={styles.userInfo}>
            <Text style={styles.subText}>Thông tin cá nhân</Text>
            <Text style={styles.userName}>{user?.username || "Không có tên"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item}>
        <Ionicons name="mail" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Email</Text>
        <Text style={styles.value}>{user?.gmail || "Chưa liên kết"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item}>
        <Ionicons name="shield-checkmark" size={22} color="green" />
        <Text style={styles.itemText}>Định danh tài khoản</Text>
        <Text style={[styles.value, { color: "green" }]}>Đã định danh</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/my_qr_code")}>
        <Ionicons name="qr-code" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Mã QR của tôi</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Đăng nhập</Text>

      <TouchableOpacity style={styles.item}>
        <Ionicons name="phone-portrait" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Thiết bị đang đăng nhập</Text>
        <Ionicons name="chevron-forward" size={22} color="#999" />
      </TouchableOpacity>

      <View style={styles.item}>
        <Ionicons name="lock-closed" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Bảo mật 2 lớp</Text>
        <Switch value={twoFactorAuth} onValueChange={setTwoFactorAuth} />
      </View>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/change_password")}>
        <Ionicons name="key" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Đổi mật khẩu</Text>
        <Ionicons name="chevron-forward" size={22} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/qr_login")}>
        <Ionicons name="qr-code-outline" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Quét QR kết bạn hoặc đăng nhập web</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Khác</Text>
      <TouchableOpacity style={[styles.item, { borderBottomWidth: 0 }]}>
        <Ionicons name="trash" size={22} color="red" />
        <Text style={[styles.itemText, { color: "red" }]}>Xóa tài khoản</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.item, { borderBottomWidth: 0 }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="red" />
        <Text style={[styles.itemText, { color: "red" }]}>Đăng xuất</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
      <Footer />
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  card: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  subText: {
    fontSize: 14,
    color: "#666",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  itemText: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: "#555",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  spacer: {
    flex: 1,
  },
});