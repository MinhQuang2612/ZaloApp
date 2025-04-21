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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchMessages, sendMessage, Message } from "../services/message";
import { fetchUserByID, fetchContacts, Contact } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Audio, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import socket, { connectSocket, deleteMessage, recallMessage, registerSocketListeners, removeSocketListeners } from "../services/socket";
import { fetchUserGroups, Group } from "../services/group";

type SocketResponse =
  | "đang gửi"
  | "đã nhận"
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

type ForwardItem = { type: "contact"; data: Contact } | { type: "group"; data: Group };

const MessageItem = ({
  item,
  currentUserID,
  userID,
  onDeleteMessage,
  onRecallMessage,
  onForwardMessage,
  onPinMessage,
}: {
  item: Message;
  currentUserID: string | null;
  userID: string | undefined;
  onDeleteMessage: (messageID: string) => void;
  onRecallMessage: (messageID: string) => void;
  onForwardMessage: (messageID: string) => void;
  onPinMessage: (messageID: string) => void;
}) => {
  const effectiveType = determineMessageType(item);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [receiverAvatar, setReceiverAvatar] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const loadReceiverAvatar = async () => {
      if (userID) {
        try {
          const receiverData = await fetchUserByID(userID);
          setReceiverAvatar(receiverData?.avatar || null);
        } catch (error) {
          console.error("Lỗi khi lấy avatar người nhận:", error);
          setReceiverAvatar(null);
        }
      }
    };

    loadReceiverAvatar();
  }, [userID]);

  useEffect(() => {
    if (effectiveType === "type3" && item.context && item.context !== "Đang tải...") {
      setVideoUri(item.context);
    } else {
      setVideoUri(null);
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
    if (!url) return;
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

  return (
    <View
      style={[
        styles.messageContainer,
        item.senderID === currentUserID ? styles.myMessage : styles.otherMessage,
      ]}
    >
      {item.senderID !== currentUserID && (
        receiverAvatar && receiverAvatar.trim() !== "" ? (
          <Image
            source={{ uri: receiverAvatar }}
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
          {item.recallStatus ? (
            <Text style={styles.recalledMessage}>Tin nhắn đã được thu hồi</Text>
          ) : item.deleteStatusByUser?.includes(currentUserID!) ? (
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
            </>
          )}
          {item.senderID === currentUserID && !item.recallStatus && !item.deleteStatusByUser?.includes(currentUserID!) && (
            <Text style={styles.seenText}>
              {item.seenStatus?.includes(userID!) ? "Đã xem" : "Đã gửi"}
            </Text>
          )}
        </View>
        {!item.recallStatus && !item.deleteStatusByUser?.includes(currentUserID!) && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => {
              console.log("Chat.tsx: Pressed options button for messageID:", item.messageID);
              setShowMessageOptions(true);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      {renderMessageOptions()}
    </View>
  );
};

const determineMessageType = (message: Message): string => {
  return message.messageTypeID || "type1";
};

export default function Chat() {
  const { userID } = useLocalSearchParams<{ userID?: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string>("Đang tải...");
  const [loading, setLoading] = useState(true);
  const [markedAsSeen, setMarkedAsSeen] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessageID, setForwardMessageID] = useState<string | null>(null);
  const [selectedForwardItems, setSelectedForwardItems] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pinnedMessageID, setPinnedMessageID] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<GiphySticker[]>([]);
  const [stickerSearchTerm, setStickerSearchTerm] = useState("funny");
  const insets = useSafeAreaInsets();
  const GIPHY_API_KEY = "ahUloRbYoMUhR2aBUDO2iyNObLH8dnMa";

  // Load pinned message from AsyncStorage
  const loadPinnedMessage = async (chatID: string) => {
    try {
      const pinnedID = await AsyncStorage.getItem(`pinnedMessage_${chatID}`);
      if (pinnedID) {
        setPinnedMessageID(pinnedID);
      }
    } catch (error) {
      console.error("Lỗi khi tải pinned message:", error);
    }
  };

  // Save pinned message to AsyncStorage
  const savePinnedMessage = async (chatID: string, messageID: string | null) => {
    try {
      if (messageID) {
        await AsyncStorage.setItem(`pinnedMessage_${chatID}`, messageID);
      } else {
        await AsyncStorage.removeItem(`pinnedMessage_${chatID}`);
      }
    } catch (error) {
      console.error("Lỗi khi lưu pinned message:", error);
    }
  };

  // Thêm hàm removeMessageStatus để xóa trạng thái tin nhắn khỏi AsyncStorage
  const removeMessageStatus = async (messageID: string) => {
    try {
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      if (existingStatuses) {
        const statuses = JSON.parse(existingStatuses);
        delete statuses[messageID];
        await AsyncStorage.setItem("messageStatuses", JSON.stringify(statuses));
        console.log(`Chat.tsx: Removed message status for messageID: ${messageID}`);
      }
    } catch (error) {
      console.error("Lỗi khi xóa trạng thái tin nhắn:", error);
    }
  };

  useEffect(() => {
    return () => {
      const cleanupRecording = async () => {
        if (recording) {
          try {
            const status = await recording.getStatusAsync();
            if (status.canRecord || status.isRecording) {
              await recording.stopAndUnloadAsync();
            }
          } catch (error) {
            console.error("Lỗi khi cleanup recording:", error);
          } finally {
            setRecording(null);
            setIsRecording(false);
          }
        }
      };

      cleanupRecording();
    };
  }, [recording]);

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

  useEffect(() => {
    if (showStickerPicker) {
      fetchStickers(stickerSearchTerm);
    }
  }, [stickerSearchTerm, showStickerPicker]);

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

  const loadContactsAndGroups = async (userID: string) => {
    try {
      const contactsData = await fetchContacts(userID);
      setContacts(contactsData);
      const groupsData = await fetchUserGroups(userID);
      setGroups(groupsData);
    } catch (error) {
      console.error("Lỗi khi tải danh bạ và nhóm:", error);
      Alert.alert("Lỗi", "Không thể tải danh bạ hoặc nhóm. Vui lòng thử lại.");
    }
  };

  const setupSocketListeners = useCallback(() => {
    const listeners = [
      {
        event: "receiveMessage",
        handler: (message: Message) => {
          console.log("Chat.tsx: Received message:", message);
          if (
            (message.senderID === userID && message.receiverID === currentUserID) ||
            (message.senderID === currentUserID && message.receiverID === userID)
          ) {
            setMessages((prev) => {
              const existingIndex = prev.findIndex((msg) => msg.messageID === message.messageID);
              if (existingIndex !== -1) {
                const updatedMessages = [...prev];
                if (
                  message.messageTypeID === "type2" ||
                  message.messageTypeID === "type3" ||
                  message.messageTypeID === "type5" ||
                  message.messageTypeID === "type6"
                ) {
                  message.context = convertFilePathToURL(message.context);
                }
                updatedMessages[existingIndex] = message;
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                return updatedMessages;
              } else {
                if (
                  message.messageTypeID === "type2" ||
                  message.messageTypeID === "type3" ||
                  message.messageTypeID === "type5" ||
                  message.messageTypeID === "type6"
                ) {
                  message.context = convertFilePathToURL(message.context);
                }
                const newMessages = [...prev, message];
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                return newMessages;
              }
            });
          }
        },
      },
      {
        event: "updateSingleChatSeenStatus",
        handler: (messageID: string) => {
          console.log("Chat.tsx: Received updateSingleChatSeenStatus for messageID:", messageID);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              msg.messageID === messageID
                ? { ...msg, seenStatus: [...(msg.seenStatus || []), userID!], unread: false }
                : msg
            );
            return [...updatedMessages];
          });
        },
      },
      {
        event: "deletedSingleMessage",
        handler: (data: { messageID: string; userID: string }) => {
          console.log("Chat.tsx: Received deletedSingleMessage for messageID:", data.messageID, "by userID:", data.userID);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageID === data.messageID
                ? {
                    ...msg,
                    deleteStatusByUser: [...(msg.deleteStatusByUser || []), data.userID],
                  }
                : msg
            )
          );
          saveMessageStatus(data.messageID, "deleted");
        },
      },
      {
        event: "recalledSingleMessage",
        handler: (messageID: string) => {
          console.log("Chat.tsx: Received recalledSingleMessage for messageID:", messageID);
          // Xóa tin nhắn khỏi danh sách messages
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          // Xóa trạng thái tin nhắn khỏi AsyncStorage
          removeMessageStatus(messageID);
        },
      },
      {
        event: "connect",
        handler: () => {
          console.log("Chat.tsx: Socket connected:", socket.id);
          socket.emit("joinUserRoom", currentUserID);
          socket.emit("joinUserRoom", userID);
          console.log("Chat.tsx: Joined rooms:", currentUserID, userID);
        },
      },
      {
        event: "disconnect",
        handler: (reason: string) => {
          console.log("Chat.tsx: Socket disconnected:", reason);
        },
      },
    ];

    registerSocketListeners(listeners);

    return () => {
      console.log("Chat.tsx: Cleaning up socket listeners");
      removeSocketListeners([
        "connect",
        "receiveMessage",
        "updateSingleChatSeenStatus",
        "deletedSingleMessage",
        "recalledSingleMessage",
        "disconnect",
      ]);
    };
  }, [currentUserID, userID]);

  const saveMessageStatus = async (messageID: string, status: "deleted" | "recalled") => {
    try {
      const existingStatuses = await AsyncStorage.getItem("messageStatuses");
      const statuses = existingStatuses ? JSON.parse(existingStatuses) : {};
      statuses[messageID] = status;
      await AsyncStorage.setItem("messageStatuses", JSON.stringify(statuses));
      console.log(`Chat.tsx: Saved message status - ${messageID}: ${status}`);
    } catch (error) {
      console.error("Lỗi khi lưu trạng thái tin nhắn:", error);
    }
  };

  const loadMessagesWithCache = async (targetUserID: string) => {
    try {
      const cacheKey = `messages_${targetUserID}`;
      const statusKey = "messageStatuses";
      const cachedMessages = await AsyncStorage.getItem(cacheKey);
      const messageStatuses = await AsyncStorage.getItem(statusKey);
      const statuses = messageStatuses ? JSON.parse(messageStatuses) : {};

      // Fetch messages from API
      const data = await fetchMessages(targetUserID);
      const updatedData = data
        .map((message) => {
          if (
            message.messageTypeID === "type2" ||
            message.messageTypeID === "type3" ||
            message.messageTypeID === "type5" ||
            message.messageTypeID === "type6"
          ) {
            message.context = convertFilePathToURL(message.context);
          }
          message.deleteStatusByUser = message.deleteStatusByUser || [];
          message.recallStatus = message.recallStatus || false;

          // Loại bỏ tin nhắn đã bị thu hồi
          if (statuses[message.messageID!] === "recalled") {
            return null;
          }

          // Apply status from AsyncStorage if exists
          if (statuses[message.messageID!] === "deleted") {
            message.deleteStatusByUser = [...(message.deleteStatusByUser || []), currentUserID!];
          }

          return message;
        })
        .filter((message): message is Message => message !== null); // Loại bỏ các message null

      // Update cache and state
      setMessages(updatedData);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedData));
      console.log("Chat.tsx: Loaded messages from API, updated cache");
    } catch (error) {
      console.error("Lỗi khi lấy tin nhắn:", error);
      // Fallback to cached messages if API fails
      const cacheKey = `messages_${targetUserID}`;
      const cachedMessages = await AsyncStorage.getItem(cacheKey);
      if (cachedMessages) {
        const parsedMessages = JSON.parse(cachedMessages).filter(
          (msg: Message) => !msg.recallStatus
        );
        setMessages(parsedMessages);
        console.log("Chat.tsx: Loaded messages from cache");
      }
    }
  };

  useEffect(() => {
    const initializeSocketAndData = async () => {
      setLoading(true);

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

      if (!userID) {
        console.error("userID không hợp lệ:", userID);
        setLoading(false);
        return;
      }

      try {
        const receiverData = await fetchUserByID(userID);
        setReceiverName(receiverData?.username || "Người dùng chưa xác định");
      } catch (error) {
        console.error("Lỗi khi lấy thông tin người dùng:", error);
      }

      await loadMessagesWithCache(userID);
      await loadContactsAndGroups(userIDValue);
      await loadPinnedMessage(userID); // Load pinned message
      await connectSocket();
      setupSocketListeners();
      setLoading(false);
    };

    initializeSocketAndData();

    return () => {
      removeSocketListeners([
        "connect",
        "receiveMessage",
        "updateSingleChatSeenStatus",
        "deletedSingleMessage",
        "recalledSingleMessage",
        "disconnect",
      ]);
    };
  }, [userID, setupSocketListeners]);

  useEffect(() => {
    if (currentUserID && messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) =>
          msg.receiverID === currentUserID &&
          !msg.seenStatus?.includes(currentUserID) &&
          !markedAsSeen.has(msg.messageID || "")
      );
      console.log("Chat.tsx: Marking as seen:", unreadMessages.length, "messages");
      unreadMessages.forEach((msg) => {
        if (msg.messageID && !markedAsSeen.has(msg.messageID)) {
          socket.emit("seenMessage", msg.messageID, currentUserID, (response: SocketResponse) => {
            console.log("Chat.tsx: Seen response for messageID:", msg.messageID, "response:", response);
            if (response === "Đã cập nhật seenStatus chat đơn") {
              setMarkedAsSeen((prev) => new Set(prev).add(msg.messageID!));
            }
          });
        }
      });
    }
  }, [messages, currentUserID]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !userID || !currentUserID) {
      console.log("Input invalid:", { inputText, userID, currentUserID });
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type1",
      context: inputText,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    console.log("Chat.tsx: Sending message:", newMessage);
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
      console.log("Chat.tsx: Server response for text message:", response);
      if (response !== "Đã nhận") {
        console.log("Chat.tsx: Message failed, response:", response);
        Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
      }
    });
  };

  const handleDeleteMessage = async (messageID: string) => {
    try {
      if (!currentUserID) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === messageID
            ? { ...msg, deleteStatusByUser: [...(msg.deleteStatusByUser || []), currentUserID] }
            : msg
        )
      );
      await saveMessageStatus(messageID, "deleted");
      await deleteMessage(messageID, currentUserID);
      console.log("Chat.tsx: Deleted messageID:", messageID);
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
    try {
      if (!currentUserID) return;
      console.log("Chat.tsx: Attempting to recall messageID:", messageID);
      // Xóa tin nhắn khỏi danh sách messages ngay lập tức
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      // Xóa trạng thái tin nhắn khỏi AsyncStorage
      await removeMessageStatus(messageID);
      // Gửi yêu cầu thu hồi đến server
      await recallMessage(messageID, currentUserID);
      console.log("Chat.tsx: Recalled messageID:", messageID);
      Alert.alert("Thành công", "Đã thu hồi tin nhắn");
    } catch (error) {
      console.error("Lỗi khi thu hồi tin nhắn:", error);
      // Hoàn tác nếu có lỗi: tải lại danh sách tin nhắn từ cache hoặc server
      Alert.alert("Lỗi", "Không thể thu hồi tin nhắn. Vui lòng thử lại.");
      await loadMessagesWithCache(userID!);
    }
  };

  const handleForwardMessage = (messageID: string) => {
    console.log("Chat.tsx: Opening forward modal for messageID:", messageID);
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

    console.log("Chat.tsx: Sharing messageID:", forwardMessageID, "to:", selectedForwardItems);

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
          console.log("Chat.tsx: Server response for shareMessage to", id, ":", response);
          if (response !== "Đã nhận") {
            console.error("Chat.tsx: Share message failed for", id, "response:", response);
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
      console.log("Chat.tsx: Pinning messageID:", messageID);
      setPinnedMessageID(messageID);
      await savePinnedMessage(userID!, messageID);
      Alert.alert("Thành công", "Đã ghim tin nhắn!");
    } catch (error) {
      console.error("Lỗi khi ghim tin nhắn:", error);
      Alert.alert("Lỗi", "Không thể ghim tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleUnpinMessage = async () => {
    try {
      setPinnedMessageID(null);
      await savePinnedMessage(userID!, null);
      Alert.alert("Thành công", "Đã bỏ ghim tin nhắn!");
    } catch (error) {
      console.error("Lỗi khi bỏ ghim tin nhắn:", error);
      Alert.alert("Lỗi", "Không thể bỏ ghim tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleSendSticker = async (stickerUrl: string) => {
    if (!stickerUrl.startsWith("https://")) {
      Alert.alert("Lỗi", "Sticker URL không hợp lệ.");
      return;
    }
    if (!userID || !currentUserID) return;

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type4",
      context: stickerUrl,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setShowStickerPicker(false);

    socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
      console.log("Chat.tsx: Server response for sticker:", response);
      if (response !== "Đã nhận") {
        setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
        Alert.alert("Lỗi", "Không thể gửi sticker. Vui lòng thử lại.");
      }
    });
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
    if (!file || !userID || !currentUserID) return;

    const fileUri = file.uri;
    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type2",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const fileBase64 = await convertFileToBase64(fileUri);
      const newMessage: Message = {
        senderID: currentUserID,
        receiverID: userID,
        messageTypeID: "type2",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        file: { name: `image-${Date.now()}.jpg`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Chat.tsx: Server response for image:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi ảnh. Vui lòng thử lại.");
        }
      });
    } catch (error) {
      console.error("Lỗi khi gửi ảnh:", error);
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
    if (!file || !userID || !currentUserID) return;

    const fileUri = file.uri;
    if (!fileUri.match(/\.(mp4|mov|avi)$/i)) {
      Alert.alert("Lỗi", "Chỉ hỗ trợ video định dạng .mp4, .mov, hoặc .avi.");
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type3",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const fileBase64 = await convertFileToBase64(fileUri);
      const newMessage: Message = {
        senderID: currentUserID,
        receiverID: userID,
        messageTypeID: "type3",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        file: { name: `video-${Date.now()}.mp4`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Chat.tsx: Server response for video:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi video. Vui lòng thử lại.");
        }
      });
    } catch (error) {
      console.error("Lỗi khi gửi video:", error);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      Alert.alert("Lỗi", "Không thể gửi video. Vui lòng thử lại.");
    }
  };

  const handleSendFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled) return;

    const file = result.assets[0];
    if (!file || !userID || !currentUserID) return;

    const fileUri = file.uri;
    const fileName = file.name;
    const messageID = `${socket.id}-${Date.now()}`;
    const tempMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type5",
      context: "Đang tải...",
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
      deleteStatusByUser: [],
      recallStatus: false,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const fileBase64 = await convertFileToBase64(fileUri);
      const newMessage: Message = {
        senderID: currentUserID,
        receiverID: userID,
        messageTypeID: "type5",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        file: { name: fileName, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Chat.tsx: Server response for file:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi file. Vui lòng thử lại.");
        }
      });
    } catch (error) {
      console.error("Lỗi khi gửi file:", error);
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
    if (!recording || !userID || !currentUserID) {
      setIsRecording(false);
      setRecording(null);
      return;
    }

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

      const messageID = `${socket.id}-${Date.now()}`;
      const tempMessage: Message = {
        senderID: currentUserID,
        receiverID: userID,
        messageTypeID: "type6",
        context: "Đang tải...",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
      };

      setMessages((prev) => [...prev, tempMessage]);

      const fileBase64 = await convertFileToBase64(uri);
      const newMessage: Message = {
        senderID: currentUserID,
        receiverID: userID,
        messageTypeID: "type6",
        context: "",
        messageID,
        createdAt: new Date().toISOString(),
        seenStatus: [],
        deleteStatusByUser: [],
        recallStatus: false,
        file: { name: `voice-${Date.now()}.m4a`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Chat.tsx: Server response for voice:", response);
        if (response !== "Đã nhận") {
          setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
          Alert.alert("Lỗi", "Không thể gửi tin nhắn thoại. Vui lòng thử lại.");
        }
      });
    } catch (error) {
      console.error("Lỗi khi dừng ghi âm:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn thoại. Vui lòng thử lại.");
      setMessages((prev) =>
        prev.filter((msg) => msg.messageID !== `${socket.id}-${Date.now()}`)
      );
    } finally {
      setRecording(null);
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageItem
        item={item}
        currentUserID={currentUserID}
        userID={userID}
        onDeleteMessage={handleDeleteMessage}
        onRecallMessage={handleRecallMessage}
        onForwardMessage={handleForwardMessage}
        onPinMessage={handlePinMessage}
      />
    ),
    [currentUserID, userID]
  );

  const getItemLayout = (data: ArrayLike<Message> | null | undefined, index: number) => ({
    length: 100,
    offset: 100 * index,
    index,
  });

  const renderPinnedMessage = () => {
    if (!pinnedMessageID) return null;
    const pinnedMessage = messages.find((msg) => msg.messageID === pinnedMessageID);
    if (!pinnedMessage || pinnedMessage.recallStatus || pinnedMessage.deleteStatusByUser?.includes(currentUserID!)) {
      setPinnedMessageID(null); // Clear invalid pinned message
      savePinnedMessage(userID!, null);
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
      <View style={[styles.navbar, { paddingTop: insets.top, paddingBottom: 8, zIndex: 1000 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
        onPress={() => router.push({ pathname: "/user_profile", params: { userID } })}
      >
        <Text style={styles.username}>{receiverName}</Text>
      </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="call-outline" size={24} color="#fff" style={{ marginLeft: 150 }} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="videocam-outline" size={27} color="#fff" style={{ marginLeft: 20 }}/>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="menu" size={27} color="#fff" style={{ marginLeft: 20 }}/>
        </TouchableOpacity>
      </View>

      {renderPinnedMessage()}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.messageID || item.createdAt || `message-${index}`}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: 10,
          paddingTop: pinnedMessageID ? 110 + insets.top : 10 + insets.top,
        }}
        initialNumToRender={10}
        windowSize={5}
        extraData={messages}
        getItemLayout={getItemLayout}
      />

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
            <Pressable style={styles.closeButton} onPress={() => setShowStickerPicker(false)}>
              <Text style={styles.closeButtonText}>Đóng</Text>
            </Pressable>
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
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  username: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "bold", marginLeft: 10 },
  messageContainer: { flexDirection: "row", alignItems: "flex-end", marginVertical: 5, paddingHorizontal: 10 },
  myMessage: { justifyContent: "flex-end" },
  otherMessage: { justifyContent: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ddd", marginRight: 10 },
  messageBoxWrapper: { flexDirection: "row", alignItems: "center" },
  messageBox: { backgroundColor: "#fff", padding: 10, borderRadius: 10, maxWidth: "80%" },
  messageText: { fontSize: 16 },
  loadingText: { fontSize: 16, color: "#666", fontStyle: "italic" },
  seenText: { fontSize: 12, color: "#666", textAlign: "right" },
  recalledMessage: { fontStyle: "italic", color: "#666" },
  forwardedLabel: { fontSize: 12, color: "#666", fontStyle: "italic" },
  sticker: { width: 100, height: 100, marginVertical: 5 },
  image: { width: 200, height: 200, borderRadius: 10, marginVertical: 5 },
  videoContainer: { width: 200, height: 200, borderRadius: 10, marginVertical: 5 },
  video: { width: "100%", height: "100%", borderRadius: 10 },
  fileContainer: { flexDirection: "row", alignItems: "center", marginVertical: 5 },
  fileText: { fontSize: 16, color: "#007AFF", marginLeft: 10 },
  voiceContainer: { flexDirection: "row", alignItems: "center", marginVertical: 5 },
  voiceText: { fontSize: 16, color: "#007AFF", marginLeft: 10 },
  errorText: { fontSize: 14, color: "red", fontStyle: "italic" },
  optionsButton: { padding: 10, marginHorizontal: 5 },
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
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  forwardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    width: "100%",
  },
  forwardAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  forwardAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ddd", marginRight: 10 },
  forwardItemText: { fontSize: 16, flex: 1 },
  forwardButtonContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 10 },
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
  stickerThumbnail: { width: 80, height: 80, margin: 5 },
  closeButton: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    width: "45%",
  },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  pinnedMessageContainer: {
    backgroundColor: "#e5e5ea",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    zIndex: 999,
  },
  pinnedMessageLabel: { fontSize: 12, color: "#666", fontWeight: "bold" },
  pinnedMessageText: { fontSize: 14, color: "#000", marginVertical: 5 },
  unpinButton: { flexDirection: "row", alignItems: "center" },
  unpinButtonText: { fontSize: 12, color: "#007AFF", marginLeft: 5 },
});