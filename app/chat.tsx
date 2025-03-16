import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchMessages, sendMessage, Message } from "../services/message";
import { fetchUserByID } from "../services/contacts"; // Thêm API lấy user từ ID
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Chat() {
  const { userID } = useLocalSearchParams<{ userID?: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string>("Đang tải..."); // ✅ Tạo state lưu tên người nhận
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserAndMessages = async () => {
      setLoading(true);
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUserID(user.userID);
      }

      if (!userID) {
        console.error("userID không hợp lệ hoặc không được cung cấp:", userID);
        return;
      }

      // ✅ Lấy tên của user từ API
      try {
        const receiverData = await fetchUserByID(userID);
        if (receiverData && receiverData.username) {
          setReceiverName(receiverData.username);
        } else {
          setReceiverName("Người dùng chưa xác định");
        }
      } catch (error) {
        console.error("Lỗi khi lấy thông tin người dùng:", error);
        setReceiverName("Người dùng chưa xác định");
      }

      // ✅ Lấy tin nhắn từ API
      try {
        const data = await fetchMessages(userID);
        setMessages(data);
      } catch (error) {
        console.error("Lỗi khi lấy tin nhắn:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUserAndMessages();
  }, [userID]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !userID || !currentUserID) return;

    const newMessage = {
      receiverID: userID,
      context: inputText,
      messageTypeID: "type1",
    };

    setMessages((prev) => [...prev, { ...newMessage, senderID: currentUserID, createdAt: new Date().toISOString() }]);
    setInputText("");

    await sendMessage(newMessage);
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
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.username}>{receiverName}</Text> {/* ✅ Hiển thị tên người dùng */}
        <TouchableOpacity>
          <Ionicons name="call-outline" size={24} color="#fff" style={{ marginRight: 18 }}/>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="videocam-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Danh sách tin nhắn */}
      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={[styles.messageContainer, item.senderID === currentUserID ? styles.myMessage : styles.otherMessage]}>
            {item.senderID !== currentUserID && (
              <Image source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }} style={styles.avatar} />
            )}
            <View style={styles.messageBox}>
              {item.messageTypeID === "type1" && <Text style={styles.messageText}>{item.context}</Text>}
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 10 }}
      />

      {/* Ô nhập tin nhắn */}
      <View style={styles.inputContainer}>
        <TouchableOpacity>
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Tin nhắn"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity onPress={handleSendMessage}>
          <Ionicons name="send" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  username: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "bold", marginLeft: 10 },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  myMessage: { justifyContent: "flex-end", alignSelf: "flex-end" },
  otherMessage: { justifyContent: "flex-start", alignSelf: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  messageBox: { backgroundColor: "#fff", padding: 10, borderRadius: 10 },
  messageText: { fontSize: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  input: { flex: 1, fontSize: 16, marginHorizontal: 10 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});

