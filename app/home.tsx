import { useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { io, Socket } from "socket.io-client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchMessages, Message } from "../services/message";
import { fetchContacts, Contact } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EventRegister } from "react-native-event-listeners";

// Định nghĩa kiểu cho message trong Home
type HomeMessage = {
  senderID: string;
  context: string;
  createdAt: string;
  unread?: boolean;
  messageID?: string;
  messageTypeID?: string; // Thêm trường này để xác định loại tin nhắn
};

export default function Home() {
  const [messages, setMessages] = useState<HomeMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  // Hàm xác định loại tin nhắn dựa trên context
  const determineMessageType = (message: HomeMessage): string => {
    const { context, messageTypeID } = message;

    if (context.startsWith("https://media") && context.includes("giphy.com")) {
      return "type4";
    }
    if (context.startsWith("data:image/")) {
      return "type2";
    }
    if (context.match(/\.(mp4|mov|avi)$/i)) {
      return "type3";
    }
    return messageTypeID || "type1";
  };

  // Hàm trả về nội dung hiển thị trong trang Home
  const getMessagePreview = (message: HomeMessage): string => {
    const effectiveType = determineMessageType(message);

    switch (effectiveType) {
      case "type1":
        return message.context.length > 50
          ? message.context.substring(0, 50) + "..."
          : message.context;
      case "type2":
        return "Đã gửi ảnh";
      case "type3":
        return "Đã gửi video";
      case "type4":
        return "Đã gửi sticker";
      default:
        return "Tin nhắn không xác định";
    }
  };

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

      const contactsData = await fetchContacts();
      setContacts(contactsData);

      if (!contactsData || contactsData.length === 0) {
        setMessages([]);
        return;
      }

      const allMessages: HomeMessage[] = [];
      const seenMessageIDs = new Set<string>();

      for (const contact of contactsData) {
        const contactMessages = await fetchMessages(contact.userID);
        const relevantMessages = contactMessages.filter(
          (msg) => msg.senderID === userID || msg.receiverID === userID
        );

        const latestMessage = relevantMessages.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        if (latestMessage && !seenMessageIDs.has(latestMessage.messageID!)) {
          seenMessageIDs.add(latestMessage.messageID!);
          allMessages.push({
            senderID: latestMessage.senderID === userID ? latestMessage.receiverID : latestMessage.senderID,
            context: latestMessage.context,
            createdAt: latestMessage.createdAt,
            messageID: latestMessage.messageID,
            messageTypeID: latestMessage.messageTypeID, // Lưu messageTypeID
            unread: latestMessage.receiverID === userID && !latestMessage.seenStatus?.includes(userID),
          });
        }
      }

      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(allMessages);
    } catch (error) {
      console.error("Lỗi khi tải tin nhắn:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initializeSocket = async () => {
      await loadMessages();

      if (!currentUserID) {
        //console.error("currentUserID không hợp lệ:", currentUserID);
        return;
      }

      const newSocket = io("http://172.20.34.14:3000");
      setSocket(newSocket);

      newSocket.emit("joinUserRoom", currentUserID);

      newSocket.on("receiveTextMessage", (message: Message) => {
        console.log("Home.tsx: Received new message via socket:", message);
        if (message.receiverID === currentUserID || message.senderID === currentUserID) {
          setMessages((prev) => {
            const senderID = message.senderID === currentUserID ? message.receiverID : message.senderID;
            const newMessage: HomeMessage = {
              senderID,
              context: message.context,
              createdAt: message.createdAt,
              messageID: message.messageID,
              messageTypeID: message.messageTypeID, // Lưu messageTypeID
              unread: message.receiverID === currentUserID && !message.seenStatus?.includes(currentUserID),
            };

            console.log("Home.tsx: New message processed:", newMessage, "Unread:", newMessage.unread);

            const existingIndex = prev.findIndex((msg) => msg.senderID === senderID);

            if (existingIndex >= 0) {
              const updatedMessages = [...prev];
              updatedMessages[existingIndex] = newMessage;
              const sortedMessages = updatedMessages.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              console.log("Home.tsx: Updated messages (replaced):", sortedMessages);
              return sortedMessages;
            }

            const updatedMessages = [newMessage, ...prev].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            console.log("Home.tsx: Updated messages (added):", updatedMessages);
            return updatedMessages;
          });
        }
      });

      newSocket.on("updateSingleChatSeenStatus", (messageID: string) => {
        console.log(`Home.tsx: Received updateSingleChatSeenStatus for messageID: ${messageID}`);
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.messageID === messageID ? { ...msg, unread: false } : msg
          );
          console.log("Home.tsx: Updated messages after seen status:", updatedMessages);
          return updatedMessages;
        });
      });

      const listener = EventRegister.addEventListener("messageSent", () => {
        console.log("Home.tsx: Received messageSent event, reloading messages...");
        loadMessages();
      });

      return () => {
        newSocket.disconnect();
        EventRegister.removeEventListener(listener as string);
      };
    };

    initializeSocket();
  }, [currentUserID]);

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

  const renderItem = ({
    item,
  }: {
    item: { senderID: string; context: string; createdAt: string; unread?: boolean; messageID?: string; messageTypeID?: string };
  }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push({ pathname: "/chat", params: { userID: item.senderID } })}
    >
      <Image source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }} style={styles.avatar} />
      <View style={styles.messageContent}>
        <Text style={styles.name}>{getUserName(item.senderID)}</Text>
        <Text style={styles.message}>{getMessagePreview(item)}</Text>
      </View>
      <View style={styles.rightContainer}>
        <Text style={styles.time}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
        {item.unread && <View style={styles.unreadBadge} />}
      </View>
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
          keyExtractor={(item, index) => `${item.senderID}-${item.createdAt}-${index}`}
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
  rightContainer: { alignItems: "flex-end" },
  unreadBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#007AFF" },
});