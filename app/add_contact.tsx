import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAllUsers, fetchContacts, addContact, Contact } from "../services/contacts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AddContact() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState<Contact[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Contact[]>([]);
  const [currentContacts, setCurrentContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [userID, setUserID] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (!userData) {
          Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
          router.push("/login");
          return;
        }
        const user = JSON.parse(userData);
        setUserID(user.userID);

        const contacts = await fetchContacts(user.userID);
        setCurrentContacts(contacts);

        const users = await fetchAllUsers();
        const nonFriends = users.filter(
          (u) => u.userID !== user.userID && !contacts.some((c) => c.userID === u.userID)
        );
        setAllUsers(nonFriends);
        setFilteredUsers(nonFriends);
      } catch (error: any) {
        Alert.alert("Lỗi", error.message || "Không thể tải dữ liệu.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === "") {
      setFilteredUsers(allUsers);
    } else {
      const filtered = allUsers.filter(
        (user) =>
          user.username.toLowerCase().includes(text.toLowerCase()) ||
          (user.phoneNumber && user.phoneNumber.includes(text))
      );
      setFilteredUsers(filtered);
    }
  };

  const handleAddContact = async (contact: Contact) => {
    if (!userID) return;
    try {
      const message = await addContact(userID, contact.userID);
      Alert.alert("Thành công", message, [
        {
          text: "OK",
          onPress: () =>
            router.push({
              pathname: "/contacts",
              params: {
                newContact: JSON.stringify(contact), // Truyền thông tin user vừa thêm
              },
            }),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Lỗi", error.message);
    }
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <View style={styles.contactItem}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.contactInfo}>
        <Text style={styles.name}>{item.username}</Text>
        <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleAddContact(item)}
      >
        <Text style={styles.addButtonText}>Thêm</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Thêm bạn</Text>
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm theo tên hoặc số điện thoại"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>
      {filteredUsers.length === 0 ? (
        <Text style={styles.noResults}>Không tìm thấy người dùng.</Text>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.userID}
          renderItem={renderItem}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
    marginLeft: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    marginHorizontal: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
  },
  list: {
    flex: 1,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  contactInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
  },
  phoneNumber: {
    fontSize: 14,
    color: "#555",
  },
  addButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  noResults: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});