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
import socket, { connectSocket, registerSocketListeners, removeSocketListeners } from "../services/socket";
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
  groupID?: string;
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
      // Sửa: Truyền userID vào fetchContacts
      const contactsData = await fetchContacts(userID);
      setContacts(contactsData);

      const userGroups = await fetchUserGroups(userID);
      console.log("Danh sách nhóm từ loadMessages:", userGroups);
      setGroups(userGroups);

      const allMessages: HomeMessage[] = [];
      const allGroupMessages: HomeGroupMessage[] = [];
      const seenMessageIDs = new Set<string>();

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

  const setupSocketListeners = () => {
    const listeners = [
      {
        event: "updateSingleChatSeenStatus",
        handler: ({ messageID, seenUserID }: { messageID: string; seenUserID: string }) => {
          console.log("Home.tsx: Cập nhật trạng thái đã xem cho tin nhắn đơn messageID:", messageID, "seenUserID:", seenUserID);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) => {
              if (msg.type === "single" && (msg.data as HomeMessage).messageID === messageID) {
                const data = msg.data as HomeMessage;
                return {
                  ...msg,
                  data: { ...data, unread: seenUserID === currentUserID ? data.unread : false },
                };
              }
              return msg;
            });
            console.log("Home.tsx: Updated messages:", updatedMessages);
            return [...updatedMessages];
          });
        },
      },
      {
        event: "updateGroupChatSeenStatus",
        handler: (messageID: string, seenUserID: string) => {
          console.log("Home.tsx: Cập nhật trạng thái đã xem cho tin nhắn nhóm messageID:", messageID, "seenUserID:", seenUserID);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) => {
              if (msg.type === "group" && (msg.data as HomeGroupMessage).messageID === messageID) {
                const data = msg.data as HomeGroupMessage;
                return {
                  ...msg,
                  data: { ...data, unread: seenUserID === currentUserID ? data.unread : false },
                };
              }
              return msg;
            });
            return [...updatedMessages];
          });
        },
      },
      {
        event: "recalledSingleMessage",
        handler: (messageID: string) => {
          console.log("Home.tsx: Tin nhắn đơn bị thu hồi:", messageID);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              msg.type === "single" && (msg.data as HomeMessage).messageID === messageID
                ? { ...msg, data: { ...(msg.data as HomeMessage), context: "Tin nhắn đã được thu hồi" } }
                : msg
            );
            return [...updatedMessages];
          });
        },
      },
      {
        event: "deletedGroupMessage",
        handler: (messageID: string) => {
          console.log("Home.tsx: Tin nhắn nhóm bị xóa:", messageID);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              msg.type === "group" && (msg.data as HomeGroupMessage).messageID === messageID
                ? { ...msg, data: { ...(msg.data as HomeGroupMessage), context: "Tin nhắn đã bị xóa" } }
                : msg
            );
            return [...updatedMessages];
          });
        },
      },
      {
        event: "recalledGroupMessage",
        handler: (messageID: string) => {
          console.log("Home.tsx: Tin nhắn nhóm bị thu hồi:", messageID);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              msg.type === "group" && (msg.data as HomeGroupMessage).messageID === messageID
                ? { ...msg, data: { ...(msg.data as HomeGroupMessage), context: "Tin nhắn đã được thu hồi" } }
                : msg
            );
            return [...updatedMessages];
          });
        },
      },
      {
        event: "disconnect",
        handler: (reason: string) => {
          console.log("Home.tsx: Socket đã ngắt kết nối:", reason);
          if (reason === "io server disconnect" || reason === "io client disconnect") {
            connectSocket();
          }
        },
      },
    ];

    registerSocketListeners(listeners);

    socket.on("connect", () => {
      console.log("Home.tsx: Socket đã kết nối:", socket.id);
      socket.emit("joinUserRoom", currentUserID);
      groups.forEach((group) => {
        if (group.groupID) {
          socket.emit("joinGroup", currentUserID, group.groupID);
          console.log("Home.tsx: Đã tham gia phòng nhóm:", group.groupID);
        }
      });
    });

    return () => {
      removeSocketListeners([
        "connect",
        "receiveMessage",
        "updateSingleChatSeenStatus",
        "updateGroupChatSeenStatus",
        "deletedSingleMessage",
        "recalledSingleMessage",
        "deletedGroupMessage",
        "recalledGroupMessage",
        "disconnect",
      ]);
    };
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
        console.error("Không tìm thấy userID");
        setLoading(false);
        return;
      }
      setCurrentUserID(userID);

      await loadMessages(userID);

      await connectSocket();
      socket.emit("joinUserRoom", userID);
      console.log("Home.tsx: Đã tham gia phòng người dùng:", userID);

      const userGroups = await fetchUserGroups(userID);
      console.log("Danh sách nhóm từ useEffect:", userGroups);
      setGroups(userGroups);

      userGroups.forEach((group) => {
        if (group.groupID) {
          socket.emit("joinGroup", userID, group.groupID);
          console.log("Home.tsx: Đã tham gia phòng nhóm:", group.groupID);
        } else {
          console.warn("Nhóm không có groupID, không thể tham gia phòng:", group);
        }
      });

      setLoading(false);
    };

    initializeData();
    const cleanup = setupSocketListeners();

    return cleanup;
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

  const getUserAvatar = (userID: string) => {
    if (!contacts.length) return "https://via.placeholder.com/50";
    const user = contacts.find((contact) => contact.userID === userID);
    return user?.avatar || "https://via.placeholder.com/50";
  };

  const getGroupAvatar = (groupID: string | undefined) => {
    return "https://via.placeholder.com/50"; 
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
          <Image source={{ uri: getUserAvatar(msg.senderID) }} style={styles.avatar} />
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
          <Image source={{ uri: getGroupAvatar(groupMsg.groupID) }} style={styles.avatar} />
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
          extraData={messages}
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