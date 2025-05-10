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
import { createGroup, fetchGroupMembers } from "../services/group";
import { fetchContacts, Contact } from "../services/contacts";
import { addGroupMember } from "../services/socket";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";

export default function CreateGroup() {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
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
        setFilteredContacts(contactsData);
      } catch (error) {
        console.error("Lỗi khi tải danh bạ:", error);
        Alert.alert("Lỗi", "Không thể tải danh bạ.");
      }
    };

    loadContacts();
  }, []);

  useEffect(() => {
    const filtered = contacts.filter((contact) =>
      contact.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

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

    if (selectedMembers.length === 0) {
      Alert.alert("Lỗi", "Vui lòng chọn ít nhất một thành viên.");
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem("user");
      const user = userData ? JSON.parse(userData) : null;
      const userID = user?.userID;
      const username = user?.username || userID;
      if (!userID) {
        Alert.alert("Lỗi", "Không tìm thấy userID.");
        router.replace("/login");
        return;
      }

      // Tạo nhóm
      const newGroup = await createGroup({ groupName, userID });
      const groupID = newGroup.groupID;
      console.log(`Đã tạo nhóm ${groupID} với tên ${groupName}`);

      // Thêm thành viên
      let failedMembers: string[] = [];
      for (const memberID of selectedMembers) {
        if (memberID !== userID) {
          try {
            const response = await addGroupMember(memberID, groupID);
            console.log(`Đã thêm thành viên ${memberID}: ${response}`);
          } catch (error: any) {
            if (error.message === "user đã là thành viên của nhóm này") {
              console.log(`Thành viên ${memberID} đã là thành viên, bỏ qua.`);
            } else {
              failedMembers.push(memberID);
              console.warn(`Không thể thêm thành viên ${memberID}: ${error.message}`);
            }
          }
        }
      }

      // Lấy danh sách thành viên
      let members: any[] = [];
      let memberCount = 0;
      try {
        members = await fetchGroupMembers(groupID);
        memberCount = members.length;
      } catch (error) {
        console.error("Lỗi khi lấy thành viên nhóm, thử lấy từ API /api/group:", error);
        const allGroupsResponse = await api.get(`/api/group`);
        const allGroups = allGroupsResponse.data.data || [];
        const groupDetail = allGroups.find((g: { groupID: string }) => g.groupID === groupID);
        memberCount = groupDetail?.totalMembers || selectedMembers.length + 1; // +1 cho người tạo
      }
      console.log(`Nhóm ${groupID} có ${memberCount} thành viên:`, members);

      // Hiển thị danh sách thành viên trong thông báo
      let memberNames = "Không lấy được danh sách thành viên.";
      if (members.length > 0) {
        // Lấy tên cho từng thành viên, nếu không có trong contacts thì gọi API
        const getMemberName = async (memberID: string) => {
          if (memberID === userID && username) return username;
          const contact = contacts.find((c) => c.userID === memberID);
          if (contact) return contact.username;
          try {
            const res = await api.get(`/api/user/${memberID}`);
            return res.data.username || memberID;
          } catch {
            return memberID;
          }
        };
        // Đợi lấy tên cho tất cả thành viên
        const names = await Promise.all(members.map((m: { userID: string }) => getMemberName(m.userID)));
        memberNames = names.join(", ");
      }

      if (failedMembers.length > 0) {
        const failedNames = failedMembers
          .map((id) => contacts.find((c) => c.userID === id)?.username || id)
          .join(", ");
        Alert.alert(
          "Cảnh báo",
          `Nhóm đã được tạo với ${memberCount} thành viên: ${memberNames}. Không thể thêm: ${failedNames}.`
        );
      } else {
        Alert.alert(
          "Thành công",
          `Nhóm đã được tạo với ${memberCount} thành viên: ${memberNames}!`
        );
      }
      router.replace("/home");
    } catch (error: any) {
      console.error("Lỗi khi tạo nhóm:", error);
      Alert.alert("Lỗi", error.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
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
          paddingBottom: insets.bottom || 8,
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
        <Text style={styles.label}>Tìm kiếm thành viên</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập tên để tìm kiếm"
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={!loading}
        />
        <Text style={styles.label}>Chọn thành viên</Text>
        <Text style={styles.selectedCount}>Đã chọn: {selectedMembers.length}</Text>
        {filteredContacts.length === 0 ? (
          <Text style={styles.noContacts}>
            {searchQuery ? "Không tìm thấy thành viên." : "Không có danh bạ."}
          </Text>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.userID}
            style={styles.contactList}
          />
        )}
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
  contactList: { flex: 1, marginBottom: 20 },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  contactName: { flex: 1, fontSize: 16 },
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
  checkmark: { color: "#fff", fontSize: 16 },
  createButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  createButtonDisabled: { backgroundColor: "#99C2FF" },
  createButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  noContacts: { fontSize: 16, color: "#666", textAlign: "center", marginTop: 20 },
  selectedCount: { fontSize: 14, color: "#666", marginBottom: 10 },
});