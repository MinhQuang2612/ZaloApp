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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { getCurrentUser } from "../services/auth";
import Footer from "../components/Footer";
import { logoutUser } from "../services/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
interface User {
  _id: string;
  userID: string;
  phoneNumber: string;
  username: string;
  accountRole: string;
  DOB: string;
  __v: number;
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState<boolean>(true); // Trạng thái bảo mật 2 lớp
  const insets = useSafeAreaInsets();
  
  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getCurrentUser();
      if (!userData) {
        router.replace("/login");
      } else {
        setUser(userData);
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[
            styles.container,
            {
              // Trên iOS: paddingTop = insets.top để nằm sát dưới Dynamic Island
              // Trên Android: paddingTop = 3 (giá trị mặc định, không bị ảnh hưởng bởi insets)
              paddingTop: Platform.OS === "ios" ? insets.top : 3,
              paddingBottom: 8, // Đảm bảo chiều cao navbar đủ lớn
            },
          ]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Tài khoản và bảo mật</Text>
      </View>

      {/* Thông tin tài khoản */}
      <Text style={styles.sectionTitle}>Tài khoản</Text>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/profile_details")}
      >
        <View style={styles.row}>
          <Image
            source={require("../assets/images/dog_avatar.gif")}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.subText}>Thông tin cá nhân</Text>
            <Text style={styles.userName}>
              {user?.username || "Không có tên"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item}>
        <Ionicons name="mail" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Email</Text>
        <Text style={styles.value}>Chưa liên kết</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item}>
        <Ionicons name="shield-checkmark" size={22} color="green" />
        <Text style={styles.itemText}>Định danh tài khoản</Text>
        <Text style={[styles.value, { color: "green" }]}>Đã định danh</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item}>
        <Ionicons name="qr-code" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Mã QR của tôi</Text>
      </TouchableOpacity>

      {/* Đăng nhập */}
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

      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push("/change_password")}
      >
        <Ionicons name="key" size={22} color="#007AFF" />
        <Text style={styles.itemText}>Đổi mật khẩu</Text>
        <Ionicons name="chevron-forward" size={22} color="#999" />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Khác</Text>
      <TouchableOpacity style={[styles.item, { borderBottomWidth: 0 }]}>
        <Ionicons name="trash" size={22} color="red" />
        <Text style={[styles.itemText, { color: "red" }]}>Xóa tài khoản</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.item, { borderBottomWidth: 0 }]}
        onPress={async () => {
          await logoutUser(); // Xóa thông tin đăng nhập
          router.replace("/login"); 
        }}
      >
        <Ionicons name="log-out-outline" size={22} color="red" />
        <Text style={[styles.itemText, { color: "red" }]}>Đăng xuất</Text>
      </TouchableOpacity>

      {/* Spacer để đẩy Footer xuống dưới */}
      <View style={styles.spacer} />

      {/* Footer */}
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Container chính chiếm toàn bộ chiều cao màn hình
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
    //marginTop: 20,
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
