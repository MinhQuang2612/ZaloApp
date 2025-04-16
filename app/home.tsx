import React, { useState, useEffect, useCallback } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
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
  const [lastLoaded, setLastLoaded] = useState<number>(0);
  const router = useRouter();
  const processedMessageIDs = React.useRef(new Set<string>());
  const joinedContactRooms = React.useRef(new Set<string>()); // Theo dõi các phòng liên hệ đã tham gia

  const determineMessageType = (message: HomeMessage | HomeGroupMessage | Message): string => {
    return message.messageTypeID || "type1";
  };

  const getMessagePreview = (message: HomeMessage | HomeGroupMessage | Message): string => {
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
      case "type6":
        return "Đã gửi thoại";
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
    console.log("Home.tsx: loadMessages called at", new Date().toISOString());
    try {
      setLoading(true);

      const contactsData = await fetchContacts(userID);
      setContacts(contactsData);

      const userGroups = await fetchUserGroups(userID);
      console.log("Danh sách nhóm từ loadMessages:", userGroups);

      const allMessages: HomeMessage[] = [];
      const allGroupMessages: HomeGroupMessage[] = [];
      const seenMessageIDs = new Set<string>();

      if (contactsData && contactsData.length > 0) {
        const messagePromises = contactsData.map(async (contact) => {
          const contactMessages = await fetchMessages(contact.userID);
          const relevantMessages = contactMessages.filter(
            (msg) =>
              (msg.senderID === userID || msg.receiverID === userID) &&
              msg.receiverID !== undefined
          );

          const latestMessage = relevantMessages.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          return { contact, latestMessage };
        });

        const results = await Promise.all(messagePromises);

        results.forEach(({ contact, latestMessage }) => {
          if (latestMessage && !seenMessageIDs.has(latestMessage.messageID!)) {
            seenMessageIDs.add(latestMessage.messageID!);
            const updatedContext =
              latestMessage.messageTypeID === "type2" ||
              latestMessage.messageTypeID === "type3" ||
              latestMessage.messageTypeID === "type5" ||
              latestMessage.messageTypeID === "type6"
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
        });
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
      setLastLoaded(Date.now());
    } catch (error) {
      console.error("Lỗi khi tải tin nhắn:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = useCallback(() => {
    console.log("Home.tsx: Setting up socket listeners for user:", currentUserID);

    const listeners = [
      {
        event: "receiveMessage",
        handler: (message: Message) => {
          console.log("Home.tsx: Received message at", new Date().toISOString(), message);
          console.log("Debug IDs:", {
            messageSenderID: message.senderID,
            messageReceiverID: message.receiverID,
            currentUserID,
          });

          if (processedMessageIDs.current.has(message.messageID!)) {
            console.log("Home.tsx: Message already processed, skipping:", message.messageID);
            return;
          }
          processedMessageIDs.current.add(message.messageID!);

          if (message.senderID === currentUserID || message.receiverID === currentUserID) {
            console.log("Message matches current user:", { message, currentUserID });
            const contactID =
              message.senderID === currentUserID ? message.receiverID! : message.senderID;

            let updatedContext = message.context;
            if (
              message.messageTypeID === "type2" ||
              message.messageTypeID === "type3" ||
              message.messageTypeID === "type5" ||
              message.messageTypeID === "type6"
            ) {
              updatedContext = convertFilePathToURL(message.context);
            }

            const newHomeMessage: HomeMessage = {
              senderID: contactID,
              context: updatedContext,
              createdAt: message.createdAt,
              messageID: message.messageID,
              messageTypeID: message.messageTypeID,
              unread: message.receiverID === currentUserID && !message.seenStatus?.includes(currentUserID),
            };

            setMessages((prev) => {
              const existingIndex = prev.findIndex(
                (msg) => msg.type === "single" && (msg.data as HomeMessage).senderID === contactID
              );

              let updatedMessages: CombinedMessage[];
              if (existingIndex !== -1) {
                updatedMessages = [...prev];
                updatedMessages[existingIndex] = { type: "single", data: newHomeMessage };
              } else {
                updatedMessages = [...prev, { type: "single", data: newHomeMessage }];
              }

              updatedMessages = updatedMessages.sort(
                (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );
              console.log("Updated messages in Home:", updatedMessages);
              return updatedMessages;
            });
          } else {
            console.log("Message does not match current user:", { message, currentUserID });
          }
        },
      },
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
      if (currentUserID) {
        socket.emit("joinUserRoom", currentUserID);
      }
    });

    return () => {
      console.log("Home.tsx: Cleaning up socket listeners");
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
  }, [currentUserID]);

  // Khởi tạo currentUserID
  useEffect(() => {
    const initializeUser = async () => {
      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        console.error("Không tìm thấy user trong AsyncStorage");
        router.replace("/login");
        return;
      }

      const user = JSON.parse(userData);
      const userID = user.userID;
      if (!userID) {
        console.error("Không tìm thấy userID");
        return;
      }
      setCurrentUserID(userID);
      console.log("Current user ID set to:", userID);
    };

    initializeUser();
  }, []);

  // Khởi tạo dữ liệu chính (loadMessages và socket)
  useEffect(() => {
    if (!currentUserID) return;

    const initializeData = async () => {
      console.log("Home.tsx: initializeData called at", new Date().toISOString());
      setLoading(true);

      await loadMessages(currentUserID);

      await connectSocket();
      socket.emit("joinUserRoom", currentUserID);
      console.log("Home.tsx: Đã tham gia phòng người dùng:", currentUserID);

      console.log("Socket connection status:", socket.connected);
      setLoading(false);
    };

    initializeData();
  }, [currentUserID]);

  // Sử dụng useFocusEffect để đăng ký lại socket listeners khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      const cleanup = setupSocketListeners();
      return cleanup;
    }, [setupSocketListeners])
  );

  // Tham gia phòng của các liên hệ (chỉ khi contacts thay đổi)
  useEffect(() => {
    if (!currentUserID || !contacts.length) return;

    contacts.forEach((contact) => {
      if (!joinedContactRooms.current.has(contact.userID)) {
        socket.emit("joinUserRoom", contact.userID);
        joinedContactRooms.current.add(contact.userID);
        console.log("Home.tsx: Đã tham gia phòng liên hệ:", contact.userID);
      }
    });
  }, [currentUserID, contacts]);

  // Tách logic fetch groups ra riêng
  useEffect(() => {
    if (!currentUserID) return;

    const fetchGroups = async () => {
      const userGroups = await fetchUserGroups(currentUserID);
      console.log("Danh sách nhóm từ useEffect:", userGroups);
      setGroups(userGroups);

      userGroups.forEach((group) => {
        if (group.groupID) {
          socket.emit("joinGroup", currentUserID, group.groupID);
          console.log("Home.tsx: Đã tham gia phòng nhóm:", group.groupID);
        } else {
          console.warn("Nhóm không có groupID, không thể tham gia phòng:", group);
        }
      });
    };

    fetchGroups();
  }, [currentUserID]);

  // Tự động load lại khi thoát khỏi single_chat
  useFocusEffect(
    React.useCallback(() => {
      if (currentUserID) {
        const now = Date.now();
        if (now - lastLoaded > 30000) { // Chỉ reload nếu đã hơn 30 giây
          console.log("Home.tsx: Reloading messages on focus");
          loadMessages(currentUserID);
        }
      }
    }, [currentUserID, lastLoaded])
  );

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
    if (!contacts.length) return undefined;
    const user = contacts.find((contact) => contact.userID === userID);
    return user?.avatar;
  };

  const getGroupAvatar = (groupID: string | undefined) => {
    return undefined;
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
      const avatarUri = getUserAvatar(msg.senderID);
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push({ pathname: "/single_chat", params: { userID: msg.senderID } })}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
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
      const groupAvatarUri = getGroupAvatar(groupMsg.groupID);
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => router.push({ pathname: "/group_chat", params: { groupID: groupMsg.groupID } })}
        >
          {groupAvatarUri ? (
            <Image source={{ uri: groupAvatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
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
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#ddd" },
  messageContent: { flex: 1, marginLeft: 10 },
  name: { fontSize: 16, fontWeight: "bold" },
  message: { fontSize: 14, color: "#666" },
  time: { fontSize: 12, color: "#999" },
  rightContainer: { alignItems: "flex-end" },
  unreadBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#007AFF" },
});