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
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createGroup } from "../services/group";
import { fetchContacts, Contact } from "../services/contacts";
import { addGroupMember } from "../services/socket";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CreateGroup() {
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadContacts = async () => {
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

        const contactsData = await fetchContacts(userID);
        setContacts(contactsData);
      } catch (error) {
        console.error("Lỗi khi tải danh bạ:", error);
        Alert.alert("Lỗi", "Không thể tải danh bạ.");
      }
    };

    loadContacts();
  }, []);

  const toggleMember = (userID: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userID) ? prev.filter((id) => id !== userID) : [...prev, userID]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên nhóm.");
      return;
    }

    if (!selectedMembers.length) {
      Alert.alert("Lỗi", "Vui lòng chọn ít nhất một thành viên.");
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

      const newGroup = await createGroup({ groupName, userID });

      // Thêm các thành viên được chọn vào nhóm
      for (const memberID of selectedMembers) {
        await addGroupMember(memberID, newGroup.groupID);
      }

      Alert.alert("Thành công", "Nhóm đã được tạo thành công!");
      router.replace("/home");
    } catch (error: any) {
      console.error("Lỗi khi tạo nhóm:", error);
      // Bỏ qua lỗi "user đã là thành viên của nhóm này"
      if (error.message === "user đã là thành viên của nhóm này") {
        Alert.alert("Thành công", "Nhóm đã được tạo thành công!");
        router.replace("/home");
      } else {
        Alert.alert("Lỗi", error.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => toggleMember(item.userID)}
      disabled={loading}
    >
      <Text style={styles.contactName}>{item.username}</Text>
      <View
        style={[
          styles.checkbox,
          selectedMembers.includes(item.userID) && styles.checkboxSelected,
        ]}
      >
        {selectedMembers.includes(item.userID) && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.label}>Chọn thành viên</Text>
        <FlatList
          data={contacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.userID}
          style={styles.contactList}
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
  contactList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  contactName: {
    flex: 1,
    fontSize: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#007AFF",
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
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