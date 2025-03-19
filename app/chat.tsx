import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { fetchMessages, sendMessage, Message } from "../services/message";
import { fetchUserByID } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Định nghĩa kiểu cho response từ socket
type SocketResponse =
  | "đang gửi"
  | "đã nhận"
  | "tin nhắn đã tồn tại"
  | "không tìm thấy tin nhắn"
  | "User đã tồn tại trong seenStatus"
  | "Đã cập nhật seenStatus chat đơn"
  | "Đã cập nhật seenStatus chat nhóm"
  | string;

export default function Chat() {
  const { userID } = useLocalSearchParams<{ userID?: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string>("Đang tải...");
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [markedAsSeen, setMarkedAsSeen] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const initializeSocketAndData = async () => {
      setLoading(true);

      const userData = await AsyncStorage.getItem("user");
      console.log("User data from AsyncStorage in Chat:", userData);
      if (!userData) {
        console.error("Không tìm thấy user trong AsyncStorage");
        router.replace("/login");
        return;
      }

      const user = JSON.parse(userData);
      const userIDValue = user.userID;
      if (!userIDValue) {
        console.error("userID không hợp lệ trong userData:", user);
        router.replace("/login");
        return;
      }
      setCurrentUserID(userIDValue);

      if (!userID) {
        console.error("userID không hợp lệ:", userID);
        return;
      }

      try {
        const receiverData = await fetchUserByID(userID);
        setReceiverName(receiverData?.username || "Người dùng chưa xác định");
      } catch (error) {
        console.error("Lỗi khi lấy thông tin người dùng:", error);
        setReceiverName("Người dùng chưa xác định");
      }

      try {
        const data = await fetchMessages(userID);
        console.log("Messages loaded:", data);
        setMessages(data);
      } catch (error) {
        console.error("Lỗi khi lấy tin nhắn:", error);
      }

      if (!userIDValue) {
        console.error("(NOBRIDGE) ERROR currentUserID không hợp lệ:", userIDValue);
        router.replace("/login");
        setLoading(false);
        return;
      }

      const newSocket = io("http://192.168.2.158:3000");
      setSocket(newSocket);

      newSocket.emit("joinUserRoom", userIDValue);

      newSocket.on("receiveTextMessage", (message: Message) => {
        console.log("Chat.tsx: Received new message via socket:", message);
        if (
          (message.senderID === userID && message.receiverID === userIDValue) ||
          (message.senderID === userIDValue && message.receiverID === userID)
        ) {
          setMessages((prev) => {
            if (prev.some((msg) => msg.messageID === message.messageID)) return prev;
            const updatedMessages = [...prev, message];
            console.log("Chat.tsx: Updated messages:", updatedMessages);
            return updatedMessages;
          });
        }
      });

      newSocket.on("updateSingleChatSeenStatus", (messageID: string) => {
        console.log(`Chat.tsx: Received updateSingleChatSeenStatus for messageID: ${messageID}`);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageID === messageID
              ? { ...msg, seenStatus: [...(msg.seenStatus || []), userID!] }
              : msg
          )
        );
        setMarkedAsSeen((prev) => new Set(prev).add(messageID));
      });

      newSocket.on("reloadMessage", async () => {
        const data = await fetchMessages(userID);
        setMessages(data);
      });

      setLoading(false);

      return () => {
        newSocket.disconnect();
      };
    };

    initializeSocketAndData();
  }, [userID]);

  useEffect(() => {
    if (currentUserID && socket && messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) => msg.receiverID === currentUserID && !msg.seenStatus?.includes(currentUserID) && !markedAsSeen.has(msg.messageID!)
      );
      console.log("Unread messages to mark as seen:", unreadMessages);
      unreadMessages.forEach((msg) => {
        socket.emit("seenMessage", msg.messageID, currentUserID, (response: SocketResponse) => {
          console.log("Seen response:", response);
          if (response === "Đã cập nhật seenStatus chat đơn") {
            setMarkedAsSeen((prev) => new Set(prev).add(msg.messageID!));
          }
        });
      });
    }
  }, [messages, currentUserID, socket]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !userID || !currentUserID || !socket) return;

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type1",
      context: inputText,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      // Không cần gán groupID vì nó là tùy chọn và không sử dụng
    };

    setMessages((prev) => {
      const updatedMessages = [...prev, newMessage];
      console.log("Chat.tsx: Added new message locally:", updatedMessages);
      return updatedMessages;
    });
    setInputText("");

    socket.emit("sendTextMessage", newMessage, async (response: SocketResponse) => {
      console.log("Server response:", response);
      if (response !== "đã nhận") {
        setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      } else {
        await sendMessage({
          senderID: currentUserID,
          receiverID: userID,
          context: inputText,
          messageTypeID: "type1",
          messageID,
        }).catch((error) => {
          console.error("Lỗi đồng bộ API:", error);
        });
      }
    });
  };

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.username}>{receiverName}</Text>
        <TouchableOpacity>
          <Ionicons name="call-outline" size={24} color="#fff" style={{ marginRight: 18 }} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="videocam-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.messageID || item.createdAt}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageContainer,
              item.senderID === currentUserID ? styles.myMessage : styles.otherMessage,
            ]}
          >
            {item.senderID !== currentUserID && (
              <Image source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }} style={styles.avatar} />
            )}
            <View style={styles.messageBox}>
              {item.messageTypeID === "type1" && <Text style={styles.messageText}>{item.context}</Text>}
              {item.senderID === currentUserID && (
                <Text style={styles.seenText}>
                  {item.seenStatus?.includes(userID!) ? "Đã xem" : "Đã gửi"}
                </Text>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 10 }}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity>
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Tin nhắn"
          value={inputText}
          onChangeText={(text) => setInputText(text)}
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
  seenText: { fontSize: 12, color: "#666", textAlign: "right" },
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