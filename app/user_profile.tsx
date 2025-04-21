import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchUserByID } from "../services/contacts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface User {
  userID: string;
  username: string;
  phoneNumber?: string; // Optional để tránh lỗi nếu API không trả về
  DOB?: string; // Optional để tránh lỗi nếu API không trả về
  gmail?: string; // Optional để tránh lỗi nếu API không trả về
  avatar?: string;
}

export default function UserProfile() {
  const router = useRouter();
  const { userID } = useLocalSearchParams<{ userID: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [displayDob, setDisplayDob] = useState<string>("");
  const insets = useSafeAreaInsets();

  const formatDateForDisplay = (dateString?: string): string => {
    if (!dateString) return "Chưa cập nhật";
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

  useEffect(() => {
    const fetchUser = async () => {
      if (!userID) {
        console.error("UserProfile.tsx: Invalid userID:", userID);
        Alert.alert("Lỗi", "Không thể lấy thông tin người dùng.");
        router.back();
        return;
      }

      try {
        setLoading(true);
        const userData = await fetchUserByID(userID);
        console.log("UserProfile.tsx: Fetched userData:", userData);

        if (!userData || !userData.userID || !userData.username) {
          console.error("UserProfile.tsx: Invalid userData:", userData);
          Alert.alert("Lỗi", "Không thể lấy thông tin người dùng.");
          router.back();
          return;
        }

        setUser(userData);
        setDisplayDob(formatDateForDisplay(userData.DOB));
      } catch (error) {
        console.error("UserProfile.tsx: Error fetching user:", error);
        Alert.alert("Lỗi", "Đã có lỗi xảy ra khi lấy thông tin người dùng.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userID, router]);

  const handleBackToChat = () => {
    if (userID) {
      router.push({ pathname: "/single_chat", params: { userID } });
    } else {
      Alert.alert("Lỗi", "Không thể mở đoạn chat do thiếu userID.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    return null;
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
        <Text style={styles.title}>Thông tin người dùng</Text>
        <TouchableOpacity onPress={handleBackToChat} style={styles.chatButton}>
          <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.avatarContainer}>
        {user.avatar ? (
          <Image
            source={{ uri: user.avatar }}
            style={styles.avatar}
            onError={(e) => console.log("Error loading avatar in UserProfile:", e.nativeEvent.error)}
          />
        ) : (
          <Image
            source={require("../assets/images/dog_avatar.gif")}
            style={styles.avatar}
          />
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <Ionicons name="person" size={22} color="#007AFF" />
          <Text style={styles.label}>Tên Zalo</Text>
          <Text style={styles.value}>{user.username || "Không có tên"}</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="calendar" size={22} color="#007AFF" />
          <Text style={styles.label}>Ngày sinh</Text>
          <Text style={styles.value}>{displayDob}</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="call" size={22} color="#007AFF" />
          <Text style={styles.label}>Số điện thoại</Text>
          <Text style={styles.value}>{user.phoneNumber || "Không có số"}</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="mail" size={22} color="#007AFF" />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.gmail || "Chưa liên kết"}</Text>
        </View>
      </View>
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
    justifyContent: "space-between",
  },
  backButton: {
    marginRight: 15,
  },
  chatButton: {
    marginLeft: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    flex: 1,
    textAlign: "center",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});