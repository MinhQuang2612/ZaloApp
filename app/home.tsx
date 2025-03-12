// chỉ mới code để hiển thị thông tin người dùng và nút đăng xuất.
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { getCurrentUser, logoutUser } from "../services/auth";

interface User {
  _id: string;
  userID: string;
  phoneNumber: string;
  username: string;
  accountRole: string;
  DOB: string;
  __v: number;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const handleLogout = async () => {
    await logoutUser();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trang Chủ</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.userInfo}>
        <Ionicons name="person-circle" size={80} color="#007AFF" />
        <Text style={styles.userName}>{user?.username || "Không có tên"}</Text>
        <Text style={styles.userPhone}>{user?.phoneNumber || "Không có số điện thoại"}</Text>
      </View>

      <Text style={styles.welcome}>Chào mừng bạn đến với Zalo Chat! 🎉</Text>

      <TouchableOpacity style={styles.logoutButtonLarge} onPress={handleLogout}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  logoutButton: {
    padding: 5,
  },
  userInfo: {
    alignItems: "center",
    marginTop: 30,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },
  userPhone: {
    fontSize: 16,
    color: "#555",
  },
  welcome: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButtonLarge: {
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
    width: "75%",
    alignSelf: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});