import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  Image,
  Platform,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMessages, Message } from "../services/message";
import { fetchUserGroups, fetchGroupMembers, GroupMember, Group } from "../services/group";
import { fetchContacts, Contact } from "../services/contacts";
import socket, { connectSocket, deleteMessage, recallMessage, registerSocketListeners, removeSocketListeners } from "../services/socket";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Audio, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";

type SocketResponse =
  | "đang gửi"
  | "Đã nhận"
  | "tin nhắn đã tồn tại"
  | "không tìm thấy tin nhắn"
  | "User đã tồn tại trong seenStatus"
  | "Đã cập nhật seenStatus chat đơn"
  | "Đã cập nhật seenStatus chat nhóm"
  | "Xóa tin nhắn thành công"
  | "Thu hồi tin nhắn thành công"
  | string;

type GiphySticker = {
  id: string;
  images: {
    original: {
      url: string;
    };
  };
};

type GroupMessage = Message & {
  senderAvatar: string;
};

type ForwardItem = { type: "contact"; data: Contact } | { type: "group"; data: Group };

const MessageItem = ({
  item,
  currentUserID,
  onDeleteMessage,
  onRecallMessage,
  onForwardMessage,
  onPinMessage,
}: {
  item: GroupMessage;
  currentUserID: string | null;
  onDeleteMessage: (messageID: string) => void;
  onRecallMessage: (messageID: string) => void;
  onForwardMessage: (messageID: string) => void;
  onPinMessage: (messageID: string) => void;
}) => {
  const effectiveType = determineMessageType(item);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (effectiveType === "type3" && item.context !== "Đang tải...") {
      setVideoUri(item.context);
    }
  }, [item.context, effectiveType]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const handleFilePress = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error("Lỗi khi mở file:", err);
      Alert.alert("Lỗi", "Không thể mở file. Vui lòng thử lại.");
    });
  };

  const handlePlayVoice = async () => {
    if (!item.context) return;

    if (isPlayingVoice) {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlayingVoice(false);
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: item.context },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlayingVoice(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingVoice(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error("Lỗi khi phát Voice:", error);
      Alert.alert("Lỗi", "Không thể phát tin nhắn thoại.");
      setIsPlayingVoice(false);
    }
  };

  const isForwarded = item.messageID?.includes("-share-");

  const renderMessageOptions = () => (
    <Modal
      visible={showMessageOptions}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowMessageOptions(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.messageOptionsContainer}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => {
              setShowMessageOptions(false);
              onForwardMessage(item.messageID!);
            }}
          >
            <Ionicons name="share-outline" size={24} color="#007AFF" />
            <Text style={styles.optionText}>Chuyển tiếp</Text>
          </TouchableOpacity>
          {item.senderID === currentUserID && !item.recallStatus && (
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setShowMessageOptions(false);
                onRecallMessage(item.messageID!);
              }}
            >
              <Ionicons name="refresh-outline" size={24} color="#007AFF" />
              <Text style={styles.optionText}>Thu hồi</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => {
              setShowMessageOptions(false);
              onDeleteMessage(item.messageID!);
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <Text style={styles.optionText}>Xóa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => {
              setShowMessageOptions(false);
              onPinMessage(item.messageID!);
            }}
          >
            <Ionicons name="pin-outline" size={24} color="#007AFF" />
            <Text style={styles.optionText}>Ghim</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, { justifyContent: "center" }]}
            onPress={() => setShowMessageOptions(false)}
          >
            <Text style={[styles.optionText, { color: "#FF3B30" }]}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const isDeletedForUser = item.deleteStatusByUser?.includes(currentUserID || "");
  const isRecalled = item.recallStatus;

  return (
    <View
      style={[
        styles.messageContainer,
        item.senderID === currentUserID ? styles.myMessage : styles.otherMessage,
      ]}
    >
      {item.senderID !== currentUserID && (
        item.senderAvatar && item.senderAvatar.trim() !== "" ? (
          <Image
            source={{ uri: item.senderAvatar }}
            style={styles.avatar}
            onError={(e) => console.log("Error loading avatar:", e.nativeEvent.error)}
          />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )
      )}
      <View
        style={[
          styles.messageBoxWrapper,
          item.senderID === currentUserID ? { flexDirection: "row-reverse" } : {},
        ]}
      >
        <View style={styles.messageBox}>
          {isForwarded && <Text style={styles.forwardedLabel}>Đã chuyển tiếp</Text>}
          {isRecalled ? (
            <Text style={styles.recalledMessage}>Tin nhắn đã được thu hồi</Text>
          ) : isDeletedForUser ? (
            <Text style={styles.recalledMessage}>Tin nhắn đã bị xóa</Text>
          ) : (
            <>
              {effectiveType === "type1" && (
                <Text style={styles.messageText}>{item.context || "Tin nhắn trống"}</Text>
              )}
              {effectiveType === "type2" && (
                item.context === "Đang tải..." ? (
                  <Text style={styles.loadingText}>Đang tải...</Text>
                ) : item.context && item.context.trim() !== "" ? (
                  <Image
                    source={{ uri: item.context }}
                    style={styles.image}
                    resizeMode="cover"
                    onError={(e) => console.log("Error loading image:", e.nativeEvent.error)}
                  />
                ) : (
                  <Text style={styles.errorText}>Không thể tải hình ảnh</Text>
                )
              )}
              {effectiveType === "type3" && (
                <View style={styles.videoContainer}>
                  {error ? (
                    <Text style={{ color: "red" }}>{error}</Text>
                  ) : videoUri && videoUri.trim() !== "" ? (
                    <Video
                      source={{ uri: videoUri }}
                      style={styles.video}
                      useNativeControls
                      onError={(e: any) => {
                        console.log("Error loading video:", e);
                        setError("Không thể phát video");
                      }}
                      onLoad={() => console.log("Video loaded successfully")}
                    />
                  ) : (
                    <Text>Không thể tải video</Text>
                  )}
                </View>
              )}
              {effectiveType === "type4" && (
                item.context && item.context.trim() !== "" ? (
                  <Image
                    source={{ uri: item.context }}
                    style={styles.sticker}
                    resizeMode="contain"
                    onError={(e) => console.log("Error loading sticker:", e.nativeEvent.error)}
                  />
                ) : (
                  <Text style={styles.errorText}>Không thể tải sticker</Text>
                )
              )}
              {effectiveType === "type5" && (
                item.context === "Đang tải..." ? (
                  <Text style={styles.loadingText}>Đang tải...</Text>
                ) : (
                  <TouchableOpacity onPress={() => handleFilePress(item.context || "")}>
                    <View style={styles.fileContainer}>
                      <Ionicons name="document-outline" size={24} color="#007AFF" />
                      <Text style={styles.fileText}>
                        File: {(item.context || "file").split("/").pop() || "Không xác định"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              )}
              {effectiveType === "type6" && (
                item.context === "Đang tải..." ? (
                  <Text style={styles.loadingText}>Đang tải...</Text>
                ) : item.context && item.context.trim() !== "" ? (
                  <TouchableOpacity onPress={handlePlayVoice}>
                    <View style={styles.voiceContainer}>
                      <Ionicons
                        name={isPlayingVoice ? "pause-circle" : "play-circle"}
                        size={24}
                        color="#007AFF"
                      />
                      <Text style={styles.voiceText}>Tin nhắn thoại</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.errorText}>Không thể tải tin nhắn thoại</Text>
                )
              )}
              {item.senderID === currentUserID && !item.recallStatus && !isDeletedForUser && (
                <Text style={styles.seenText}>
                  {item.seenStatus?.length && item.seenStatus.length > 1 ? "Đã xem" : "Đã gửi"}
                </Text>
              )}
            </>
          )}
        </View>
        {!isRecalled && !isDeletedForUser && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => setShowMessageOptions(true)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      {renderMessageOptions()}
    </View>
  );
};

const determineMessageType = (message: GroupMessage): string => {
  return message.messageTypeID || "type1";
};

export default function GroupChat() {
  const { groupID } = useLocalSearchParams<{ groupID?: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("Nhóm không tên");
  const [membersCount, setMembersCount] = useState<number>(0);
  const [memberAvatars, setMemberAvatars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroupName, setLoadingGroupName] = useState(true);
  const [markedAsSeen, setMarkedAsSeen] = useState<Set<string>>(new Set());
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<GiphySticker[]>([]);
  const [stickerSearchTerm, setStickerSearchTerm] = useState("funny");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessageID, setForwardMessageID] = useState<string | null>(null);
  const [selectedForwardItems, setSelectedForwardItems] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pinnedMessageID, setPinnedMessageID] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const GIPHY_API_KEY = "ahUloRbYoMUhR2aBUDO2iyNObLH8dnMa";

  const fetchStickers = async (term: string) => {
    try {
      const BASE_URL = "http://api.giphy.com/v1/stickers/search";
      const res = await fetch(`${BASE_URL}?api_key=${GIPHY_API_KEY}&q=${term}&limit=10`);
      const resJson = await res.json();
      setStickers(resJson.data);
    } catch (error) {
      console.error("Lỗi khi lấy sticker từ Giphy:", error);
    }
  };

  const fetchUserAvatar = async (userID: string): Promise<string> => {
    try {
      const response = await api.get(`/api/user/${userID}`);
      const userData = response.data;
      return userData.avatar || "https://randomuser.me/api/portraits/men/1.jpg";
    } catch (error) {
      console.error(`Lỗi khi lấy avatar của user ${userID}:`, error);
      return "https://randomuser.me/api/portraits/men/1.jpg";
    }
  };

  const fetchGroupDetails = async (userID: string, groupID: string) => {
    setLoadingGroupName(true);
    try {
      const userGroups = await fetchUserGroups(userID);
      const group = userGroups.find((g) => g.groupID === groupID);
      if (group) {
        setGroupName(group.groupName);
      } else {
        console.warn("Không tìm thấy nhóm với groupID:", groupID);
        setGroupName("Nhóm không tên");
      }

      const groupMembers = await fetchGroupMembers(groupID);
      setMembersCount(groupMembers.length || 0);

      const avatars: string[] = [];
      for (let i = 0; i < Math.min(4, groupMembers.length); i++) {
        const member = groupMembers[i];
        const avatar = await fetchUserAvatar(member.userID);
        avatars.push(avatar);
      }
      setMemberAvatars(avatars);
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết nhóm:", error);
      setGroupName("Nhóm không tên");
      Alert.alert(
        "Lỗi",
        "Không thể tải chi tiết nhóm. Vui lòng thử lại.",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Thử lại", onPress: () => fetchGroupDetails(userID, groupID) },
        ]
      );
    } finally {
      setLoadingGroupName(false);
    }
  };

  const loadForwardOptions = async (userID: string) => {
    try {
      const userContacts = await fetchContacts(userID);
      const userGroups = await fetchUserGroups(userID);
      setContacts(userContacts);
      setGroups(userGroups);
    } catch (error) {
      console.error("Lỗi khi tải danh sách liên hệ và nhóm:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách để chuyển tiếp. Vui lòng thử lại.");
    }
  };

  const saveMessageStatus = async (messageID: string, status: "deleted" | "recalled") => {
    try {
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      const statuses = existingStatuses ? JSON.parse(existingStatuses) : {};
      statuses[messageID] = status;
      await AsyncStorage.setItem("messageStatuses", JSON.stringify(statuses));
      console.log(`GroupChat.tsx: Saved message status - ${messageID}: ${status}`);
    } catch (error) {
      console.error("Lỗi khi lưu trạng thái tin nhắn:", error);
    }
  };

  const removeMessageStatus = async (messageID: string) => {
    try {
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      if (existingStatuses) {
        const statuses = JSON.parse(existingStatuses);
        delete statuses[messageID];
        await AsyncStorage.setItem("messageStatuses", JSON.stringify(statuses));
        console.log(`GroupChat.tsx: Removed message status for messageID: ${messageID}`);
      }
    } catch (error) {
      console.error("Lỗi khi xóa trạng thái tin nhắn:", error);
    }
  };

  const loadMessagesWithCache = async (groupID: string) => {
    try {
      const cacheKey = `groupMessages_${groupID}`;
      const statusKey = "messageStatuses";
      const cachedMessages = await AsyncStorage.getItem(cacheKey);
      const messageStatuses = await AsyncStorage.getItem(statusKey);
      const statuses = messageStatuses ? JSON.parse(messageStatuses) : {};

      const groupMessages = await fetchMessages(groupID, true);
      const messagesWithAvatars = await Promise.all(
        groupMessages.map(async (msg) => {
          const avatar = await fetchUserAvatar(msg.senderID);
          return { ...msg, senderAvatar: avatar };
        })
      );

      const updatedData = messagesWithAvatars
        .map((message) => {
          message.deleteStatusByUser = message.deleteStatusByUser || [];
          message.recallStatus = message.recallStatus || false;

          if (statuses[message.messageID!] === "recalled") {
            return null;
          }

          if (statuses[message.messageID!] === "deleted") {
            message.deleteStatusByUser = [...(message.deleteStatusByUser || []), currentUserID!];
          }

          return message;
        })
        .filter((message): message is GroupMessage => message !== null);

      setMessages(updatedData);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedData));
      console.log("GroupChat.tsx: Loaded messages from API, updated cache");
    } catch (error) {
      console.error("Lỗi khi lấy tin nhắn nhóm:", error);
      const cacheKey = `groupMessages_${groupID}`;
      const cachedMessages = await AsyncStorage.getItem(cacheKey);
      if (cachedMessages) {
        const parsedMessages = JSON.parse(cachedMessages).filter(
          (msg: GroupMessage) => !msg.recallStatus
        );
        setMessages(parsedMessages);
        console.log("GroupChat.tsx: Loaded messages from cache");
      }
      Alert.alert("Lỗi", "Không thể tải tin nhắn nhóm. Vui lòng thử lại.");
    }
  };

  const loadPinnedMessage = async (groupID: string) => {
    try {
      const pinnedID = await AsyncStorage.getItem(`pinnedMessage_group_${groupID}`);
      if (pinnedID) {
        setPinnedMessageID(pinnedID);
      }
    } catch (error) {
      console.error("Lỗi khi tải pinned message:", error);
    }
  };

  const savePinnedMessage = async (groupID: string, messageID: string | null) => {
    try {
      if (messageID) {
        await AsyncStorage.setItem(`pinnedMessage_group_${groupID}`, messageID);
      } else {
        await AsyncStorage.removeItem(`pinnedMessage_group_${groupID}`);
      }
    } catch (error) {
      console.error("Lỗi khi lưu pinned message:", error);
    }
  };

  const setupSocketListeners = useCallback(() => {
    const listeners = [
      {
        event: "receiveMessage",
        handler: async (message: Message) => {
          console.log("GroupChat.tsx: Received message:", message);
          if (message.groupID === groupID) {
            const avatar = await fetchUserAvatar(message.senderID);
            const messageWithAvatar = { ...message, senderAvatar: avatar };
            setMessages((prev) => {
              const exists = prev.some((msg) => msg.messageID === message.messageID);
              if (!exists) {
                return [...prev, messageWithAvatar];
              }
              return prev;
            });
            if (isAtBottom) {
              scrollToBottom(true);
            } else {
              setShowScrollButton(true);
            }
          }
        },
      },
      {
        event: "updateGroupChatSeenStatus",
        handler: (messageID: string, seenByUserID: string) => {
          console.log("GroupChat.tsx: Update seen status for messageID:", messageID);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageID === messageID
                ? { ...msg, seenStatus: [...(msg.seenStatus || []), seenByUserID] }
                : msg
            )
          );
        },
      },
      {
        event: "deletedGroupMessage",
        handler: (messageID: string) => {
          console.log("GroupChat.tsx: Tin nhắn đã bị xóa:", messageID);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageID === messageID
                ? { ...msg, deleteStatusByUser: [...(msg.deleteStatusByUser || []), currentUserID!] }
                : msg
            )
          );
          saveMessageStatus(messageID, "deleted");
        },
      },
      {
        event: "recalledGroupMessage",
        handler: (messageID: string) => {
          console.log("GroupChat.tsx: Tin nhắn đã được thu hồi:", messageID);
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID!));
          removeMessageStatus(messageID);
        },
      },
      {
        event: "newMember",
        handler: (userID: string) => {
          console.log("Thành viên mới tham gia nhóm:", userID);
          Alert.alert("Thông báo", `Thành viên mới ${userID} đã tham gia nhóm.`);
          fetchGroupDetails(currentUserID!, groupID as string);
        },
      },
      {
        event: "groupDeleted",
        handler: (deletedGroupID: string) => {
          console.log("Nhóm đã bị xóa:", deletedGroupID);
          if (deletedGroupID === groupID) {
            socket.emit("leaveGroup", groupID);
            Alert.alert("Thông báo", "Nhóm đã bị xóa.");
            router.replace("/home");
          }
        },
      },
      {
        event: "memberKicked",
        handler: ({ userID, groupID: kickedGroupID }: { userID: string; groupID: string }) => {
          console.log("Thành viên bị kick:", userID, "từ nhóm:", kickedGroupID);
          if (kickedGroupID === groupID) {
            if (userID === currentUserID) {
              socket.emit("leaveGroup", groupID);
              Alert.alert("Thông báo", "Bạn đã bị kick khỏi nhóm.");
              router.replace("/home");
            } else {
              fetchGroupDetails(currentUserID!, groupID as string);
            }
          }
        },
      },
      {
        event: "memberLeft",
        handler: ({ userID, groupID: leftGroupID }: { userID: string; groupID: string }) => {
          console.log("Thành viên rời nhóm:", userID, "từ nhóm:", leftGroupID);
          if (leftGroupID === groupID && userID !== currentUserID) {
            fetchGroupDetails(currentUserID!, groupID as string);
          }
        },
      },
      {
        event: "connect",
        handler: () => {
          console.log("GroupChat.tsx: Socket connected:", socket.id);
          if (currentUserID && groupID) {
            socket.emit("joinGroup", currentUserID, groupID, (response: string) => {
              console.log("GroupChat.tsx: Join group response:", response);
              if (response !== "Đã nhận") {
                Alert.alert("Lỗi", "Không thể tham gia nhóm. Vui lòng thử lại.");
              }
            });
          }
        },
      },
      {
        event: "disconnect",
        handler: (reason: string) => {
          console.log("GroupChat.tsx: Socket disconnected:", reason);
        },
      },
    ];

    registerSocketListeners(listeners);

    return () => {
      removeSocketListeners([
        "connect",
        "receiveMessage",
        "updateGroupChatSeenStatus",
        "deletedGroupMessage",
        "recalledGroupMessage",
        "newMember",
        "groupDeleted",
        "memberKicked",
        "memberLeft",
        "disconnect",
      ]);
    };
  }, [groupID, currentUserID, isAtBottom]);

  useEffect(() => {
    if (showStickerPicker) {
      fetchStickers(stickerSearchTerm);
    }
  }, [stickerSearchTerm, showStickerPicker]);

  useEffect(() => {
    const initializeSocketAndData = async () => {
      setLoading(true);

      try {
        await connectSocket();
      } catch (error) {
        console.error("Không thể kết nối socket:", error);
        Alert.alert("Lỗi", "Không thể kết nối tới server. Vui lòng thử lại sau.");
        setLoading(false);
        return;
      }

      const userData = await AsyncStorage.getItem("user");
      if (!userData) {
        console.error("Không tìm thấy user trong AsyncStorage");
        router.replace("/login");
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      const userIDValue = user.userID;
      if (!userIDValue) {
        console.error("currentUserID không hợp lệ:", userIDValue);
        router.replace("/login");
        setLoading(false);
        return;
      }
      setCurrentUserID(userIDValue);

      if (!groupID) {
        console.error("groupID không hợp lệ:", groupID);
        setLoading(false);
        return;
      }

      await fetchGroupDetails(userIDValue, groupID as string);
      await loadMessagesWithCache(groupID as string);
      await loadForwardOptions(userIDValue);
      await loadPinnedMessage(groupID as string);
      setupSocketListeners();
      setLoading(false);
    };

    initializeSocketAndData();

    return () => {
      removeSocketListeners([
        "receiveMessage",
        "updateGroupChatSeenStatus",
        "deletedGroupMessage",
        "recalledGroupMessage",
        "newMember",
        "groupDeleted",
        "memberKicked",
        "memberLeft",
        "connect",
        "disconnect",
      ]);
    };
  }, [groupID, setupSocketListeners]);

  useEffect(() => {
    if (currentUserID && messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) =>
          msg.groupID === groupID &&
          !msg.seenStatus?.includes(currentUserID) &&
          !markedAsSeen.has(msg.messageID || "")
      );
      console.log("GroupChat.tsx: Marking as seen:", unreadMessages.length, "messages");
      unreadMessages.forEach((msg) => {
        if (msg.messageID) {
          socket.emit("seenGroupMessage", msg.messageID, currentUserID, groupID, (response: SocketResponse) => {
            console.log("GroupChat.tsx: Seen response:", response);
            if (response === "Đã cập nhật seenStatus chat nhóm") {
              setMarkedAsSeen((prev) => new Set(prev).add(msg.messageID!));
            }
          });
        }
      });
    }
  }, [messages, currentUserID, groupID]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !groupID || !currentUserID) {
      console.log("GroupChat.tsx: Invalid input:", { inputText, groupID, currentUserID });
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      groupID: groupID as string,
      messageTypeID: "type1",
      context: inputText,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
      receiverID: undefined,
    };

    console.log("GroupChat.tsx: Sending message:", newMessage);

    try {
      socket.emit("sendMessage", newMessage, async (response: SocketResponse) => {
        console.log("GroupChat.tsx: Server response for sendMessage:", response);
        if (response === "Đã nhận") {
          const senderAvatar = await fetchUserAvatar(currentUserID);
          setMessages((prev) => [...prev, { ...newMessage, senderAvatar }]);
          setInputText("");
          if (isAtBottom) {
            scrollToBottom();
          } else {
            setShowScrollButton(true);
          }
        } else {
          console.log("GroupChat.tsx: Failed to send message, response:", response);
          Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
        }
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi tin nhắn nhóm:", error.message);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleSendSticker = async (stickerUrl: string) => {
    if (!stickerUrl.startsWith("https://")) {
      Alert.alert("Lỗi", "Sticker URL không hợp lệ.");
      return;
    }
    if (!groupID || !currentUserID) return;

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      groupID: groupID as string,
      messageTypeID: "type4",
      context: stickerUrl,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
      receiverID: undefined,
    };

    try {
      socket.emit("sendMessage", newMessage, async (response: SocketResponse) => {
        console.log("GroupChat.tsx: Server response for sendMessage:", response);
        if (response === "Đã nhận") {
          const senderAvatar = await fetchUserAvatar(currentUserID);
          setMessages((prev) => [...prev, { ...newMessage, senderAvatar }]);
          setShowStickerPicker(false);
          if (isAtBottom) {
            scrollToBottom();
          } else {
            setShowScrollButton(true);
          }
        } else {
          console.log("GroupChat.tsx: Failed to send sticker, response:", response);
          Alert.alert("Lỗi", "Không thể gửi sticker. Vui lòng thử lại.");
        }
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi sticker:", error.message);
      Alert.alert("Lỗi", "Không thể gửi sticker. Vui lòng thử lại.");
    }
  };

  const convertFileToBase64 = async (uri: string): Promise<string> => {
    const fileData = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileData;
  };

  const handleSendImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Quyền truy cập bị từ chối",
        "Ứng dụng cần quyền truy cập thư viện ảnh để gửi ảnh. Vui lòng cấp quyền trong cài đặt."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    if (!file || !groupID || !currentUserID) return;

    const fileUri = file.uri;
    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      groupID: groupID as string,
      messageTypeID: "type2",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
      receiverID: undefined,
    };

    const senderAvatar = await fetchUserAvatar(currentUserID);
    setMessages((prev) => [...prev, { ...tempMessage, senderAvatar }]);
    if (isAtBottom) {
      scrollToBottom();
    } else {
      setShowScrollButton(true);
    }

    try {
      const fileBase64 = await convertFileToBase64(fileUri);
      const newMessage: Message = {
        senderID: currentUserID,
        groupID: groupID as string,
        messageTypeID: "type2",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        receiverID: undefined,
        file: { name: `image-${Date.now()}.jpg`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("GroupChat.tsx: Server response for image:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi ảnh. Vui lòng thử lại.");
        }
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi ảnh:", error.message);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      Alert.alert("Lỗi", "Không thể gửi ảnh. Vui lòng thử lại.");
    }
  };

  const handleSendVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Quyền truy cập bị từ chối",
        "Ứng dụng cần quyền truy cập thư viện để gửi video. Vui lòng cấp quyền trong cài đặt."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    if (!file || !groupID || !currentUserID) return;

    const fileUri = file.uri;
    if (!fileUri.match(/\.(mp4|mov|avi)$/i)) {
      Alert.alert("Lỗi", "Chỉ hỗ trợ video định dạng .mp4, .mov, hoặc .avi.");
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      groupID: groupID as string,
      messageTypeID: "type3",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
      receiverID: undefined,
    };

    const senderAvatar = await fetchUserAvatar(currentUserID);
    setMessages((prev) => [...prev, { ...tempMessage, senderAvatar }]);
    if (isAtBottom) {
      scrollToBottom();
    } else {
      setShowScrollButton(true);
    }

    try {
      const fileBase64 = await convertFileToBase64(fileUri);
      const newMessage: Message = {
        senderID: currentUserID,
        groupID: groupID as string,
        messageTypeID: "type3",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        receiverID: undefined,
        file: { name: `video-${Date.now()}.mp4`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("GroupChat.tsx: Server response for video:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi video. Vui lòng thử lại.");
        }
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi video:", error.message);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      Alert.alert("Lỗi", "Không thể gửi video. Vui lòng thử lại.");
    }
  };

  const handleSendFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled) return;

    const file = result.assets[0];
    if (!file || !groupID || !currentUserID) return;

    const fileUri = file.uri;
    const fileName = file.name;
    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      groupID: groupID as string,
      messageTypeID: "type5",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
      receiverID: undefined,
    };

    const senderAvatar = await fetchUserAvatar(currentUserID);
    setMessages((prev) => [...prev, { ...tempMessage, senderAvatar }]);
    if (isAtBottom) {
      scrollToBottom();
    } else {
      setShowScrollButton(true);
    }

    try {
      const fileBase64 = await convertFileToBase64(fileUri);
      const newMessage: Message = {
        senderID: currentUserID,
        groupID: groupID as string,
        messageTypeID: "type5",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        receiverID: undefined,
        file: { name: fileName, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("GroupChat.tsx: Server response for file:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi file. Vui lòng thử lại.");
        }
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi file:", error.message);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      Alert.alert("Lỗi", "Không thể gửi file. Vui lòng thử lại.");
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) {
      console.log("Đang ghi âm, không thể bắt đầu phiên mới.");
      return;
    }

    if (recording) {
      try {
        const status = await recording.getStatusAsync();
        if (status.canRecord || status.isRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch (error) {
        console.error("Lỗi khi giải phóng recording cũ:", error);
      } finally {
        setRecording(null);
        setIsRecording(false);
      }
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Quyền truy cập bị từ chối",
          "Ứng dụng cần quyền truy cập micro để ghi âm. Vui lòng cấp quyền trong cài đặt."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error("Lỗi khi bắt đầu ghi âm:", error);
      Alert.alert("Lỗi", "Không thể bắt đầu ghi âm. Vui lòng thử lại.");
      setRecording(null);
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (!recording || !groupID || !currentUserID) {
      setIsRecording(false);
      setRecording(null);
      return;
    }

    let messageID: string | null = null;
    try {
      const status = await recording.getStatusAsync();
      if (status.isRecording) {
        await recording.stopAndUnloadAsync();
      }
      const uri = recording.getURI();

      if (!uri) {
        Alert.alert("Lỗi", "Không thể lấy file ghi âm.");
        setRecording(null);
        setIsRecording(false);
        return;
      }

      messageID = `${socket.id}-${Date.now()}`;
      const tempMessage: Message = {
        senderID: currentUserID,
        groupID: groupID as string,
        messageTypeID: "type6",
        context: "Đang tải...",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        receiverID: undefined,
      };

      const senderAvatar = await fetchUserAvatar(currentUserID);
      setMessages((prev) => [...prev, { ...tempMessage, senderAvatar }]);
      if (isAtBottom) {
        scrollToBottom();
      } else {
        setShowScrollButton(true);
      }

      const fileBase64 = await convertFileToBase64(uri);
      const newMessage: Message = {
        senderID: currentUserID,
        groupID: groupID as string,
        messageTypeID: "type6",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        receiverID: undefined,
        file: { name: `voice-${Date.now()}.m4a`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("GroupChat.tsx: Server response for voice:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi tin nhắn thoại. Vui lòng thử lại.");
        }
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi tin nhắn thoại:", error.message);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      Alert.alert("Lỗi", "Không thể gửi tin nhắn thoại. Vui lòng thử lại.");
    } finally {
      setRecording(null);
      setIsRecording(false);
    }
  };

  const handleDeleteMessage = async (messageID: string) => {
    if (!currentUserID || !messageID) return;

    try {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === messageID
            ? { ...msg, deleteStatusByUser: [...(msg.deleteStatusByUser || []), currentUserID] }
            : msg
        )
      );
      await saveMessageStatus(messageID, "deleted");
      await deleteMessage(messageID, currentUserID);
      Alert.alert("Thành công", "Đã xóa tin nhắn");
    } catch (error) {
      console.error("Lỗi khi xóa tin nhắn:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === messageID
            ? { ...msg, deleteStatusByUser: (msg.deleteStatusByUser || []).filter((id) => id !== currentUserID) }
            : msg
        )
      );
      Alert.alert("Lỗi", "Không thể xóa tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleRecallMessage = async (messageID: string) => {
    if (!currentUserID || !messageID) return;

    try {
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      await removeMessageStatus(messageID);
      await recallMessage(messageID, currentUserID);
      Alert.alert("Thành công", "Đã thu hồi tin nhắn");
    } catch (error) {
      console.error("Lỗi khi thu hồi tin nhắn:", error);
      Alert.alert("Lỗi", "Không thể thu hồi tin nhắn. Vui lòng thử lại.");
      await loadMessagesWithCache(groupID as string);
    }
  };

  const handleForwardMessage = (messageID: string) => {
    setForwardMessageID(messageID);
    setSelectedForwardItems([]);
    setShowForwardModal(true);
  };

  const handleSelectForwardItem = (id: string) => {
    setSelectedForwardItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleShareMessages = () => {
    if (!forwardMessageID || !currentUserID || selectedForwardItems.length === 0) {
      Alert.alert("Lỗi", "Vui lòng chọn ít nhất một người hoặc nhóm để chuyển tiếp.");
      return;
    }

    selectedForwardItems.forEach((id) => {
      const isGroup = groups.some((g) => g.groupID === id);
      socket.emit(
        "shareMessage",
        {
          messageID: forwardMessageID,
          sharerID: currentUserID,
          receiverID: isGroup ? null : id,
          groupID: isGroup ? id : null,
        },
        (response: string) => {
          console.log("GroupChat.tsx: Server response for shareMessage to", id, ":", response);
          if (response !== "Đã nhận") {
            Alert.alert("Lỗi", `Không thể chuyển tiếp đến ${isGroup ? "nhóm" : "người"} ${id}: ${response}`);
          }
        }
      );
    });

    Alert.alert("Thành công", "Đã chuyển tiếp tin nhắn!");
    setShowForwardModal(false);
    setForwardMessageID(null);
    setSelectedForwardItems([]);
  };

  const handlePinMessage = async (messageID: string) => {
    try {
      setPinnedMessageID(messageID);
      await savePinnedMessage(groupID as string, messageID);
      Alert.alert("Thành công", "Đã ghim tin nhắn!");
    } catch (error) {
      console.error("Lỗi khi ghim tin nhắn:", error);
      Alert.alert("Lỗi", "Không thể ghim tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleUnpinMessage = async () => {
    try {
      setPinnedMessageID(null);
      await savePinnedMessage(groupID as string, null);
      Alert.alert("Thành công", "Đã bỏ ghim tin nhắn!");
    } catch (error) {
      console.error("Lỗi khi bỏ ghim tin nhắn:", error);
      Alert.alert("Lỗi", "Không thể bỏ ghim tin nhắn. Vui lòng thử lại.");
    }
  };

  const scrollToBottom = useCallback((animated = true) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated });
    }
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const paddingToBottom = 20;
    const currentIsAtBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < paddingToBottom;
    setIsAtBottom(currentIsAtBottom);
    setShowScrollButton(!currentIsAtBottom);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      if (isAtBottom) {
        scrollToBottom(true);
      } else {
        setShowScrollButton(true);
      }
    }
  }, [messages.length, isAtBottom, scrollToBottom]);

  const renderItem = useCallback(
    ({ item }: { item: GroupMessage }) => (
      <MessageItem
        item={item}
        currentUserID={currentUserID}
        onDeleteMessage={handleDeleteMessage}
        onRecallMessage={handleRecallMessage}
        onForwardMessage={handleForwardMessage}
        onPinMessage={handlePinMessage}
      />
    ),
    [currentUserID]
  );

  const renderPinnedMessage = () => {
    if (!pinnedMessageID) return null;
    const pinnedMessage = messages.find((msg) => msg.messageID === pinnedMessageID);
    if (!pinnedMessage || pinnedMessage.recallStatus || pinnedMessage.deleteStatusByUser?.includes(currentUserID!)) {
      setPinnedMessageID(null);
      savePinnedMessage(groupID as string, null);
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.pinnedMessageContainer}
        onPress={handleUnpinMessage}
      >
        <Text style={styles.pinnedMessageLabel}>Tin nhắn đã ghim</Text>
        <Text style={styles.pinnedMessageText}>
          {pinnedMessage.context.length > 50
            ? pinnedMessage.context.substring(0, 50) + "..."
            : pinnedMessage.context}
        </Text>
        <View style={styles.unpinButton}>
          <Ionicons name="pin-outline" size={16} color="#007AFF" />
          <Text style={styles.unpinButtonText}>Bỏ ghim</Text>
        </View>
      </TouchableOpacity>
    );
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
      <View style={[styles.navbar, { paddingTop: Platform.OS === "ios" ? insets.top : 10, paddingBottom: 10 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.groupNameContainer}
          onPress={() => router.push({ pathname: "/group_detail", params: { groupID } })}
        >
          <View style={styles.groupAvatarContainer}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarRow}>
                {memberAvatars[0] && (
                  <Image
                    source={{ uri: memberAvatars[0] }}
                    style={[styles.groupAvatar, { zIndex: 4 }]}
                    onError={(e) => console.log("Error loading avatar 0:", e.nativeEvent.error)}
                  />
                )}
                {memberAvatars[1] && (
                  <Image
                    source={{ uri: memberAvatars[1] }}
                    style={[styles.groupAvatar, { marginLeft: -15, zIndex: 3 }]}
                    onError={(e) => console.log("Error loading avatar 1:", e.nativeEvent.error)}
                  />
                )}
              </View>
              <View style={[styles.avatarRow, { marginTop: -15 }]}>
                {memberAvatars[2] && (
                  <Image
                    source={{ uri: memberAvatars[2] }}
                    style={[styles.groupAvatar, { zIndex: 2 }]}
                    onError={(e) => console.log("Error loading avatar 2:", e.nativeEvent.error)}
                  />
                )}
                {memberAvatars[3] && (
                  <Image
                    source={{ uri: memberAvatars[3] }}
                    style={[styles.groupAvatar, { marginLeft: -15, zIndex: 1 }]}
                    onError={(e) => console.log("Error loading avatar 3:", e.nativeEvent.error)}
                  />
                )}
              </View>
            </View>
            <View style={[styles.membersCountBadge, { marginLeft: -15, zIndex: 0 }]}>
              <Text style={styles.membersCountText}>
                {membersCount >= 9 ? "9+" : membersCount}
              </Text>
            </View>
          </View>
          <View style={styles.groupInfo}>
            {loadingGroupName ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.groupName}>{groupName}</Text>
                <View style={styles.groupDetails}>
                  <Ionicons name="people-outline" size={16} color="#fff" style={styles.groupDetailIcon} />
                  <Text style={styles.groupDetailText}>{membersCount} thành viên</Text>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="call-outline" size={24} color="#fff" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="videocam-outline" size={24} color="#fff" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({ pathname: "/group_detail", params: { groupID } })}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderPinnedMessage()}
      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.messageID || item.createdAt || `message-${Math.random().toString()}`}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 10,
            paddingTop: pinnedMessageID ? 110 + insets.top : 10 + insets.top,
            paddingBottom: 20,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          initialNumToRender={15}
          windowSize={5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
        />
        {showScrollButton && (
          <TouchableOpacity
            style={styles.scrollButton}
            onPress={() => {
              scrollToBottom(true);
              setShowScrollButton(false);
            }}
          >
            <View style={styles.scrollButtonInner}>
              <Ionicons name="arrow-down" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity onPress={() => setShowStickerPicker(true)}>
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSendImage}>
          <Ionicons name="image-outline" size={24} color="#666" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSendVideo}>
          <Ionicons name="videocam-outline" size={24} color="#666" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSendFile}>
          <Ionicons name="document-outline" size={24} color="#666" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
        <TouchableOpacity
          onPressIn={handleStartRecording}
          onPressOut={handleStopRecording}
        >
          <Ionicons
            name={isRecording ? "mic-off" : "mic"}
            size={24}
            color={isRecording ? "#FF3B30" : "#666"}
            style={{ marginLeft: 10 }}
          />
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

      <Modal
        visible={showStickerPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStickerPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.stickerPicker}>
            <TextInput
              style={styles.stickerSearchInput}
              placeholder="Tìm kiếm sticker..."
              value={stickerSearchTerm}
              onChangeText={setStickerSearchTerm}
            />
            <FlatList
              data={stickers}
              keyExtractor={(item) => item.id}
              numColumns={3}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSendSticker(item.images.original.url)}>
                  <Image
                    source={{ uri: item.images.original.url }}
                    style={styles.stickerThumbnail}
                    resizeMode="contain"
                  />
                </Pressable>
              )}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowStickerPicker(false)}>
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showForwardModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowForwardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.forwardModalContent}>
            <Text style={styles.modalTitle}>Chuyển tiếp đến</Text>
            <FlatList
              data={[
                ...contacts.map((c) => ({ type: "contact" as const, data: c })),
                ...groups.map((g) => ({ type: "group" as const, data: g })),
              ].slice(0, 50)}
              keyExtractor={(item: ForwardItem) =>
                item.type === "contact" ? `contact-${item.data.userID}` : `group-${item.data.groupID}`
              }
              renderItem={({ item }: { item: ForwardItem }) => {
                const id = item.type === "contact" ? item.data.userID : item.data.groupID;
                const isSelected = selectedForwardItems.includes(id);
                return (
                  <Pressable
                    style={styles.forwardItem}
                    onPress={() => handleSelectForwardItem(id)}
                  >
                    <Ionicons
                      name={isSelected ? "checkbox-outline" : "square-outline"}
                      size={24}
                      color={isSelected ? "#007AFF" : "#666"}
                      style={{ marginRight: 10 }}
                    />
                    {item.type === "contact" && item.data.avatar ? (
                      <Image
                        source={{ uri: item.data.avatar }}
                        style={styles.forwardAvatar}
                      />
                    ) : (
                      <View style={styles.forwardAvatarPlaceholder} />
                    )}
                    <Text style={styles.forwardItemText}>
                      {item.type === "contact" ? item.data.username : item.data.groupName}
                      {item.type === "contact" && item.data.userID === currentUserID ? " (Bạn)" : ""}
                    </Text>
                  </Pressable>
                );
              }}
              style={{ maxHeight: "60%" }}
            />
            <View style={styles.forwardButtonContainer}>
              <Pressable
                style={[styles.closeButton, { backgroundColor: "#FF3B30" }]}
                onPress={() => setShowForwardModal(false)}
              >
                <Text style={styles.closeButtonText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={styles.closeButton}
                onPress={handleShareMessages}
              >
                <Text style={styles.closeButtonText}>Chuyển</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
    zIndex: 1000,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
    }),
  },
  groupNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  groupAvatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  avatarWrapper: {
    width: 60,
    height: 60,
    position: "relative",
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fff",
  },
  membersCountBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  membersCountText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  groupInfo: {
    marginLeft: 10,
    justifyContent: "center",
  },
  groupName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  groupDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  groupDetailIcon: {
    marginRight: 5,
  },
  groupDetailText: {
    color: "#fff",
    fontSize: 14,
  },
  icon: {
    marginHorizontal: 10,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  myMessage: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  otherMessage: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
    marginRight: 10,
  },
  messageBoxWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  messageBox: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    maxWidth: "80%",
  },
  messageText: {
    fontSize: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },
  seenText: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
  },
  recalledMessage: {
    fontStyle: "italic",
    color: "#666",
  },
  forwardedLabel: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  sticker: {
    width: 100,
    height: 100,
    marginVertical: 5,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 5,
  },
  videoContainer: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 5,
  },
  video: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  fileText: {
    fontSize: 16,
    color: "#007AFF",
    marginLeft: 10,
  },
  voiceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },
  voiceText: {
    fontSize: 16,
    color: "#007AFF",
    marginLeft: 10,
  },
  errorText: {
    fontSize: 14,
    color: "red",
    fontStyle: "italic",
  },
  optionsButton: {
    padding: 10,
    marginHorizontal: 5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginHorizontal: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  forwardModalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  forwardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    width: "100%",
  },
  forwardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  forwardAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ddd",
    marginRight: 10,
  },
  forwardItemText: {
    fontSize: 16,
    flex: 1,
  },
  forwardButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  messageOptionsContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "80%",
    maxWidth: 300,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  stickerPicker: {
    backgroundColor: "#fff",
    height: "50%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  stickerSearchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  stickerThumbnail: {
    width: 80,
    height: 80,
    margin: 5,
  },
  closeButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    width: "45%",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  pinnedMessageContainer: {
    backgroundColor: "#e5e5ea",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    zIndex: 999,
  },
  pinnedMessageLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
  },
  pinnedMessageText: {
    fontSize: 14,
    color: "#000",
    marginVertical: 5,
  },
  unpinButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  unpinButtonText: {
    fontSize: 12,
    color: "#007AFF",
    marginLeft: 5,
  },
  chatContainer: {
    flex: 1,
    position: "relative",
  },
  scrollButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 1000,
  },
  scrollButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});