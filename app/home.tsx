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
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchMessages, Message } from "../services/message";
import { fetchContacts, Contact } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket, { connectSocket, registerSocketListeners, removeSocketListeners } from "../services/socket";
import { fetchUserGroups, fetchGroupMembers, Group } from "../services/group";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";

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

// Type guard để kiểm tra CombinedMessage là tin nhắn nhóm
const isGroupMessage = (msg: CombinedMessage): msg is { type: "group"; data: HomeGroupMessage } => {
  return msg.type === "group";
};

export default function Home() {
  const [messages, setMessages] = useState<CombinedMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembersCount, setGroupMembersCount] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
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

  // Hàm lấy thời điểm xem cuối cùng của nhóm từ AsyncStorage
  const getLastSeenTimestamp = async (groupID: string): Promise<string | null> => {
    try {
      const lastSeen = await AsyncStorage.getItem(`lastSeen_${groupID}`);
      return lastSeen;
    } catch (error) {
      console.error(`Lỗi khi lấy lastSeenTimestamp cho nhóm ${groupID}:`, error);
      return null;
    }
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

      // Lấy số thành viên cho mỗi nhóm
      const membersCount: { [key: string]: number } = {};
      const allGroupsResponse = await api.get(`/api/group`);
      const allGroups = allGroupsResponse.data.data || [];
      for (const group of userGroups) {
        try {
          const members = await fetchGroupMembers(group.groupID);
          membersCount[group.groupID] = members.length;
        } catch (error) {
          console.error(`Lỗi khi lấy thành viên nhóm ${group.groupID}:`, error);
          const groupDetail = allGroups.find((g: { groupID: string }) => g.groupID === group.groupID);
          membersCount[group.groupID] = groupDetail?.totalMembers || 0;
        }
      }
      setGroupMembersCount(membersCount);

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
          
          // Lấy thời điểm xem cuối cùng của nhóm
          const lastSeenTimestamp = await getLastSeenTimestamp(group.groupID);
          const lastSeenDate = lastSeenTimestamp ? new Date(lastSeenTimestamp) : null;

          // Chỉ đếm tin nhắn chưa đọc sau lastSeenTimestamp
          const unreadCount = groupMessages.filter(
            (msg) =>
              !msg.seenStatus?.includes(userID) &&
              (!lastSeenDate || new Date(msg.createdAt) > lastSeenDate)
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

  const updateGroupUnreadCount = async (groupID: string, userID: string) => {
    try {
      const groupMessages = await fetchMessages(groupID, true);
      
      // Lấy thời điểm xem cuối cùng của nhóm
      const lastSeenTimestamp = await getLastSeenTimestamp(groupID);
      const lastSeenDate = lastSeenTimestamp ? new Date(lastSeenTimestamp) : null;

      // Chỉ đếm tin nhắn chưa đọc sau lastSeenTimestamp
      const unreadCount = groupMessages.filter(
        (msg) =>
          !msg.seenStatus?.includes(userID) &&
          (!lastSeenDate || new Date(msg.createdAt) > lastSeenDate)
      ).length;

      setMessages((prev) =>
        prev.map((msg) => {
          if (isGroupMessage(msg) && msg.data.groupID === groupID) {
            const data = msg.data;
            return {
              ...msg,
              data: { ...data, unreadCount },
            };
          }
          return msg;
        })
      );
    } catch (error) {
      console.error(`Lỗi khi cập nhật unreadCount cho nhóm ${groupID}:`, error);
    }
  };

  const setupSocketListeners = useCallback(() => {
    console.log("Home.tsx: Setting up socket listeners for user:", currentUserID);
    if (!currentUserID) return () => {};

    const listeners = [
      {
        event: "receiveMessage",
        handler: (message: Message) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Received message at", new Date().toISOString(), message);

          if (!message.messageID) {
            console.log("Home.tsx: Invalid message ID, skipping:", message);
            return;
          }

          if (processedMessageIDs.current.has(message.messageID)) {
            console.log("Home.tsx: Message already processed, skipping:", message.messageID);
            return;
          }
          processedMessageIDs.current.add(message.messageID);

          console.log("Home.tsx: Checking if message is relevant - currentUserID:", currentUserID, "senderID:", message.senderID, "receiverID:", message.receiverID);
          if (message.groupID && message.groupID !== "NONE") {
            const group = groups.find((g) => g.groupID === message.groupID);
            if (!group) {
              console.log("Home.tsx: Group not found, skipping:", message.groupID);
              return;
            }

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
              unreadCount: 0, // Sẽ tính lại ngay sau đây
            };

            console.log("Home.tsx: Adding new group message:", newGroupMessage);
            setMessages((prev) => {
              const existingIndex = prev.findIndex(
                (msg) => isGroupMessage(msg) && msg.data.groupID === message.groupID
              );

              let updatedMessages: CombinedMessage[];
              if (existingIndex !== -1) {
                updatedMessages = [...prev];
                updatedMessages[existingIndex] = {
                  type: "group",
                  data: newGroupMessage,
                };
              } else {
                updatedMessages = [...prev, { type: "group", data: newGroupMessage }];
              }

              const sortedMessages = updatedMessages.sort(
                (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );
              console.log("Home.tsx: Updated messages (group):", sortedMessages);
              return sortedMessages;
            });

            // Cập nhật unreadCount sau khi thêm tin nhắn mới
            updateGroupUnreadCount(message.groupID, currentUserID);
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

            console.log("Home.tsx: Adding new single message:", newHomeMessage);
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

              const sortedMessages = updatedMessages.sort(
                (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
              );
              console.log("Home.tsx: Updated messages (single):", sortedMessages);
              return sortedMessages;
            });
          } else {
            console.log("Home.tsx: Message not relevant to current user, skipping:", message);
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

          const groupMessage = messages.find(
            (msg) => isGroupMessage(msg) && msg.data.messageID === messageID
          );

          if (groupMessage && isGroupMessage(groupMessage)) {
            const groupID = groupMessage.data.groupID;
            updateGroupUnreadCount(groupID, seenUserID);
          }
        },
      },
      {
        event: "updateUnreadCount",
        handler: ({ groupID, userID }: { groupID: string; userID: string }) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Nhận được updateUnreadCount:", { groupID, userID });
          if (userID === currentUserID) {
            updateGroupUnreadCount(groupID, userID);
          }
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
              if (isGroupMessage(msg) && msg.data.messageID === data.messageID) {
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
              if (isGroupMessage(msg) && msg.data.messageID === messageID) {
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
          joinRooms();
        },
      },
      {
        event: "disconnect",
        handler: (reason: string) => {
          console.log("Home.tsx: Socket disconnected:", reason);
        },
      },
      {
        event: "newMember",
        handler: async (data: { userID: string; groupID: string }) => {
          if (!isMounted.current) return;
          console.log("Home.tsx: Thành viên mới được thêm:", data);
          if (currentUserID) {
            // Làm mới danh sách nhóm
            await loadMessages(currentUserID);
            // Cập nhật cache nhóm
            const cacheKey = `cachedUserGroups_${currentUserID}`;
            const userGroups = await fetchUserGroups(currentUserID);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(userGroups));
            console.log("Đã cập nhật cache nhóm sau newMember:", cacheKey);
          }
        },
      },
    ];

    registerSocketListeners(listeners);
    return () => {
      removeSocketListeners(listeners.map((l) => l.event));
    };
  }, [currentUserID, contacts, groups, messages]);

  const joinRooms = useCallback(() => {
    if (currentUserID) {
      socket.emit("joinUserRoom", currentUserID);
      console.log("Home.tsx: Joined user room:", currentUserID);

      joinedContactRooms.current.clear();
      contacts.forEach((contact) => {
        if (!joinedContactRooms.current.has(contact.userID)) {
          socket.emit("joinUserRoom", contact.userID);
          joinedContactRooms.current.add(contact.userID);
          console.log("Home.tsx: Joined contact room:", contact.userID);
        }
      });

      groups.forEach((group) => {
        socket.emit("joinGroupRoom", group.groupID);
        console.log("Home.tsx: Joined group room:", group.groupID);
      });
    }
  }, [currentUserID, contacts, groups]);

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
        "updateUnreadCount",
        "deletedSingleMessage",
        "recalledSingleMessage",
        "deletedGroupMessage",
        "recalledGroupMessage",
        "connect",
        "disconnect",
        "newMember",
      ]);
    };
  }, [loadMessages, setupSocketListeners]);

  useFocusEffect(
    useCallback(() => {
      if (currentUserID) {
        console.log("Home.tsx: Screen focused, reloading messages for user:", currentUserID);
        processedMessageIDs.current.clear();
        console.log("Home.tsx: Cleared processedMessageIDs");
        loadMessages(currentUserID);
      }

      return () => {
        console.log("Home.tsx: Screen unfocused");
      };
    }, [currentUserID, loadMessages])
  );

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
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={30} color="#666" />
              </View>
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
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="people" size={30} color="#666" />
            </View>
            <View style={styles.messageContent}>
              <Text style={styles.name}>
                {groupMsg.groupName} ({groupMembersCount[groupMsg.groupID] || 0} thành viên)
              </Text>
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
    [contacts, groups, groupMembersCount]
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
    justifyContent: "center",
    alignItems: "center",
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
});