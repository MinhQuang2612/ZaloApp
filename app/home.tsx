import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Button,
} from "react-native";
import { useRouter } from "expo-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchMessages, Message } from "../services/message";
import { fetchContacts, Contact } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket, { connectSocket, registerSocketListeners, removeSocketListeners } from "../services/socket";
import { fetchUserGroups, Group, createGroup } from "../services/group";

type HomeMessage = {
  senderID: string;
  context: string;
  createdAt: string;
  unreadCount: number;
  messageID?: string;
  messageTypeID?: string;
};

type HomeGroupMessage = {
  groupID: string;
  groupName: string;
  context: string;
  createdAt: string;
  unreadCount: number;
  messageID?: string;
  messageTypeID?: string;
};

type CombinedMessage = { type: "single"; data: HomeMessage } | { type: "group"; data: HomeGroupMessage };

export default function Home() {
  const [messages, setMessages] = useState<CombinedMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const router = useRouter();
  const processedMessageIDs = useRef(new Set<string>());
  const joinedContactRooms = useRef(new Set<string>());
  const isMounted = useRef(true);

  const saveMessageStatus = async (messageID: string, status: "deleted" | "recalled") => {
    try {
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      const statuses = existingStatuses ? JSON.parse(existingStatuses) : {};
      statuses[messageID] = status;
      await AsyncStorage.setItem("messageStatuses", JSON.stringify(statuses));
    } catch (error) {
      console.error("Lỗi khi lưu trạng thái tin nhắn:", error);
    }
  };

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
        return "Đã gửi tin nhắn thoại";
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
      return `${process.env.EXPO_PUBLIC_API_URL}/Uploads/${fileName}`;
    }
    return context;
  };

  const getUserName = (userID: string): string => {
    const contact = contacts.find((c) => c.userID === userID);
    return contact?.username || "Người dùng không xác định";
  };

  const getUserAvatar = (userID: string): string | null => {
    const contact = contacts.find((c) => c.userID === userID);
    return contact?.avatar || null;
  };

  const getGroupAvatar = (_groupID: string): string | null => {
    return null;
  };

  const loadMessages = useCallback(async (userID: string) => {
    if (!isMounted.current) return;
    console.log("Home.tsx: loadMessages called at", new Date().toISOString());
    try {
      setLoading(true);
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      const messageStatuses = existingStatuses ? JSON.parse(existingStatuses) : {};

      const contactsData = await fetchContacts(userID);
      const userGroups = await fetchUserGroups(userID);

      setContacts((prev) =>
        JSON.stringify(prev) !== JSON.stringify(contactsData) ? contactsData : prev
      );
      setGroups((prev) =>
        JSON.stringify(prev) !== JSON.stringify(userGroups) ? userGroups : prev
      );

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

          const unreadCount = relevantMessages.filter(
            (msg) => msg.receiverID === userID && !msg.seenStatus?.includes(userID)
          ).length;

          const latestMessage = relevantMessages.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          return { contact, latestMessage, unreadCount };
        });

        const results = await Promise.all(messagePromises);

        results.forEach(({ contact, latestMessage, unreadCount }) => {
          if (latestMessage && !seenMessageIDs.has(latestMessage.messageID!)) {
            seenMessageIDs.add(latestMessage.messageID!);
            let updatedContext =
              latestMessage.messageTypeID === "type2" ||
              latestMessage.messageTypeID === "type3" ||
              latestMessage.messageTypeID === "type5" ||
              latestMessage.messageTypeID === "type6"
                ? convertFilePathToURL(latestMessage.context)
                : latestMessage.context;

            const messageStatus = messageStatuses[latestMessage.messageID!] || null;
            if (messageStatus === "deleted") {
              updatedContext = "Tin nhắn đã bị xóa";
            } else if (messageStatus === "recalled") {
              updatedContext = "Tin nhắn đã được thu hồi";
            }

            allMessages.push({
              senderID: latestMessage.senderID === userID ? latestMessage.receiverID! : latestMessage.senderID,
              context: updatedContext,
              createdAt: latestMessage.createdAt,
              messageID: latestMessage.messageID,
              messageTypeID: latestMessage.messageTypeID,
              unreadCount,
            });
          }
        });
      }

      if (userGroups && userGroups.length > 0) {
        const groupMessagePromises = userGroups.map(async (group) => {
          const groupMessages = await fetchMessages(group.groupID, true);
          const unreadCount = groupMessages.filter(
            (msg) => !msg.seenStatus?.includes(userID)
          ).length;

          const latestMessage = groupMessages.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          return { group, latestMessage, unreadCount };
        });

        const groupResults = await Promise.all(groupMessagePromises);

        groupResults.forEach(({ group, latestMessage, unreadCount }) => {
          if (latestMessage && !seenMessageIDs.has(latestMessage.messageID!)) {
            seenMessageIDs.add(latestMessage.messageID!);
            let updatedContext =
              latestMessage.messageTypeID === "type2" ||
              latestMessage.messageTypeID === "type3" ||
              latestMessage.messageTypeID === "type5" ||
              latestMessage.messageTypeID === "type6"
                ? convertFilePathToURL(latestMessage.context)
                : latestMessage.context;

            const messageStatus = messageStatuses[latestMessage.messageID!] || null;
            if (messageStatus === "deleted") {
              updatedContext = "Tin nhắn đã bị xóa";
            } else if (messageStatus === "recalled") {
              updatedContext = "Tin nhắn đã được thu hồi";
            }

            allGroupMessages.push({
              groupID: group.groupID,
              groupName: group.groupName,
              context: updatedContext,
              createdAt: latestMessage.createdAt,
              messageID: latestMessage.messageID,
              messageTypeID: latestMessage.messageTypeID,
              unreadCount,
            });
          } else {
            allGroupMessages.push({
              groupID: group.groupID,
              groupName: group.groupName,
              context: "Nhóm mới được tạo",
              createdAt: new Date().toISOString(),
              unreadCount: 0,
            });
          }
        });
      }

      const combinedMessages = [
        ...allMessages.map((msg) => ({ type: "single" as const, data: msg })),
        ...allGroupMessages.map((msg) => ({ type: "group" as const, data: msg })),
      ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

      setMessages((prev) =>
        JSON.stringify(prev) !== JSON.stringify(combinedMessages) ? combinedMessages : prev
      );
    } catch (error) {
      console.error("Lỗi khi tải tin nhắn:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const setupSocketListeners = useCallback(() => {
    console.log("Home.tsx: Setting up socket listeners for user:", currentUserID);
    if (!currentUserID) return () => {};

    const listeners = [
      {
        event: "receiveMessage",
        handler: (message: Message) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Received message at", new Date().toISOString(), message);
          if (processedMessageIDs.current.has(message.messageID!)) {
            console.log("Home.tsx: Message already processed, skipping:", message.messageID);
            return;
          }
          processedMessageIDs.current.add(message.messageID!);

          if (message.groupID) {
            const group = groups.find((g) => g.groupID === message.groupID);
            if (!group) return;

            let updatedContext = message.context;
            if (
              message.messageTypeID === "type2" ||
              message.messageTypeID === "type3" ||
              message.messageTypeID === "type5" ||
              message.messageTypeID === "type6"
            ) {
              updatedContext = convertFilePathToURL(message.context);
            }

            const newGroupMessage: HomeGroupMessage = {
              groupID: message.groupID,
              groupName: group.groupName,
              context: updatedContext,
              createdAt: message.createdAt,
              messageID: message.messageID,
              messageTypeID: message.messageTypeID,
              unreadCount: !message.seenStatus?.includes(currentUserID!) ? 1 : 0,
            };

            setMessages((prev) => {
              const existingIndex = prev.findIndex(
                (msg) => msg.type === "group" && (msg.data as HomeGroupMessage).groupID === message.groupID
              );

              let updatedMessages: CombinedMessage[];
              if (existingIndex !== -1) {
                updatedMessages = [...prev];
                const existingMessage = updatedMessages[existingIndex].data as HomeGroupMessage;
                updatedMessages[existingIndex] = {
                  type: "group",
                  data: {
                    ...newGroupMessage,
                    unreadCount: existingMessage.unreadCount + (newGroupMessage.unreadCount || 0),
                  },
                };
              } else {
                updatedMessages = [...prev, { type: "group", data: newGroupMessage }];
              }

              return updatedMessages.sort(
                (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );
            });
          } else if (message.senderID === currentUserID || message.receiverID === currentUserID) {
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
              unreadCount: message.receiverID === currentUserID && !message.seenStatus?.includes(currentUserID) ? 1 : 0,
            };

            setMessages((prev) => {
              const existingIndex = prev.findIndex(
                (msg) => msg.type === "single" && (msg.data as HomeMessage).senderID === contactID
              );

              let updatedMessages: CombinedMessage[];
              if (existingIndex !== -1) {
                updatedMessages = [...prev];
                const existingMessage = updatedMessages[existingIndex].data as HomeMessage;
                updatedMessages[existingIndex] = {
                  type: "single",
                  data: {
                    ...newHomeMessage,
                    unreadCount: existingMessage.unreadCount + (newHomeMessage.unreadCount || 0),
                  },
                };
              } else {
                updatedMessages = [...prev, { type: "single", data: newHomeMessage }];
              }

              return updatedMessages.sort(
                (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );
            });
          }
        },
      },
      {
        event: "updateSingleChatSeenStatus",
        handler: ({ messageID, seenUserID }: { messageID: string; seenUserID: string }) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Cập nhật trạng thái đã xem cho tin nhắn đơn:", messageID, seenUserID);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === "single" && (msg.data as HomeMessage).messageID === messageID) {
                const data = msg.data as HomeMessage;
                return {
                  ...msg,
                  data: { ...data, unreadCount: data.unreadCount > 0 ? data.unreadCount - 1 : 0 },
                };
              }
              return msg;
            })
          );
        },
      },
      {
        event: "updateGroupChatSeenStatus",
        handler: ({ messageID, seenUserID }: { messageID: string; seenUserID: string }) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Cập nhật trạng thái đã xem cho tin nhắn nhóm:", messageID, seenUserID);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === "group" && (msg.data as HomeGroupMessage).messageID === messageID) {
                const data = msg.data as HomeGroupMessage;
                return {
                  ...msg,
                  data: { ...data, unreadCount: data.unreadCount > 0 ? data.unreadCount - 1 : 0 },
                };
              }
              return msg;
            })
          );
        },
      },
      {
        event: "deletedSingleMessage",
        handler: (data: { messageID: string; userID: string }) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Nhận được deletedSingleMessage:", data);
          saveMessageStatus(data.messageID, "deleted");
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === "single" && (msg.data as HomeMessage).messageID === data.messageID) {
                return { ...msg, data: { ...msg.data, context: "Tin nhắn đã bị xóa" } };
              }
              return msg;
            })
          );
        },
      },
      {
        event: "recalledSingleMessage",
        handler: (messageID: string) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Nhận được recalledSingleMessage:", messageID);
          saveMessageStatus(messageID, "recalled");
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === "single" && (msg.data as HomeMessage).messageID === messageID) {
                return { ...msg, data: { ...msg.data, context: "Tin nhắn đã được thu hồi" } };
              }
              return msg;
            })
          );
        },
      },
      {
        event: "deletedGroupMessage",
        handler: (data: { messageID: string; userID: string }) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Nhận được deletedGroupMessage:", data);
          saveMessageStatus(data.messageID, "deleted");
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === "group" && (msg.data as HomeGroupMessage).messageID === data.messageID) {
                return { ...msg, data: { ...msg.data, context: "Tin nhắn đã bị xóa" } };
              }
              return msg;
            })
          );
        },
      },
      {
        event: "recalledGroupMessage",
        handler: (messageID: string) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Nhận được recalledGroupMessage:", messageID);
          saveMessageStatus(messageID, "recalled");
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === "group" && (msg.data as HomeGroupMessage).messageID === messageID) {
                return { ...msg, data: { ...msg.data, context: "Tin nhắn đã được thu hồi" } };
              }
              return msg;
            })
          );
        },
      },
      {
        event: "connect",
        handler: () => {
          console.log("Home.tsx: Socket connected:", socket.id);
          if (currentUserID) {
            socket.emit("joinUserRoom", currentUserID);
            contacts.forEach((contact) => {
              if (!joinedContactRooms.current.has(contact.userID)) {
                socket.emit("joinUserRoom", contact.userID);
                joinedContactRooms.current.add(contact.userID);
              }
            });
            groups.forEach((group) => {
              socket.emit("joinGroupRoom", group.groupID);
            });
          }
        },
      },
      {
        event: "disconnect",
        handler: (reason: string) => {
          console.log("Home.tsx: Socket disconnected:", reason);
        },
      },
    ];

    registerSocketListeners(listeners);
    return () => {
      removeSocketListeners(listeners.map((l) => l.event));
    };
  }, [currentUserID, contacts, groups]);

  const toggleMember = (userID: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userID) ? prev.filter((id) => id !== userID) : [...prev, userID]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Vui lòng nhập tên nhóm!");
      return;
    }
    try {
      // Sửa lỗi: Gọi createGroup với đúng định dạng { groupName, userID }
      const newGroup = await createGroup({ groupName, userID: currentUserID! });
      setGroups((prev) => [...prev, newGroup]);

      // Sửa lỗi TypeScript: Đảm bảo type: "group" và dữ liệu khớp HomeGroupMessage
      setMessages((prev) => [
        ...prev,
        {
          type: "group" as const, // Rõ ràng kiểu literal
          data: {
            groupID: newGroup.groupID,
            groupName: newGroup.groupName,
            context: "Nhóm mới được tạo",
            createdAt: new Date().toISOString(),
            unreadCount: 0,
          },
        },
      ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()));

      setShowCreateGroupModal(false);
      setGroupName("");
      setSelectedMembers([]);
      alert("Tạo nhóm thành công!");
    } catch (error) {
      console.error("Lỗi tạo nhóm:", error);
      alert("Không thể tạo nhóm!");
    }
  };

  useEffect(() => {
    isMounted.current = true;
    const initialize = async () => {
      try {
        setLoading(true);
        const userData = await AsyncStorage.getItem("user");
        if (!userData) {
          console.error("Không tìm thấy user trong AsyncStorage");
          router.replace("/login");
          return;
        }

        const user = JSON.parse(userData);
        const userID = user.userID;
        if (!userID) {
          console.error("userID không hợp lệ:", userID);
          router.replace("/login");
          return;
        }
        setCurrentUserID(userID);

        await loadMessages(userID);
        await connectSocket();
        setupSocketListeners();
      } catch (error) {
        console.error("Lỗi khi khởi tạo:", error);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      isMounted.current = false;
      removeSocketListeners([
        "receiveMessage",
        "updateSingleChatSeenStatus",
        "updateGroupChatSeenStatus",
        "deletedSingleMessage",
        "recalledSingleMessage",
        "deletedGroupMessage",
        "recalledGroupMessage",
        "connect",
        "disconnect",
      ]);
    };
  }, [loadMessages, setupSocketListeners]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentUserID) {
      await loadMessages(currentUserID);
    }
    setRefreshing(false);
  };

  const renderItem = useCallback(
    ({ item }: { item: CombinedMessage }) => {
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
              {msg.unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{msg.unreadCount}</Text>
                </View>
              )}
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
            <View style={styles.avatarPlaceholder} />
            <View style={styles.messageContent}>
              <Text style={styles.name}>{groupMsg.groupName}</Text>
              <Text style={styles.message}>{getMessagePreview(groupMsg)}</Text>
            </View>
            <View style={styles.rightContainer}>
              <Text style={styles.time}>{new Date(groupMsg.createdAt).toLocaleTimeString()}</Text>
              {groupMsg.unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{groupMsg.unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      }
    },
    [contacts, groups]
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
      <Navbar showSearch showAdd addIconType="add" />
      <FlatList
        style={{ zIndex: 500 }}
        data={messages}
        keyExtractor={(item, index) =>
          item.type === "single"
            ? `single-${(item.data as HomeMessage).senderID}-${item.data.messageID || index}`
            : `group-${(item.data as HomeGroupMessage).groupID}-${item.data.messageID || index}`
        }
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        extraData={messages}
      />
      
      <Modal
        visible={showCreateGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateGroupModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tạo nhóm mới</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập tên nhóm"
              value={groupName}
              onChangeText={setGroupName}
            />
            {/* Tạm ẩn chọn thành viên vì API không hỗ trợ */}
            <View style={styles.modalButtons}>
              <Button title="Hủy" onPress={() => setShowCreateGroupModal(false)} />
              <Button title="Tạo" onPress={handleCreateGroup} />
            </View>
          </View>
        </View>
      </Modal>
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ddd",
    marginRight: 15,
  },
  messageContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
  },
  message: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  rightContainer: {
    alignItems: "flex-end",
  },
  time: {
    fontSize: 12,
    color: "#666",
  },
  unreadCountBadge: {
    backgroundColor: "#FF2D55",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  unreadCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  createGroupButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 25,
    position: "absolute",
    bottom: 80,
    right: 20,
    zIndex: 1000,
  },
  createGroupText: {
    color: "#fff",
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 10,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
});