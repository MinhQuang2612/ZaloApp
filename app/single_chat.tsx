import { useState, useEffect, useRef, useCallback } from "react";
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
import { fetchUserByID } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import socket, { connectSocket } from "../services/socket";

type SocketResponse =
  | "đang gửi"
  | "đã nhận"
  | "tin nhắn đã tồn tại"
  | "không tìm thấy tin nhắn"
  | "User đã tồn tại trong seenStatus"
  | "Đã cập nhật seenStatus chat đơn"
  | "Đã cập nhật seenStatus chat nhóm"
  | string;

type GiphySticker = {
  id: string;
  images: {
    original: {
      url: string;
    };
  };
};

const MessageItem = ({
  item,
  currentUserID,
  userID,
}: {
  item: Message;
  currentUserID: string | null;
  userID: string | undefined;
}) => {
  const effectiveType = determineMessageType(item);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveType === "type3" && item.context !== "Đang tải...") {
      setVideoUri(item.context);
    }
  }, [item.context, effectiveType]);

  const handleFilePress = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error("Lỗi khi mở file:", err);
      Alert.alert("Lỗi", "Không thể mở file. Vui lòng thử lại.");
    });
  };

  return (
    <View
      style={[
        styles.messageContainer,
        item.senderID === currentUserID ? styles.myMessage : styles.otherMessage,
      ]}
    >
      {item.senderID !== currentUserID && (
        <Image
          source={{ uri: "https://randomuser.me/api/portraits/men/1.jpg" }}
          style={styles.avatar}
          onError={(e) => console.log("Error loading avatar:", e.nativeEvent.error)}
        />
      )}
      <View style={styles.messageBox}>
        {effectiveType === "type1" && <Text style={styles.messageText}>{item.context || "Tin nhắn trống"}</Text>}
        {effectiveType === "type2" && (
          item.context === "Đang tải..." ? (
            <Text style={styles.loadingText}>Đang tải...</Text>
          ) : (
            <Image
              source={{ uri: item.context || "https://via.placeholder.com/200" }}
              style={styles.image}
              resizeMode="cover"
              onError={(e) => console.log("Error loading image:", e.nativeEvent.error)}
            />
          )
        )}
        {effectiveType === "type3" && (
          <View style={styles.videoContainer}>
            {error ? (
              <Text style={{ color: "red" }}>{error}</Text>
            ) : videoUri ? (
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
              <Text>Đang tải video...</Text>
            )}
          </View>
        )}
        {effectiveType === "type4" && (
          <Image
            source={{ uri: item.context || "https://via.placeholder.com/100" }}
            style={styles.sticker}
            resizeMode="contain"
            onError={(e) => console.log("Error loading sticker:", e.nativeEvent.error)}
          />
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
        {item.senderID === currentUserID && (
          <Text style={styles.seenText}>
            {item.seenStatus?.includes(userID!) ? "Đã xem" : "Đã gửi"}
          </Text>
        )}
      </View>
    </View>
  );
};

const determineMessageType = (message: Message): string => {
  return message.messageTypeID || "type1";
};

const getMessagePreview = (message: Message): string => {
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

export default function Chat() {
  const { userID } = useLocalSearchParams<{ userID?: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserID, setCurrentUserID] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState<string>("Đang tải...");
  const [loading, setLoading] = useState(true);
  const [markedAsSeen, setMarkedAsSeen] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<GiphySticker[]>([]);
  const [stickerSearchTerm, setStickerSearchTerm] = useState("funny");
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
      return `${process.env.EXPO_PUBLIC_API_URL}/uploads/${fileName}`;
    }
    return context;
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
  
      try {
        const data = await fetchMessages(userID);
        const updatedData = data.map((message) => {
          if (message.messageTypeID === "type2" || message.messageTypeID === "type3" || message.messageTypeID === "type5") {
            message.context = convertFilePathToURL(message.context);
          }
          return message;
        });
        setMessages(updatedData);
      } catch (error) {
        console.error("Lỗi khi lấy tin nhắn ban đầu:", error);
      }
  
      // Đảm bảo socket kết nối và join room
      connectSocket();
      socket.emit("joinUserRoom", userIDValue);
      socket.emit("joinUserRoom", userID);
      console.log("Chat.tsx: Joined rooms:", userIDValue, userID);
  
      socket.on("connect", () => {
        console.log("Chat.tsx: Socket connected:", socket.id);
        socket.emit("joinUserRoom", userIDValue);
        socket.emit("joinUserRoom", userID);
      });
  
      socket.on("receiveMessage", (message: Message) => {
        console.log("Chat.tsx: Received message:", message);
        if (
          (message.senderID === userID && message.receiverID === userIDValue) ||
          (message.senderID === userIDValue && message.receiverID === userID)
        ) {
          setMessages((prev) => {
            const exists = prev.some((msg) => msg.messageID === message.messageID);
            if (!exists) {
              if (message.messageTypeID === "type2" || message.messageTypeID === "type3" || message.messageTypeID === "type5") {
                message.context = convertFilePathToURL(message.context);
              }
              return [...prev, message];
            }
            return prev;
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });
  
      socket.on("updateSingleChatSeenStatus", (messageID: string) => {
        console.log("Chat.tsx: Update seen status for messageID:", messageID);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageID === messageID
              ? { ...msg, seenStatus: [...(msg.seenStatus || []), userID!], unread: false }
              : msg
          )
        );
      });
  
      socket.on("disconnect", (reason) => {
        console.log("Chat.tsx: Socket disconnected:", reason);
      });
  
      setLoading(false);
  
      return () => {
        socket.off("connect");
        socket.off("receiveMessage");
        socket.off("updateSingleChatSeenStatus");
        socket.off("disconnect");
      };
    };
  
    initializeSocketAndData();
  }, [userID]);
  
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
        if (msg.messageID) {
          socket.emit("seenMessage", msg.messageID, currentUserID, (response: SocketResponse) => {
            console.log("Chat.tsx: Seen response:", response);
            if (response === "Đã cập nhật seenStatus chat đơn") {
              setMarkedAsSeen((prev) => new Set(prev).add(msg.messageID!));
            }
          });
        }
      });
    }
  }, [messages, currentUserID]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !userID || !currentUserID) return;

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type1",
      context: inputText,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
      console.log("Server response for text message:", response);
      if (response !== "Đã nhận") {
        setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
        Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
      }
    });
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
    };

    setMessages((prev) => [...prev, newMessage]);
    setShowStickerPicker(false);

    socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
      console.log("Server response for sticker:", response);
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
        file: { name: `image-${Date.now()}.jpg`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Server response for image:", response);
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
        file: { name: `video-${Date.now()}.mp4`, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Server response for video:", response);
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
        file: { name: fileName, data: fileBase64 },
      };

      socket.emit("sendMessage", newMessage, (response: SocketResponse) => {
        console.log("Server response for file:", response);
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

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageItem item={item} currentUserID={currentUserID} userID={userID} />
    ),
    [currentUserID, userID]
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
      <View style={[styles.navbar, { paddingTop: Platform.OS === "ios" ? insets.top : 3, paddingBottom: 8 }]}>
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
        keyExtractor={(item, index) => item.messageID || item.createdAt || `message-${index}`}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 10 }}
        initialNumToRender={10}
        windowSize={5}
      />

      <View style={styles.inputContainer}>
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

      <Modal visible={showStickerPicker} animationType="slide" transparent={true} onRequestClose={() => setShowStickerPicker(false)}>
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
  messageContainer: { flexDirection: "row", alignItems: "center", marginVertical: 5, paddingHorizontal: 10 },
  myMessage: { justifyContent: "flex-end", alignSelf: "flex-end" },
  otherMessage: { justifyContent: "flex-start", alignSelf: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  messageBox: { backgroundColor: "#fff", padding: 10, borderRadius: 10 },
  messageText: { fontSize: 16 },
  loadingText: { fontSize: 16, color: "#666", fontStyle: "italic" },
  seenText: { fontSize: 12, color: "#666", textAlign: "right" },
  sticker: { width: 100, height: 100, marginVertical: 5 },
  image: { width: 200, height: 200, borderRadius: 10, marginVertical: 5 },
  videoContainer: { width: 200, height: 200, borderRadius: 10, marginVertical: 5 },
  video: { width: "100%", height: "100%", borderRadius: 10, resizeMode: "contain" },
  fileContainer: { flexDirection: "row", alignItems: "center", marginVertical: 5 },
  fileText: { fontSize: 16, color: "#007AFF", marginLeft: 10 },
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
  modalContainer: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  stickerPicker: { backgroundColor: "#fff", height: "50%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  stickerSearchInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10, marginBottom: 10 },
  stickerThumbnail: { width: 80, height: 80, margin: 5 },
  closeButton: { backgroundColor: "#007AFF", padding: 10, borderRadius: 10, alignItems: "center", marginTop: 10 },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});