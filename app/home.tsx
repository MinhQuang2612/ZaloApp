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
import { getAccessToken } from "../services/auth"; // Import hàm getAccessToken

type HomeMessage = {
  senderID: string;
  context: string;
  createdAt: string;
  unread?: boolean;
  messageID?: string;
  messageTypeID?: string;
};

export default function Home() {
  const [messages, setMessages] = useState<HomeMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  const determineMessageType = (message: HomeMessage): string => {
    return message.messageTypeID || "type1";
  };

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
      case "type5":
        return "Đã gửi file";
      default:
        return "Tin nhắn không xác định";
    }
  };

  // Hàm chọn đường dẫn uploads dựa trên máy
  const getUploadsPath = (): string => {
    const machine = process.env.EXPO_PUBLIC_MACHINE || "MACHINE_1";
    if (machine === "MACHINE_1") {
      return process.env.EXPO_PUBLIC_UPLOADS_PATH_MACHINE_1 || "";
    } else if (machine === "MACHINE_2") {
      return process.env.EXPO_PUBLIC_UPLOADS_PATH_MACHINE_2 || "";
    }
    return process.env.EXPO_PUBLIC_UPLOADS_PATH || "";
  };

  const convertFilePathToURL = (context: string): string => {
    const uploadsPath = getUploadsPath();
    if (context && context.startsWith(uploadsPath)) {
      const fileName = context.split("\\").pop();
      return `${process.env.EXPO_PUBLIC_API_URL}/uploads/${fileName}`;
    }
    return context;
  };

  const loadMessages = async (userID: string) => {
    try {
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
          const updatedContext = convertFilePathToURL(latestMessage.context);
          allMessages.push({
            senderID: latestMessage.senderID === userID ? latestMessage.receiverID : latestMessage.senderID,
            context: updatedContext,
            createdAt: latestMessage.createdAt,
            messageID: latestMessage.messageID,
            messageTypeID: latestMessage.messageTypeID,
            unread: latestMessage.receiverID === userID && !latestMessage.seenStatus?.includes(userID),
          });
        }
      }

      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(allMessages);
    } catch (error) {
      console.error("Lỗi khi tải tin nhắn:", error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);

      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        console.error("Không tìm thấy user trong AsyncStorage");
        router.replace("/login");
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      const userID = user.userID;
      if (!userID) {
        console.error("userID không hợp lệ trong userData:", user);
        router.replace("/login");
        setLoading(false);
        return;
      }
      setCurrentUserID(userID);

      await loadMessages(userID);

      // Lấy accessToken từ AsyncStorage
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.error("Không tìm thấy accessToken, chuyển hướng về login");
        router.replace("/login");
        setLoading(false);
        return;
      }

      const newSocket = io(process.env.EXPO_PUBLIC_API_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        auth: {
          token: accessToken, // Gửi accessToken để xác thực
        },
      });
      setSocket(newSocket);

      const joinRooms = () => {
        console.log("Joining room with userID:", userID);
        newSocket.emit("joinUserRoom", userID);
        console.log(`Joined room ${userID}`);
      };

      newSocket.on("connect", () => {
        console.log("Socket connected:", newSocket.id);
        joinRooms();
      });

      newSocket.on("reconnect", (attempt) => {
        console.log("Socket reconnected after attempt:", attempt);
        joinRooms();
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message);
        if (error.message === "Authentication error" || error.message === "Invalid token") {
          router.replace("/login");
        }
      });

      newSocket.on("reconnect_error", (error) => {
        console.error("Socket reconnect error:", error.message);
      });

      newSocket.on("receiveMessage", (message: Message) => {
        console.log("Home.tsx: Received new message via socket:", message);
        if (message.receiverID === userID || message.senderID === userID) {
          setMessages((prev) => {
            const senderID = message.senderID === userID ? message.receiverID : message.senderID;
            const updatedContext = convertFilePathToURL(message.context);
            const newMessage: HomeMessage = {
              senderID,
              context: updatedContext,
              createdAt: message.createdAt,
              messageID: message.messageID,
              messageTypeID: message.messageTypeID,
              unread: message.receiverID === userID && !message.seenStatus?.includes(userID),
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
            } else {
              const updatedMessages = [newMessage, ...prev].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              console.log("Home.tsx: Updated messages (added):", updatedMessages);
              return updatedMessages;
            }
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

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
      });

      setLoading(false);

      return () => {
        newSocket.off("connect");
        newSocket.off("reconnect");
        newSocket.off("connect_error");
        newSocket.off("reconnect_error");
        newSocket.off("receiveMessage");
        newSocket.off("updateSingleChatSeenStatus");
        newSocket.off("disconnect");
        newSocket.disconnect();
      };
    };

    initializeData();
  }, []);

  const onRefresh = async () => {
    if (!currentUserID) return;
    setRefreshing(true);
    await loadMessages(currentUserID);
    setRefreshing(false);
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
    item: { senderID: string; context: string; createdAt: string; messageID?: string; messageTypeID?: string; unread?: boolean };
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
        <View style={[styles.emptyContainer, { zIndex: 500 }]}>
          <Text style={styles.emptyText}>Không có tin nhắn nào để hiển thị.</Text>
        </View>
      ) : (
        <FlatList
          style={{ zIndex: 500 }}
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