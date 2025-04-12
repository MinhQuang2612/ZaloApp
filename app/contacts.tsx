import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchContacts, Contact, deleteContact } from "../services/contacts";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function Contacts() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userID, setUserID] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "groups" | "oa">("friends");

  const loadContacts = useCallback(async () => {
    if (!userID) return;
    try {
      setLoading(true);
      const data = await fetchContacts(userID);
      setContacts(data);
    } catch (error) {
      console.error("Lỗi khi tải danh bạ:", error);
      Alert.alert("Lỗi", "Không thể tải danh bạ.");
    } finally {
      setLoading(false);
    }
  }, [userID]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (!userData) {
          Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
          router.push("/login");
          return;
        }
        const user = JSON.parse(userData);
        setUserID(user.userID);
      } catch (error) {
        Alert.alert("Lỗi", "Không thể tải thông tin người dùng.");
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Xử lý khi có user mới được thêm
  useEffect(() => {
    if (params.newContact) {
      const newContact: Contact = JSON.parse(params.newContact as string);
      setContacts((prevContacts) => {
        // Kiểm tra xem user đã tồn tại trong danh sách chưa
        if (prevContacts.some((contact) => contact.userID === newContact.userID)) {
          return prevContacts;
        }
        return [newContact, ...prevContacts];
      });
    }
  }, [params.newContact]);

  const handleDeleteContact = async (contactID: string) => {
    if (!userID) return;
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn xóa liên hệ này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const message = await deleteContact(userID, contactID);
              Alert.alert("Thành công", message);
              loadContacts();
            } catch (error: any) {
              Alert.alert("Lỗi", error.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <View style={styles.contactItem}>
      <TouchableOpacity
        style={styles.contactMain}
        onPress={() =>
          router.push({
            pathname: "/single_chat",
            params: { userID: item.userID },
          })
        }
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.contactInfo}>
          <Text style={styles.name}>{item.username}</Text>
          <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.contactActions}>
        <TouchableOpacity>
          <Ionicons name="call-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="videocam-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteContact(item.userID)}>
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
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
    <View style={styles.container}>
      <Navbar showSearch showAdd addIconType="person-add-outline" />
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "friends" && styles.activeTab]}
          onPress={() => setActiveTab("friends")}
        >
          <Text style={[styles.tabText, activeTab === "friends" && styles.activeTabText]}>Bạn bè</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "groups" && styles.activeTab]}
          onPress={() => setActiveTab("groups")}
        >
          <Text style={[styles.tabText, activeTab === "groups" && styles.activeTabText]}>Nhóm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "oa" && styles.activeTab]}
          onPress={() => setActiveTab("oa")}
        >
          <Text style={[styles.tabText, activeTab === "oa" && styles.activeTabText]}>OA</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoryList}>
        <TouchableOpacity style={styles.categoryItem}>
          <Ionicons name="person-add" size={24} color="#007AFF" />
          <Text style={styles.categoryText}>Lời mời kết bạn (8)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryItem}>
          <Ionicons name="book-outline" size={24} color="#007AFF" />
          <View>
            <Text style={styles.categoryText}>Danh bạ máy</Text>
            <Text style={styles.categorySubText}>Các liên hệ có dùng Zalo</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryItem}>
          <Ionicons name="gift-outline" size={24} color="#007AFF" />
          <Text style={styles.categoryText}>Sinh nhật</Text>
        </TouchableOpacity>
      </View>
      {contacts.length === 0 ? (
        <Text style={styles.noContacts}>Bạn chưa có liên hệ nào.</Text>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.userID}
          renderItem={renderItem}
          style={styles.list}
        />
      )}
      <View style={styles.footer}>
        <Footer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tab: {
    paddingVertical: 12,
    flex: 1,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#007AFF",
  },
  tabText: {
    fontSize: 16,
    color: "#666",
  },
  activeTabText: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  categoryList: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  categoryText: {
    fontSize: 16,
    marginLeft: 10,
    color: "#000",
  },
  categorySubText: {
    fontSize: 14,
    color: "#888",
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
  contactMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
  contactActions: {
    flexDirection: "row",
    gap: 15,
  },
  noContacts: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    backgroundColor: "#fff",
    zIndex: 1000,
  },
});