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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendMessage, fetchGroupMessages, Message } from "../services/message";
import { fetchUserGroups } from "../services/group"; // Thêm import
import socket from "../services/socket";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

type GroupMessage = Message;

const MessageItem = ({
  item,
  currentUserID,
}: {
  item: GroupMessage;
  currentUserID: string | null;
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
            {item.seenStatus?.length && item.seenStatus.length > 1 ? "Đã xem" : "Đã gửi"}
          </Text>
        )}
      </View>
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

      if (!groupID) {
        console.error("groupID không hợp lệ:", groupID);
        setLoading(false);
        return;
      }

      // Lấy danh sách nhóm để tìm tên nhóm
      try {
        const userGroups = await fetchUserGroups(userIDValue);
        const group = userGroups.find((g) => g.groupID === groupID);
        if (group) {
          setGroupName(group.groupName);
        } else {
          console.warn("Không tìm thấy nhóm với groupID:", groupID);
        }
      } catch (error) {
        console.error("Lỗi khi lấy danh sách nhóm:", error);
        Alert.alert("Lỗi", "Không thể tải thông tin nhóm. Vui lòng thử lại.");
      }

      // Lấy tin nhắn nhóm từ API
      try {
        const groupMessages = await fetchGroupMessages(groupID as string);
        setMessages(groupMessages);
      } catch (error) {
        console.error("Lỗi khi lấy tin nhắn nhóm:", error);
        Alert.alert("Lỗi", "Không thể tải tin nhắn nhóm. Vui lòng thử lại.");
      }

      socket.emit("joinGroupRoom", groupID);
      console.log("GroupChat.tsx: Joined group room:", groupID);

      socket.on("receiveGroupMessage", (message: Message) => {
        console.log("GroupChat.tsx: Received group message:", message);
        if (message.groupID === groupID) {
          setMessages((prev) => {
            const exists = prev.some((msg) => msg.messageID === message.messageID);
            if (!exists) {
              return [...prev, message];
            }
            return prev;
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      socket.on("updateGroupChatSeenStatus", (messageID: string) => {
        console.log("GroupChat.tsx: Update seen status for messageID:", messageID);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageID === messageID
              ? { ...msg, seenStatus: [...(msg.seenStatus || []), userIDValue] }
              : msg
          )
        );
      });

      socket.on("disconnect", (reason) => {
        console.log("GroupChat.tsx: Socket disconnected:", reason);
      });

      setLoading(false);

      return () => {
        socket.off("receiveGroupMessage");
        socket.off("updateGroupChatSeenStatus");
        socket.off("disconnect");
      };
    };

    initializeSocketAndData();
  }, [groupID]);

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
          socket.emit("seenMessage", msg.messageID, currentUserID, (response: SocketResponse) => {
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
    if (!inputText.trim() || !groupID || !currentUserID) return;

    const messageID = `${socket.id}-${Date.now()}`;
    const newMessage: Message = {
      senderID: currentUserID,
      groupID: groupID as string,
      messageTypeID: "type1",
      context: inputText,
      messageID,
      createdAt: new Date().toISOString(),
      seenStatus: [],
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    try {
      await sendMessage(newMessage);
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn nhóm:", error);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
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
    };

    setMessages((prev) => [...prev, newMessage]);
    setShowStickerPicker(false);

    try {
      await sendMessage(newMessage);
    } catch (error) {
      console.error("Lỗi khi gửi sticker:", error);
      setMessages((prev) => prev.filter((msg) => msg.messageID !== messageID));
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
    };

    setMessages((prev) => [...prev, tempMessage]);

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
        file: { name: `image-${Date.now()}.jpg`, data: fileBase64 },
      };

      await sendMessage(newMessage);
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
    };

    setMessages((prev) => [...prev, tempMessage]);

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
        file: { name: `video-${Date.now()}.mp4`, data: fileBase64 },
      };

      await sendMessage(newMessage);
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
    };

    setMessages((prev) => [...prev, tempMessage]);

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
        file: { name: fileName, data: fileBase64 },
      };

      await sendMessage(newMessage);
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
    ({ item }: { item: GroupMessage }) => (
      <MessageItem item={item} currentUserID={currentUserID} />
    ),
    [currentUserID]
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
        <Text style={styles.username}>{groupName}</Text>
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