import { useState, useEffect } from "react";
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
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchMessages, Message } from "../services/message";
import { fetchContacts, Contact } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket, { connectSocket } from "../services/socket";
import { fetchUserGroups, Group } from "../services/group";

type HomeMessage = {
  senderID: string;
  context: string;
  createdAt: string;
  unread?: boolean;
  messageID?: string;
  messageTypeID?: string;
};

type HomeGroupMessage = {
  groupID: string;
  groupName: string;
  context: string;
  createdAt: string;
  unread?: boolean;
  messageID?: string;
  messageTypeID?: string;
};

type CombinedMessage = {
  type: "single" | "group";
  data: HomeMessage | HomeGroupMessage;
};

export default function Home() {
  const [messages, setMessages] = useState<CombinedMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const router = useRouter();

  const determineMessageType = (message: HomeMessage | HomeGroupMessage): string => {
    return message.messageTypeID || "type1";
  };

  const getMessagePreview = (message: HomeMessage | HomeGroupMessage): string => {
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
    if (context && (context.startsWith("http://") || context.startsWith("https://"))) {
      return context;
    }
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

      const userGroups = await fetchUserGroups(userID);
      console.log("Danh sách nhóm từ loadMessages:", userGroups); // Kiểm tra
      setGroups(userGroups);

      const allMessages: HomeMessage[] = [];
      const allGroupMessages: HomeGroupMessage[] = [];
      const seenMessageIDs = new Set<string>();

      // Load single chat messages
      if (contactsData && contactsData.length > 0) {
        for (const contact of contactsData) {
          const contactMessages = await fetchMessages(contact.userID);
          const relevantMessages = contactMessages.filter(
            (msg) =>
              (msg.senderID === userID || msg.receiverID === userID) &&
              msg.receiverID !== undefined
          );

          const latestMessage = relevantMessages.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          if (latestMessage && !seenMessageIDs.has(latestMessage.messageID!)) {
            seenMessageIDs.add(latestMessage.messageID!);
            const updatedContext =
              latestMessage.messageTypeID === "type2" ||
              latestMessage.messageTypeID === "type3" ||
              latestMessage.messageTypeID === "type5"
                ? convertFilePathToURL(latestMessage.context)
                : latestMessage.context;
            allMessages.push({
              senderID: latestMessage.senderID === userID ? latestMessage.receiverID! : latestMessage.senderID,
              context: updatedContext,
              createdAt: latestMessage.createdAt,
              messageID: latestMessage.messageID,
              messageTypeID: latestMessage.messageTypeID,
              unread: latestMessage.receiverID === userID && !latestMessage.seenStatus?.includes(userID),
            });
          }
        }
      }

      // Load group placeholders (no messages yet)
      if (userGroups && userGroups.length > 0) {
        userGroups.forEach((group) => {
          allGroupMessages.push({
            groupID: group.groupID,
            groupName: group.groupName,
            context: "Nhóm mới được tạo",
            createdAt: new Date().toISOString(),
            unread: false,
          });
        });
      }

      const combinedMessages = [
        ...allMessages.map((msg) => ({ type: "single" as const, data: msg })),
        ...allGroupMessages.map((msg) => ({ type: "group" as const, data: msg })),
      ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

      setMessages(combinedMessages);
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
      setCurrentUserID(userID);

      await loadMessages(userID);

      if (!socket.connected) {
        await connectSocket();
      }

      socket.emit("joinUserRoom", userID);
      console.log("Home.tsx: Đã tham gia phòng người dùng:", userID);

      const userGroups = await fetchUserGroups(userID);
      console.log("Danh sách nhóm từ useEffect:", userGroups); // Kiểm tra
      setGroups(userGroups);

      userGroups.forEach((group) => {
        if (group.groupID) {
          socket.emit("joinGroupRoom", group.groupID);
          console.log("Home.tsx: Đã tham gia phòng nhóm:", group.groupID);
        } else {
          console.warn("Nhóm không có groupID, không thể tham gia phòng:", group);
        }
      });

      socket.on("connect", () => {
        console.log("Home.tsx: Socket đã kết nối:", socket.id);
        socket.emit("joinUserRoom", userID);
        userGroups.forEach((group) => {
          if (group.groupID) {
            socket.emit("joinGroupRoom", group.groupID);
          }
        });
      });

      socket.on("receiveMessage", (message: Message) => {
        console.log("Home.tsx: Nhận được tin nhắn đơn:", message);
        if ((message.receiverID === userID || message.senderID === userID) && message.receiverID !== undefined) {
          setMessages((prev) => {
            const senderID = message.senderID === userID ? message.receiverID! : message.senderID;
            const updatedContext =
              message.messageTypeID === "type2" ||
              message.messageTypeID === "type3" ||
              message.messageTypeID === "type5"
                ? convertFilePathToURL(message.context)
                : message.context;
            const newMessage: HomeMessage = {
              senderID,
              context: updatedContext,
              createdAt: message.createdAt,
              messageID: message.messageID,
              messageTypeID: message.messageTypeID,
              unread: message.receiverID === userID && !message.seenStatus?.includes(userID),
            };

            const existingIndex = prev.findIndex(
              (msg) => msg.type === "single" && (msg.data as HomeMessage).senderID === senderID
            );
            const updatedMessages = [...prev];
            if (existingIndex >= 0) {
              updatedMessages[existingIndex] = { type: "single", data: newMessage };
            } else {
              updatedMessages.push({ type: "single", data: newMessage });
            }
            return updatedMessages.sort(
              (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
            );
          });
        }
      });

      socket.on("receiveGroupMessage", async (message: Message) => {
        console.log("Home.tsx: Nhận được tin nhắn nhóm:", message);
        if (message.groupID) {
          // Nếu không tìm thấy nhóm, làm mới danh sách nhóm
          let group = groups.find((g) => g.groupID === message.groupID);
          if (!group && currentUserID) {
            const updatedGroups = await fetchUserGroups(currentUserID);
            setGroups(updatedGroups);
            group = updatedGroups.find((g) => g.groupID === message.groupID);
          }

          setMessages((prev) => {
            console.log("Danh sách groups hiện tại:", groups);
            console.log("Nhóm tìm thấy:", group);

            if (!group) {
              console.warn("Không tìm thấy nhóm cho groupID:", message.groupID);
              return prev; // Nếu vẫn không tìm thấy, bỏ qua tin nhắn
            }

            const updatedContext =
              message.messageTypeID === "type2" ||
              message.messageTypeID === "type3" ||
              message.messageTypeID === "type5"
                ? convertFilePathToURL(message.context)
                : message.context;
            const newGroupMessage: HomeGroupMessage = {
              groupID: message.groupID || "unknown-group-id",
              groupName: group.groupName || "Nhóm không tên",
              context: updatedContext,
              createdAt: message.createdAt,
              messageID: message.messageID,
              messageTypeID: message.messageTypeID,
              unread: !message.seenStatus?.includes(userID),
            };

            const existingIndex = prev.findIndex(
              (msg) => msg.type === "group" && (msg.data as HomeGroupMessage).groupID === message.groupID
            );
            const updatedMessages = [...prev];
            if (existingIndex >= 0) {
              updatedMessages[existingIndex] = { type: "group", data: newGroupMessage };
            } else {
              updatedMessages.push({ type: "group", data: newGroupMessage });
            }
            return updatedMessages.sort(
              (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
            );
          });
        }
      });

      socket.on("updateSingleChatSeenStatus", (messageID: string) => {
        console.log("Home.tsx: Cập nhật trạng thái đã xem cho tin nhắn đơn messageID:", messageID);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.type === "single" && (msg.data as HomeMessage).messageID === messageID
              ? { ...msg, data: { ...(msg.data as HomeMessage), unread: false } }
              : msg
          )
        );
      });

      socket.on("updateGroupChatSeenStatus", (messageID: string) => {
        console.log("Home.tsx: Cập nhật trạng thái đã xem cho tin nhắn nhóm messageID:", messageID);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.type === "group" && (msg.data as HomeGroupMessage).messageID === messageID
              ? { ...msg, data: { ...(msg.data as HomeGroupMessage), unread: false } }
              : msg
          )
        );
      });

      socket.on("disconnect", (reason) => {
        console.log("Home.tsx: Socket đã ngắt kết nối:", reason);
      });

      setLoading(false);

      return () => {
        socket.off("connect");
        socket.off("receiveMessage");
        socket.off("receiveGroupMessage");
        socket.off("updateSingleChatSeenStatus");
        socket.off("updateGroupChatSeenStatus");
        socket.off("disconnect");
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

  const renderItem = ({ item }: { item: CombinedMessage }) => {
    if (item.type === "single") {
      const msg = item.data as HomeMessage;
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push({ pathname: "/single_chat", params: { userID: msg.senderID } })}
        >
          <Image source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }} style={styles.avatar} />
          <View style={styles.messageContent}>
            <Text style={styles.name}>{getUserName(msg.senderID)}</Text>
            <Text style={styles.message}>{getMessagePreview(msg)}</Text>
          </View>
          <View style={styles.rightContainer}>
            <Text style={styles.time}>{new Date(msg.createdAt).toLocaleTimeString()}</Text>
            {msg.unread && <View style={styles.unreadBadge} />}
          </View>
        </TouchableOpacity>
      );
    } else {
      const groupMsg = item.data as HomeGroupMessage;
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push({ pathname: "/group_chat", params: { groupID: groupMsg.groupID } })}
        >
          <Image source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }} style={styles.avatar} />
          <View style={styles.messageContent}>
            <Text style={styles.name}>{groupMsg.groupName}</Text>
            <Text style={styles.message}>{getMessagePreview(groupMsg)}</Text>
          </View>
          <View style={styles.rightContainer}>
            <Text style={styles.time}>{new Date(groupMsg.createdAt).toLocaleTimeString()}</Text>
            {groupMsg.unread && <View style={styles.unreadBadge} />}
          </View>
        </TouchableOpacity>
      );
    }
  };

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
          keyExtractor={(item, index) => `${item.type}-${item.data.messageID || item.data.createdAt}-${index}`}
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