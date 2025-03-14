import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import { getCurrentUser } from "../services/auth";
import { updateProfile } from "../services/profile";

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

  // State để chỉnh sửa
  const [username, setUsername] = useState<string>("");
  const [dob, setDob] = useState<string>("");

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getCurrentUser();
      if (!userData) {
        router.replace("/login");
      } else {
        setUser(userData);
        setUsername(userData.username);
        setDob(userData.DOB);
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  // Xử lý cập nhật thông tin
  const handleSave = async () => {
    if (!user) return;
  
    try {
      const updatedUser = await updateProfile(username, dob);
      setUser(updatedUser); // Cập nhật UI
      setIsEditing(false);
      Alert.alert("Thành công", "Thông tin cá nhân đã được cập nhật.");
    } catch (error: any) {
      Alert.alert("Lỗi", error);
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
    <View style={styles.container}>
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
            <TextInput
              style={styles.input}
              value={dob}
              onChangeText={setDob}
              placeholder="DD/MM/YYYY"
            />
          ) : (
            <Text style={styles.value}>{user?.DOB || "Chưa cập nhật"}</Text>
          )}
        </View>

        {/* Số điện thoại (Không chỉnh sửa) */}
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

