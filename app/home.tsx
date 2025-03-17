import { useEffect, useState } from "react";
import { View, FlatList, StyleSheet, Image, TouchableOpacity, Text, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchMessages, Message } from "../services/message";
import { fetchContacts, Contact } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Home() {
  const [messages, setMessages] = useState<{ senderID: string; context: string; createdAt: string }[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);

  const loadMessages = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        console.error("Không tìm thấy user trong AsyncStorage");
        throw new Error("Không tìm thấy user");
      }

      const user = JSON.parse(userData);
      const userID = user.userID;
      setCurrentUserID(userID);
      console.log("Current User ID:", userID);

      const contactsData = await fetchContacts();
      setContacts(contactsData);

      if (!contactsData || contactsData.length === 0) {
        console.warn("Không có danh sách contacts");
        setMessages([]);
        return;
      }

      const allMessages: { senderID: string; context: string; createdAt: string }[] = [];
      for (const contact of contactsData) {
        const contactMessages = await fetchMessages(contact.userID);
        console.log(`Messages for ${contact.userID}:`, contactMessages);

        const relevantMessages = contactMessages.filter(
          (msg) => msg.senderID === userID || msg.receiverID === userID
        );

        const latestMessage = relevantMessages.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        if (latestMessage) {
          allMessages.push({
            senderID: latestMessage.senderID === userID ? latestMessage.receiverID : latestMessage.senderID,
            context: latestMessage.context,
            createdAt: latestMessage.createdAt,
          });
        }
      }

      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log("Final Messages:", allMessages);
      setMessages(allMessages);
    } catch (error) {
      console.error("Lỗi khi tải tin nhắn:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const getUserName = (userID: string) => {
    if (!contacts.length) return "Đang tải...";
    const user = contacts.find((contact) => contact.userID === userID);
    return user?.username || "Không xác định";
  };
  

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: { senderID: string; context: string; createdAt: string } }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push({ pathname: "/chat", params: { userID: item.senderID } })}
    >
      <Image source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }} style={styles.avatar} />
      <View style={styles.messageContent}>
        <Text style={styles.name}>{getUserName(item.senderID).toString()}</Text> {/* ✅ Hiển thị đúng tên */}
        <Text style={styles.message}>{item.context ? item.context.toString() : "Không có nội dung"}</Text>
      </View>
      <Text style={styles.time}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Navbar showSearch showQR showAdd addIconType="add" />

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không có tin nhắn nào để hiển thị.</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#666" },
  item: { flexDirection: "row", alignItems: "center", padding: 15, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  messageContent: { flex: 1, marginLeft: 10 },
  name: { fontSize: 16, fontWeight: "bold" },
  message: { fontSize: 14, color: "#666" },
  time: { fontSize: 12, color: "#999" },
});
