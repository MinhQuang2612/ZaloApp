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
  Image, // Thêm import Image
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { fetchMessages, sendMessage, Message } from "../services/message";
import { fetchUserByID } from "../services/contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { Video } from "expo-av";

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

// Định nghĩa kiểu cho sticker từ Giphy
type GiphySticker = {
  id: string;
  images: {
    original: {
      url: string;
    };
  };
};

// Component con để render từng tin nhắn
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
    if (effectiveType === "type3") {
      if (item.context.startsWith("data:video/")) {
        const base64Data = item.context.split(",")[1];
        const filePath = `${FileSystem.cacheDirectory}video-${item.messageID}.mp4`;

        FileSystem.writeAsStringAsync(filePath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        })
          .then(() => {
            setVideoUri(filePath);
          })
          .catch((err) => {
            console.error("Lỗi khi tạo file video tạm thời:", err);
            setError("Không thể tải video");
          });
      } else {
        setVideoUri(item.context);
      }
    }
  }, [item.context, effectiveType]);

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
        {effectiveType === "type1" && <Text style={styles.messageText}>{item.context}</Text>}
        {effectiveType === "type2" && (
          <Image
            source={{ uri: item.context }}
            style={styles.image}
            resizeMode="cover"
            onError={(e) => console.log("Error loading image:", e.nativeEvent.error)}
          />
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
                onError={(e) => {
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
            source={{ uri: item.context }}
            style={styles.sticker}
            resizeMode="contain"
            onError={(e) => console.log("Error loading sticker:", e.nativeEvent.error)}
          />
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

// Hàm xác định loại tin nhắn
const determineMessageType = (message: Message): string => {
  const { context, messageTypeID } = message;

  if (context.startsWith("https://media") && context.includes("giphy.com")) {
    return "type4";
  }
  if (context.startsWith("data:image/")) {
    return "type2";
  }
  if (context.startsWith("data:video/")) {
    return "type3";
  }
  if (context.match(/\.(mp4|mov|avi)$/i)) {
    return "type3";
  }
  return messageTypeID;
};

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

  // State cho sticker picker
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<GiphySticker[]>([]);
  const [stickerSearchTerm, setStickerSearchTerm] = useState("funny");

  // Giphy API Key
  const GIPHY_API_KEY = "ahUloRbYoMUhR2aBUDO2iyNObLH8dnMa";

  // Fetch stickers từ Giphy API
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

      const newSocket = io("http://172.20.34.14:3000");
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
        (msg) =>
          msg.receiverID === currentUserID &&
          !msg.seenStatus?.includes(currentUserID) &&
          !markedAsSeen.has(msg.messageID!)
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

  const handleSendSticker = (stickerUrl: string) => {
    if (!stickerUrl.startsWith("https://")) {
      Alert.alert("Lỗi", "Sticker URL không hợp lệ.");
      return;
    }
    if (!userID || !currentUserID || !socket) return;

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

    socket.emit("sendTextMessage", newMessage, async (response: SocketResponse) => {
      console.log("Server response for sticker:", response);
      if (response !== "đã nhận") {
        setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      } else {
        await sendMessage({
          senderID: currentUserID,
          receiverID: userID,
          context: stickerUrl,
          messageTypeID: "type4",
          messageID,
        }).catch((error) => {
          console.error("Lỗi đồng bộ API khi gửi sticker:", error);
        });
      }
    });
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

    if (result.canceled) {
      console.log("User cancelled image picker");
      return;
    }

    const imageUri = result.assets[0].uri;
    if (!imageUri || !userID || !currentUserID || !socket) return;

    // Nén ảnh trước khi chuyển thành base64
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 300 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    const imageBase64 = manipulatedImage.base64;
    if (!imageBase64) {
      Alert.alert("Lỗi", "Không thể nén ảnh. Vui lòng thử lại.");
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type2",
      context: `data:image/jpeg;base64,${imageBase64}`,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
    };

    setMessages((prev) => [...prev, newMessage]);

    socket.emit("sendTextMessage", newMessage, async (response: SocketResponse) => {
      console.log("Server response for image:", response);
      if (response !== "đã nhận") {
        setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      } else {
        await sendMessage({
          senderID: currentUserID,
          receiverID: userID,
          context: `data:image/jpeg;base64,${imageBase64}`,
          messageTypeID: "type2",
          messageID,
        }).catch((error) => {
          console.error("Lỗi đồng bộ API khi gửi ảnh:", error);
        });
      }
    });
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

    if (result.canceled) {
      console.log("User cancelled video picker");
      return;
    }

    const videoUri = result.assets[0].uri;
    if (!videoUri || !userID || !currentUserID || !socket) return;

    // Kiểm tra định dạng video
    if (!videoUri.match(/\.(mp4)$/i)) {
      Alert.alert("Lỗi", "Chỉ hỗ trợ video định dạng .mp4.");
      return;
    }

    // Chuyển video thành base64
    let videoBase64;
    try {
      videoBase64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      console.error("Lỗi khi chuyển video thành base64:", error);
      Alert.alert("Lỗi", "Không thể gửi video. Vui lòng thử lại.");
      return;
    }

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      receiverID: userID,
      messageTypeID: "type3",
      context: `data:video/mp4;base64,${videoBase64}`,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
    };

    setMessages((prev) => [...prev, newMessage]);

    socket.emit("sendTextMessage", newMessage, async (response: SocketResponse) => {
      console.log("Server response for video:", response);
      if (response !== "đã nhận") {
        setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
      } else {
        await sendMessage({
          senderID: currentUserID,
          receiverID: userID,
          context: `data:video/mp4;base64,${videoBase64}`,
          messageTypeID: "type3",
          messageID,
        }).catch((error) => {
          console.error("Lỗi đồng bộ API khi gửi video:", error);
        });
      }
    });
  };

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      console.log(`Rendering message: type=${item.messageTypeID}, context=${item.context.substring(0, 50)}...`);
      return <MessageItem item={item} currentUserID={currentUserID} userID={userID} />;
    },
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
                    onError={(e) => console.log("Error loading sticker thumbnail:", e.nativeEvent.error)}
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
  sticker: { width: 100, height: 100, marginVertical: 5 },
  image: { width: 200, height: 200, borderRadius: 10, marginVertical: 5 },
  videoContainer: { width: 200, height: 200, borderRadius: 10, marginVertical: 5 },
  video: { width: "100%", height: "100%", borderRadius: 10, resizeMode: "cover" },
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
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
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
    marginTop: 10,
  },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});