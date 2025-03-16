import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { fetchContacts, Contact } from "../services/contacts";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function Contacts() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"friends" | "groups" | "oa">("friends");

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await fetchContacts();
        setContacts(data);
      } catch (error) {
        console.error("Lỗi khi tải danh bạ:", error);
      }
      setLoading(false);
    };

    loadContacts();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Hàm render danh sách liên hệ
  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={() => router.push({
        pathname: "/chat",
        params: { userID: item.userID }, // Truyền userID qua params
      })}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.contactInfo}>
        <Text style={styles.name}>{item.username}</Text>
        <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity>
          <Ionicons name="call-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="videocam-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Navbar showSearch showAdd addIconType="person-add-outline" />
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === "friends" && styles.activeTab]} onPress={() => setActiveTab("friends")}>
          <Text style={[styles.tabText, activeTab === "friends" && styles.activeTabText]}>Bạn bè</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "groups" && styles.activeTab]} onPress={() => setActiveTab("groups")}>
          <Text style={[styles.tabText, activeTab === "groups" && styles.activeTabText]}>Nhóm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "oa" && styles.activeTab]} onPress={() => setActiveTab("oa")}>
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
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.userID}
        renderItem={renderItem}
        style={styles.list}
      />
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabs: { flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  tab: { paddingVertical: 12, flex: 1, alignItems: "center" },
  activeTab: { borderBottomWidth: 2, borderBottomColor: "#007AFF" },
  tabText: { fontSize: 16, color: "#666" },
  activeTabText: { color: "#007AFF", fontWeight: "bold" },
  categoryList: { paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  categoryItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  categoryText: { fontSize: 16, marginLeft: 10, color: "#000" },
  categorySubText: { fontSize: 14, color: "#888", marginLeft: 10 },
  list: { flex: 1 },
  contactItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  contactInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: "bold" },
  phoneNumber: { fontSize: 14, color: "#555" },
  contactActions: { flexDirection: "row", gap: 15 },
});