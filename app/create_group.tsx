import { useState, useEffect } from "react";
import {
  View,
  Text,
  Platform,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createGroup } from "../services/group";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CreateGroup() {
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên nhóm.");
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng.");
        router.replace("/login");
        return;
      }

      const user = JSON.parse(userData);
      const userID = user.userID;
      if (!userID) {
        Alert.alert("Lỗi", "Không tìm thấy userID.");
        router.replace("/login");
        return;
      }

      const response = await createGroup({ groupName, userID });
      console.log("Create group response:", response);

      // Sửa điều kiện để khớp với message từ backend
      if (response.message.toLowerCase() === "tạo group thành công" || response.success) {
        Alert.alert("Thành công", "Nhóm đã được tạo thành công!");
        router.replace("/home");
      } else {
        Alert.alert("Lỗi", response.message || "Không thể tạo nhóm. Vui lòng thử lại.");
      }
    } catch (error: any) {
      console.error("Lỗi khi tạo nhóm:", error);
      Alert.alert("Lỗi", error.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

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
        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo nhóm</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Tên nhóm</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập tên nhóm"
          value={groupName}
          onChangeText={setGroupName}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.createButton, loading ? styles.createButtonDisabled : {}]}
          onPress={handleCreateGroup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Tạo nhóm</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "bold", marginLeft: 10 },
  content: { padding: 20, flex: 1 },
  label: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  createButtonDisabled: {
    backgroundColor: "#99C2FF",
  },
  createButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});