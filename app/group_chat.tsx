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
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMessages, Message } from "../services/message";
import {
  fetchUserGroups,
  fetchGroupMembers,
  GroupMember,
  Group,
} from "../services/group";
import { fetchContacts, Contact } from "../services/contacts";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Audio, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import socket, {
  connectSocket,
  deleteMessage,
  recallMessage,
  registerSocketListeners,
  removeSocketListeners,
  joinGroup,
  joinGroupRoom,
} from "../services/socket";
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
  isDelivered?: boolean;
};

type ForwardItem =
  | { type: "contact"; data: Contact }
  | { type: "group"; data: Group };

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

  const isDeletedForUser = item.deleteStatusByUser?.includes(
    currentUserID || ""
  );
  const isRecalled = item.recallStatus;

  const statusText = () => {
    const othersSeen = item.seenStatus?.filter((id) => id !== currentUserID) || [];
    if (othersSeen.length > 0) {
      return `Đã xem (${othersSeen.length})`;
    }
    if ((item.seenStatus?.length || 0) > 0) {
      return "Đã nhận";
    }
    if (item.isDelivered || (item.messageID && item.messageID.includes('-'))) {
      return "Đã nhận";
    }
    return "Đã gửi";
  };

  return (
    <View
      style={[
        styles.messageContainer,
        item.senderID === currentUserID
          ? styles.myMessage
          : styles.otherMessage,
      ]}
    >
      {item.senderID !== currentUserID &&
        (item.senderAvatar && item.senderAvatar.trim() !== "" ? (
          <Image
            source={{ uri: item.senderAvatar }}
            style={styles.avatar}
            onError={(e) =>
              console.log("Error loading avatar:", e.nativeEvent.error)
            }
          />
        ) : (
          <View style={styles.avatarPlaceholder} />
        ))}
      <View
        style={[
          styles.messageBoxWrapper,
          item.senderID === currentUserID
            ? { flexDirection: "row-reverse" }
            : {},
        ]}
      >
        <View style={styles.messageBox}>
          {isForwarded && (
            <Text style={styles.forwardedLabel}>Đã chuyển tiếp</Text>
          )}
          {isRecalled ? (
            <Text style={styles.recalledMessage}>Tin nhắn đã được thu hồi</Text>
          ) : isDeletedForUser ? (
            <Text style={styles.recalledMessage}>Tin nhắn đã bị xóa</Text>
          ) : (
            <>
              {effectiveType === "type1" && (
                <Text style={styles.messageText}>
                  {item.context || "Tin nhắn trống"}
                </Text>
              )}
              {effectiveType === "type2" &&
                (item.context === "Đang tải..." ? (
                  <Text style={styles.loadingText}>Đang tải...</Text>
                ) : item.context && item.context.trim() !== "" ? (
                  <Image
                    source={{ uri: item.context }}
                    style={styles.image}
                    resizeMode="cover"
                    onError={(e) =>
                      console.log("Error loading image:", e.nativeEvent.error)
                    }
                  />
                ) : (
                  <Text style={styles.errorText}>Không thể tải hình ảnh</Text>
                ))}
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
              {effectiveType === "type4" &&
                (item.context && item.context.trim() !== "" ? (
                  <Image
                    source={{ uri: item.context }}
                    style={styles.sticker}
                    resizeMode="contain"
                    onError={(e) =>
                      console.log("Error loading sticker:", e.nativeEvent.error)
                    }
                  />
                ) : (
                  <Text style={styles.errorText}>Không thể tải sticker</Text>
                ))}
              {effectiveType === "type5" &&
                (item.context === "Đang tải..." ? (
                  <Text style={styles.loadingText}>Đang tải...</Text>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleFilePress(item.context || "")}
                  >
                    <View style={styles.fileContainer}>
                      <Ionicons
                        name="document-outline"
                        size={24}
                        color="#007AFF"
                      />
                      <Text style={styles.fileText}>
                        File:{" "}
                        {(item.context || "file").split("/").pop() ||
                          "Không xác định"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              {effectiveType === "type6" &&
                (item.context === "Đang tải..." ? (
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
                  <Text style={styles.errorText}>
                    Không thể tải tin nhắn thoại
                  </Text>
                ))}
              {item.senderID === currentUserID &&
                !item.recallStatus &&
                !isDeletedForUser && (
                  <Text style={styles.seenText}>{statusText()}</Text>
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
  const [selectedForwardItems, setSelectedForwardItems] = useState<string[]>(
    []
  );
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

  const avatarCache = useRef<Map<string, string>>(new Map()).current;

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
    if (
      context &&
      (context.startsWith("http://") || context.startsWith("https://"))
    ) {
      return context;
    }
    if (context && context.startsWith(uploadsPath)) {
      const fileName = context.split(/[\\/]/).pop();
      return `${process.env.EXPO_PUBLIC_API_URL}/Uploads/${fileName}`;
    }
    return context;
  };

  const fetchStickers = async (term: string) => {
    try {
      const BASE_URL = "http://api.giphy.com/v1/stickers/search";
      const res = await fetch(
        `${BASE_URL}?api_key=${GIPHY_API_KEY}&q=${term}&limit=10`
      );
      const resJson = await res.json();
      setStickers(resJson.data);
    } catch (error) {
      console.error("Lỗi khi lấy sticker từ Giphy:", error);
    }
  };

  const fetchUserAvatar = async (userID: string): Promise<string> => {
    if (avatarCache.has(userID)) {
      return avatarCache.get(userID)!;
    }
    try {
      const response = await api.get(`/api/user/${userID}`);
      const userData = response.data;
      let avatar = "https://randomuser.me/api/portraits/men/1.jpg";
      if (userData && userData.avatar && userData.avatar.trim() !== "") {
        avatar = userData.avatar;
      }
      avatarCache.set(userID, avatar);
      return avatar;
    } catch (error) {
      console.error(`Lỗi khi lấy avatar của user ${userID}:`, error);
      const defaultAvatar = "https://randomuser.me/api/portraits/men/1.jpg";
      avatarCache.set(userID, defaultAvatar);
      return defaultAvatar;
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
      Alert.alert("Lỗi", "Không thể tải chi tiết nhóm. Vui lòng thử lại.", [
        { text: "Hủy", style: "cancel" },
        { text: "Thử lại", onPress: () => fetchGroupDetails(userID, groupID) },
      ]);
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
      Alert.alert(
        "Lỗi",
        "Không thể tải danh sách để chuyển tiếp. Vui lòng thử lại."
      );
    }
  };

  const saveMessageStatus = async (
    messageID: string,
    status: "deleted" | "recalled"
  ) => {
    try {
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      const statuses = existingStatuses ? JSON.parse(existingStatuses) : {};
      statuses[messageID] = status;
      await AsyncStorage.setItem("messageStatuses", JSON.stringify(statuses));
      console.log(
        `GroupChat.tsx: Saved message status - ${messageID}: ${status}`
      );
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
        console.log(
          `GroupChat.tsx: Removed message status for messageID: ${messageID}`
        );
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
          if (
            msg.messageTypeID === "type2" ||
            msg.messageTypeID === "type3" ||
            msg.messageTypeID === "type5" ||
            msg.messageTypeID === "type6"
          ) {
            msg.context = convertFilePathToURL(msg.context);
          }
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
            message.deleteStatusByUser = [
              ...(message.deleteStatusByUser || []),
              currentUserID!,
            ];
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
      const pinnedID = await AsyncStorage.getItem(
        `pinnedMessage_group_${groupID}`
      );
      if (pinnedID) {
        setPinnedMessageID(pinnedID);
      }
    } catch (error) {
      console.error("Lỗi khi tải pinned message:", error);
    }
  };

  const savePinnedMessage = async (
    groupID: string,
    messageID: string | null
  ) => {
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

  const checkGroupMembership = async (
    userID: string,
    groupID: string
  ): Promise<boolean> => {
    try {
      const groupMembers = await fetchGroupMembers(groupID);
      return groupMembers.some((member) => member.userID === userID);
    } catch (error) {
      console.error("Lỗi khi kiểm tra thành viên nhóm:", error);
      return false;
    }
  };

  const sendMessage = async (
    newMessage: Message,
    onSuccess?: () => void,
    onFailure?: (error: any) => void
  ) => {
    const messageExists = messages.some(
      (msg) => msg.messageID === newMessage.messageID
    );
    if (messageExists) {
      console.log(
        "GroupChat.tsx: Message already sent, skipping:",
        newMessage.messageID
      );
      return;
    }

    try {
      if (!socket.connected) {
        console.log(
          "GroupChat.tsx: Socket not connected, attempting to reconnect..."
        );
        await connectSocket();
      }

      const senderAvatar = await fetchUserAvatar(currentUserID!);
      setMessages((prev) => [...prev, { ...newMessage, senderAvatar }]);
      if (isAtBottom) {
        scrollToBottom();
      } else {
        setShowScrollButton(true);
      }

      return new Promise<void>((resolve, reject) => {
        socket.emit("sendMessage", newMessage, async (response: SocketResponse) => {
          console.log("GroupChat.tsx: Server response:", response);
          if (response === "Đã nhận" || response === "tin nhắn đã tồn tại") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageID === newMessage.messageID
                  ? { ...msg, isDelivered: true }
                  : msg
              )
            );
            await loadMessagesWithCache(groupID as string);
            if (onSuccess) onSuccess();
            resolve();
          } else {
            console.log("GroupChat.tsx: Failed to send message, response:", response);
            reject(new Error(response));
          }
        });
      });
    } catch (error: any) {
      console.error("Error sending message:", error.message);
      setMessages((prev) =>
        prev.filter((msg) => msg.messageID !== newMessage.messageID)
      );
      Alert.alert("Lỗi", `Không thể gửi tin nhắn: ${error.message}`);
      if (onFailure) onFailure(error);
    }
  };

  const setupSocketListeners = () => {
    const listeners = [
      {
        event: "connect",
        handler: async () => {
          console.log("GroupChat.tsx: Socket connected:", socket.id);
          try {
            if (currentUserID && groupID) {
              await joinGroup(currentUserID, groupID as string);
              console.log("GroupChat.tsx: Successfully joined group:", groupID);
              const response = await joinGroupRoom(groupID as string);
              console.log("GroupChat.tsx: Join group room response:", response);
            }
          } catch (error: any) {
            console.error(
              "GroupChat.tsx: Failed to join group or room:",
              error.message
            );
            Alert.alert(
              "Lỗi",
              "Không thể tham gia nhóm hoặc phòng nhóm. Vui lòng thử lại."
            );
            router.back();
          }
        },
      },
      {
        event: "disconnect",
        handler: (reason: string) => {
          console.log("GroupChat.tsx: Socket disconnected:", reason);
        },
      },
      {
        event: "receiveMessage",
        handler: async (message: GroupMessage) => {
          console.log("GroupChat.tsx: Received message:", message);
          if (message.groupID === groupID) {
            const messageExists = messages.some(
              (m) => m.messageID === message.messageID
            );
            if (messageExists) {
              console.log(
                "GroupChat.tsx: Message already exists, skipping:",
                message.messageID
              );
              return;
            }

            if (
              message.messageTypeID === "type2" ||
              message.messageTypeID === "type3" ||
              message.messageTypeID === "type5" ||
              message.messageTypeID === "type6"
            ) {
              message.context = convertFilePathToURL(message.context);
            }

            const senderAvatar = await fetchUserAvatar(message.senderID);
            const newMessage = { ...message, senderAvatar, isDelivered: true };

            setMessages((prev) => {
              const updatedMessages = [...prev, newMessage];
              if (isAtBottom) {
                scrollToBottom();
              } else {
                setShowScrollButton(true);
              }
              return updatedMessages;
            });

            await AsyncStorage.setItem(
              `groupMessages_${groupID}`,
              JSON.stringify([...messages, newMessage])
            );

            socket.emit("updateUnreadCount", {
              groupID,
              userID: currentUserID,
            });
          }
        },
      },
      {
        event: "updateGroupChatSeenStatus",
        handler: (messageID: string, seenUserID: string) => {
          console.log("GroupChat.tsx: Update seen status:", messageID, seenUserID, "currentUserID:", currentUserID);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageID === messageID
                ? {
                    ...msg,
                    seenStatus: [...new Set([...(msg.seenStatus || []), seenUserID])],
                  }
                : msg
            )
          );
        },
      },
      {
        event: "deletedGroupMessage",
        handler: (data: { messageID: string; userID: string }) => {
          console.log("GroupChat.tsx: Message deleted:", data);
          if (data.userID !== currentUserID) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageID === data.messageID
                  ? {
                      ...msg,
                      deleteStatusByUser: [
                        ...(msg.deleteStatusByUser || []),
                        data.userID,
                      ],
                    }
                  : msg
              )
            );
          }
        },
      },
      {
        event: "recalledGroupMessage",
        handler: (data: { messageID: string; userID: string }) => {
          console.log("GroupChat.tsx: Message recalled:", data);
          setMessages((prev) =>
            prev.filter((msg) => msg.messageID !== data.messageID)
          );
          removeMessageStatus(data.messageID);
        },
      },
    ];

    registerSocketListeners(listeners);

    return () => {
      removeSocketListeners([
        "connect",
        "disconnect",
        "receiveMessage",
        "updateGroupChatSeenStatus",
        "deletedGroupMessage",
        "recalledGroupMessage",
      ]);
    };
  };

  const initializeSocketAndData = async () => {
    setLoading(true);

    try {
      if (!socket.connected) {
        await connectSocket();
        console.log("GroupChat.tsx: Socket connected successfully");
      }
    } catch (error: any) {
      console.error("Không thể kết nối socket:", error.message);
      Alert.alert(
        "Lỗi",
        "Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng hoặc liên hệ hỗ trợ.",
        [
          { text: "OK", onPress: () => router.back() },
          { text: "Thử lại", onPress: () => initializeSocketAndData() },
        ]
      );
      setLoading(false);
      return;
    }

    const userData = await AsyncStorage.getItem("user");
    console.log("GroupChat.tsx: Raw userData from AsyncStorage:", userData);
    if (!userData) {
      console.error("Không tìm thấy user trong AsyncStorage");
      Alert.alert(
        "Lỗi",
        "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
      );
      router.replace("/login");
      setLoading(false);
      return;
    }

    const user = JSON.parse(userData);
    console.log("GroupChat.tsx: Parsed user object:", user);
    const userIDValue = user?.userID;
    console.log("GroupChat.tsx: Extracted userIDValue:", userIDValue);
    if (
      !userIDValue ||
      typeof userIDValue !== "string" ||
      userIDValue.trim() === ""
    ) {
      console.error("currentUserID không hợp lệ:", userIDValue);
      Alert.alert(
        "Lỗi",
        "Thông tin người dùng không hợp lệ. Vui lòng đăng nhập lại."
      );
      await AsyncStorage.removeItem("user");
      router.replace("/login");
      setLoading(false);
      return;
    }
    setCurrentUserID(userIDValue);

    if (!groupID || typeof groupID !== "string" || groupID.trim() === "") {
      console.error("groupID không hợp lệ:", groupID);
      Alert.alert("Lỗi", "Không thể tải nhóm chat. Vui lòng thử lại.");
      router.back();
      setLoading(false);
      return;
    }

    const isMember = await checkGroupMembership(userIDValue, groupID);
    if (!isMember) {
      console.error("User không phải là thành viên của nhóm");
      Alert.alert("Lỗi", "Bạn không phải là thành viên của nhóm này");
      router.back();
      setLoading(false);
      return;
    }

    try {
      console.log("GroupChat.tsx: Joining group:", {
        userID: userIDValue,
        groupID,
      });
      await joinGroup(userIDValue, groupID);
      console.log("GroupChat.tsx: Successfully joined group:", groupID);
    } catch (error: any) {
      if (error.message === "user đã là thành viên của nhóm này") {
        console.log("GroupChat.tsx: User is already a member of the group");
      } else {
        console.error("Lỗi khi tham gia vào nhóm:", error.message);
        Alert.alert("Lỗi", "Không thể tham gia vào nhóm. Vui lòng thử lại.");
        setLoading(false);
        return;
      }
    }

    await fetchGroupDetails(userIDValue, groupID);
    await loadMessagesWithCache(groupID);
    await loadForwardOptions(userIDValue);
    await loadPinnedMessage(groupID);
    setLoading(false);
  };

  useEffect(() => {
    if (showStickerPicker) {
      fetchStickers(stickerSearchTerm);
    }
  }, [stickerSearchTerm, showStickerPicker]);

  useEffect(() => {
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
  }, [groupID]);

  useEffect(() => {
    if (socket) {
      const cleanup = setupSocketListeners();
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [socket, groupID, currentUserID, messages, isAtBottom]); // Thêm messages và isAtBottom vào dependencies

  useEffect(() => {
    const markMessagesAsSeen = async () => {
      if (!currentUserID || !groupID || messages.length === 0) return;

      const unreadMessages = messages.filter(
        (msg) =>
          msg.groupID === groupID &&
          !msg.seenStatus?.includes(currentUserID) &&
          !markedAsSeen.has(msg.messageID || "")
      );

      if (unreadMessages.length > 0) {
        for (const msg of unreadMessages) {
          if (msg.messageID) {
            socket.emit(
              "seenMessage",
              msg.messageID,
              currentUserID,
              (response: SocketResponse) => {
                if (response === "Đã cập nhật seenStatus chat nhóm") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.messageID === msg.messageID
                        ? {
                            ...m,
                            seenStatus: [
                              ...(m.seenStatus || []),
                              currentUserID,
                            ],
                            unread: false,
                          }
                        : m
                    )
                  );
                  setMarkedAsSeen((prev) => new Set(prev).add(msg.messageID!));
                  socket.emit("updateUnreadCount", {
                    groupID,
                    userID: currentUserID,
                  });
                }
              }
            );
          }
        }

        await AsyncStorage.setItem(
          `lastSeen_${groupID}`,
          new Date().toISOString()
        );
      }
    };

    markMessagesAsSeen();
  }, [currentUserID, groupID, messages]);

  useEffect(() => {
    if (socket && groupID) {
      socket.emit("joinGroupRoom", groupID);
      console.log("FE: joinGroupRoom", groupID);
    }
  }, [socket, groupID]);

  useEffect(() => {
    if (!currentUserID || !groupID) return;

    // Lắng nghe các sự kiện cập nhật nhóm
    const handleGroupUpdate = () => {
      fetchGroupDetails(currentUserID, groupID);
    };

    // Thành viên mới được thêm vào nhóm
    socket.on("newMember", (userID: string) => {
      handleGroupUpdate();
    });

    // Thành viên bị kick khỏi nhóm
    socket.on("memberKicked", ({ userID, groupID: kickedGroupID }: { userID: string; groupID: string }) => {
      if (kickedGroupID === groupID) {
        handleGroupUpdate();
      }
    });

    // Thành viên rời nhóm
    socket.on("memberLeft", ({ userID, groupID: leftGroupID }: { userID: string; groupID: string }) => {
      if (leftGroupID === groupID) {
        handleGroupUpdate();
      }
    });

    // Đổi tên nhóm
    socket.on("groupRenamed", ({ groupID: renamedGroupID, newGroupName }: { groupID: string; newGroupName: string }) => {
      if (renamedGroupID === groupID) {
        setGroupName(newGroupName);
        handleGroupUpdate();
      }
    });

    // Nhóm bị xóa
    socket.on("groupDeleted", (deletedGroupID: string) => {
      if (deletedGroupID === groupID) {
        Alert.alert("Thông báo", "Nhóm đã bị xóa.");
        router.replace("/home");
      }
    });

    return () => {
      socket.off("newMember");
      socket.off("memberKicked");
      socket.off("memberLeft");
      socket.off("groupRenamed");
      socket.off("groupDeleted");
    };
  }, [currentUserID, groupID]);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUserID && groupID) {
        fetchGroupDetails(currentUserID, groupID);
      }
    }, [currentUserID, groupID])
  );

  const handleSendMessage = async () => {
    if (loading) {
      Alert.alert("Thông báo", "Đang tải dữ liệu, vui lòng đợi...");
      return;
    }

    if (!inputText.trim() || !groupID || !currentUserID) {
      console.log("GroupChat.tsx: Invalid input:", {
        inputText,
        groupID,
        currentUserID,
      });
      Alert.alert(
        "Lỗi",
        "Không thể gửi tin nhắn: Thông tin không hợp lệ. Vui lòng đăng nhập lại."
      );
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      groupID: groupID,
      messageTypeID: "type1",
      context: inputText,
      messageID: messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    try {
      await sendMessage(
        newMessage,
        () => setInputText(""),
        (error) => {
          setMessages((prev) =>
            prev.filter((msg) => msg.messageID !== messageID)
          );
          Alert.alert("Lỗi", `Không thể gửi tin nhắn: ${error.message}`, [
            { text: "Hủy", style: "cancel" },
            {
              text: "Thử lại",
              onPress: () => {
                setInputText(newMessage.context);
                handleSendMessage();
              },
            },
          ]);
        }
      );
    } catch (error: any) {
      console.error("Lỗi khi gửi tin nhắn nhóm:", error.message);
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
      receiverID: null,
      groupID: groupID as string,
      messageTypeID: "type4",
      context: stickerUrl,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    try {
      await sendMessage(
        newMessage,
        () => setShowStickerPicker(false),
        (error) => {
          Alert.alert("Lỗi", `Không thể gửi sticker: ${error.message}`);
        }
      );
    } catch (error: any) {
      console.error("Lỗi khi gửi sticker:", error.message);
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
      receiverID: null,
      groupID: groupID as string,
      messageTypeID: "type2",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

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
        file: { name: `image-${Date.now()}.jpg`, data: fileBase64 },
      };

      await sendMessage(newMessage, undefined, (error) => {
        setMessages((prev) =>
          prev.filter((msg) => msg.messageID !== messageID)
        );
        Alert.alert("Lỗi", `Không thể gửi ảnh: ${error.message}`);
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi ảnh:", error.message);
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
      receiverID: null,
      groupID: groupID as string,
      messageTypeID: "type3",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

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
        file: { name: `video-${Date.now()}.mp4`, data: fileBase64 },
      };

      await sendMessage(newMessage, undefined, (error) => {
        setMessages((prev) =>
          prev.filter((msg) => msg.messageID !== messageID)
        );
        Alert.alert("Lỗi", `Không thể gửi video: ${error.message}`);
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi video:", error.message);
    }
  };

  const handleSendFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const file = result.assets[0];
    if (!file || !groupID || !currentUserID) return;

    const fileUri = file.uri;
    const fileName = file.name;
    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      receiverID: null,
      groupID: groupID as string,
      messageTypeID: "type5",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

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
        file: { name: fileName, data: fileBase64 },
      };

      await sendMessage(newMessage, undefined, (error) => {
        setMessages((prev) =>
          prev.filter((msg) => msg.messageID !== messageID)
        );
        Alert.alert("Lỗi", `Không thể gửi file: ${error.message}`);
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi file:", error.message);
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
      await newRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
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
        receiverID: null,
        groupID: groupID as string,
        messageTypeID: "type6",
        context: "Đang tải...",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
      };

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
        file: { name: `voice-${Date.now()}.m4a`, data: fileBase64 },
      };

      await sendMessage(newMessage, undefined, (error) => {
        setMessages((prev) =>
          prev.filter((msg) => msg.messageID !== messageID)
        );
        Alert.alert("Lỗi", `Không thể gửi tin nhắn thoại: ${error.message}`);
      });
    } catch (error: any) {
      console.error("Lỗi khi gửi tin nhắn thoại:", error.message);
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
            ? {
                ...msg,
                deleteStatusByUser: [
                  ...(msg.deleteStatusByUser || []),
                  currentUserID,
                ],
              }
            : msg
        )
      );
      await saveMessageStatus(messageID, "deleted");
      await deleteMessage(messageID, currentUserID);
      const updatedMessages = messages.map((msg) =>
        msg.messageID === messageID
          ? {
              ...msg,
              deleteStatusByUser: [
                ...(msg.deleteStatusByUser || []),
                currentUserID,
              ],
            }
          : msg
      );
      await AsyncStorage.setItem(
        `groupMessages_${groupID}`,
        JSON.stringify(updatedMessages)
      );
      Alert.alert("Thành công", "Đã xóa tin nhắn");
    } catch (error) {
      console.error("Lỗi khi xóa tin nhắn:", error);
      Alert.alert("Lỗi", "Không thể xóa tin nhắn. Vui lòng thử lại.");
      await loadMessagesWithCache(groupID as string);
    }
  };

  const handleRecallMessage = async (messageID: string) => {
    if (!currentUserID || !messageID) return;

    try {
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      await removeMessageStatus(messageID);
      await recallMessage(messageID, currentUserID);
      const updatedMessages = messages.filter(
        (msg) => msg.messageID !== messageID
      );
      await AsyncStorage.setItem(
        `groupMessages_${groupID}`,
        JSON.stringify(updatedMessages)
      );
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
    if (
      !forwardMessageID ||
      !currentUserID ||
      selectedForwardItems.length === 0
    ) {
      Alert.alert(
        "Lỗi",
        "Vui lòng chọn ít nhất một người hoặc nhóm để chuyển tiếp."
      );
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
          console.log(
            "GroupChat.tsx: Server response for shareMessage to",
            id,
            ":",
            response
          );
          if (response !== "Đã nhận") {
            Alert.alert(
              "Lỗi",
              `Không thể chuyển tiếp đến ${
                isGroup ? "nhóm" : "người"
              } ${id}: ${response}`
            );
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

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const paddingToBottom = 20;
      const currentIsAtBottom =
        contentSize.height - contentOffset.y - layoutMeasurement.height <
        paddingToBottom;
      setIsAtBottom(currentIsAtBottom);
      setShowScrollButton(!currentIsAtBottom);
    },
    []
  );

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
    const pinnedMessage = messages.find(
      (msg) => msg.messageID === pinnedMessageID
    );
    if (
      !pinnedMessage ||
      pinnedMessage.recallStatus ||
      pinnedMessage.deleteStatusByUser?.includes(currentUserID!)
    ) {
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

  // Thêm state cho tìm kiếm
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.navbar,
          {
            paddingTop: Platform.OS === "ios" ? insets.top : 10,
            paddingBottom: 10,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.groupNameContainer}
          onPress={() =>
            router.push({ pathname: "/group_detail", params: { groupID } })
          }
        >
          <View style={styles.groupAvatarContainer}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarRow}>
                {memberAvatars[0] && (
                  <Image
                    source={{ uri: memberAvatars[0] }}
                    style={[styles.groupAvatar, { zIndex: 4 }]}
                    onError={(e) =>
                      console.log(
                        "Error loading avatar 0:",
                        e.nativeEvent.error
                      )
                    }
                  />
                )}
                {memberAvatars[1] && (
                  <Image
                    source={{ uri: memberAvatars[1] }}
                    style={[styles.groupAvatar, { marginLeft: -15, zIndex: 3 }]}
                    onError={(e) =>
                      console.log(
                        "Error loading avatar 1:",
                        e.nativeEvent.error
                      )
                    }
                  />
                )}
              </View>
              <View style={[styles.avatarRow, { marginTop: -15 }]}>
                {memberAvatars[2] && (
                  <Image
                    source={{ uri: memberAvatars[2] }}
                    style={[styles.groupAvatar, { zIndex: 2 }]}
                    onError={(e) =>
                      console.log(
                        "Error loading avatar 2:",
                        e.nativeEvent.error
                      )
                    }
                  />
                )}
                {memberAvatars[3] && (
                  <Image
                    source={{ uri: memberAvatars[3] }}
                    style={[styles.groupAvatar, { marginLeft: -15, zIndex: 1 }]}
                    onError={(e) =>
                      console.log(
                        "Error loading avatar 3:",
                        e.nativeEvent.error
                      )
                    }
                  />
                )}
              </View>
            </View>
          </View>
          <View style={styles.groupInfo}>
            {loadingGroupName ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.groupName}>{groupName}</Text>
                <View style={styles.groupDetails}>
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color="#fff"
                    style={styles.groupDetailIcon}
                  />
                  <Text style={styles.groupDetailText}>
                    {membersCount} thành viên
                  </Text>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons
            name="call-outline"
            size={24}
            color="#fff"
            style={styles.icon}
          />
        </TouchableOpacity>
        {/* Thay nút videocam bằng search */}
        <TouchableOpacity onPress={() => setShowSearch((v) => !v)}>
          <Ionicons name="search-outline" size={24} color="#fff" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: "/group_detail", params: { groupID } })
          }
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderPinnedMessage()}
      <View style={styles.chatContainer}>
        {showSearch && (
          <View style={{ backgroundColor: '#fff', padding: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 16, color: '#222' }}
              placeholder="Tìm kiếm tin nhắn..."
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              placeholderTextColor="#aaa"
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText("")}
                style={{ marginLeft: 4, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={searchText ? messages.filter(m => (typeof m.context === 'string' && m.context.toLowerCase().includes(searchText.toLowerCase()))) : messages}
          keyExtractor={(item, index) => item.messageID ?? `${item.createdAt}-${index}`}
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
          <Ionicons
            name="image-outline"
            size={24}
            color="#666"
            style={{ marginLeft: 10 }}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSendVideo}>
          <Ionicons
            name="videocam-outline"
            size={24}
            color="#666"
            style={{ marginLeft: 10 }}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSendFile}>
          <Ionicons
            name="document-outline"
            size={24}
            color="#666"
            style={{ marginLeft: 10 }}
          />
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
                <Pressable
                  onPress={() => handleSendSticker(item.images.original.url)}
                >
                  <Image
                    source={{ uri: item.images.original.url }}
                    style={styles.stickerThumbnail}
                    resizeMode="contain"
                  />
                </Pressable>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowStickerPicker(false)}
            >
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
                item.type === "contact"
                  ? `contact-${item.data.userID}`
                  : `group-${item.data.groupID}`
              }
              renderItem={({ item }: { item: ForwardItem }) => {
                const id =
                  item.type === "contact"
                    ? item.data.userID
                    : item.data.groupID;
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
                      {item.type === "contact"
                        ? item.data.username
                        : item.data.groupName}
                      {item.type === "contact" &&
                      item.data.userID === currentUserID
                        ? " (Bạn)"
                        : ""}
                    </Text>
                  </Pressable>
                );
              }}
              style={{ maxHeight: "60%" }}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#FF3B30" }]}
                onPress={() => setShowForwardModal(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#007AFF" }]}
                onPress={handleShareMessages}
              >
                <Text style={styles.modalButtonText}>Gửi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 10,
  },
  groupNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  groupAvatarContainer: {
    flexDirection: "column",
    alignItems: "center",
  },
  avatarWrapper: {
    flexDirection: "column",
  },
  avatarRow: {
    flexDirection: "row",
  },
  groupAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#fff",
  },
  membersCountBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  membersCountText: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  groupInfo: {
    marginLeft: 10,
  },
  groupName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  groupDetails: {
    flexDirection: "row",
    alignItems: "center",
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
  chatContainer: {
    flex: 1,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 5,
    alignItems: "flex-end",
  },
  myMessage: {
    justifyContent: "flex-end",
  },
  otherMessage: {
    justifyContent: "flex-start",
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
    backgroundColor: "#ccc",
    marginRight: 10,
  },
  messageBoxWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "80%",
  },
  messageBox: {
    backgroundColor: "#E5E5EA",
    borderRadius: 15,
    padding: 10,
  },
  messageText: {
    fontSize: 16,
    color: "#000",
  },
  seenText: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    textAlign: "right",
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  videoContainer: {
    width: 200,
    height: 200,
    borderRadius: 10,
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  sticker: {
    width: 100,
    height: 100,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#007AFF",
  },
  voiceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  voiceText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#007AFF",
  },
  recalledMessage: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  forwardedLabel: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 5,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 14,
    color: "red",
    fontStyle: "italic",
  },
  optionsButton: {
    padding: 5,
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  messageOptionsContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    width: "80%",
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  optionText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#000",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F5F5F5",
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  stickerPicker: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "50%",
  },
  stickerSearchInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  stickerThumbnail: {
    width: 100,
    height: 100,
    margin: 5,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  forwardModalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  forwardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
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
    backgroundColor: "#ccc",
    marginRight: 10,
  },
  forwardItemText: {
    fontSize: 16,
    color: "#000",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  pinnedMessageContainer: {
    backgroundColor: "#E5E5EA",
    padding: 10,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pinnedMessageLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#007AFF",
  },
  pinnedMessageText: {
    fontSize: 14,
    color: "#000",
    flex: 1,
    marginHorizontal: 10,
  },
  unpinButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  unpinButtonText: {
    fontSize: 14,
    color: "#007AFF",
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollButton: {
    position: "absolute",
    bottom: 80,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
    padding: 5,
  },
  scrollButtonInner: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
