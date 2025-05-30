import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { getCurrentUser, getAccessToken, getRefreshToken } from "../services/auth";
import { sendQRLogin } from "../services/socket";
import { addContact } from "../services/contacts";

export default function QRLoginScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const router = useRouter();
  const cameraRef = useRef(null);

  React.useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);
    try {
      if (data.startsWith("user:")) {
        setLoadingText("Đang gửi lời mời kết bạn...");
        const userID = data.replace("user:", "");
        const currentUser = await getCurrentUser();
        if (!currentUser) throw new Error("Không tìm thấy thông tin người dùng hiện tại");
        if (userID === currentUser.userID) throw new Error("Không thể kết bạn với chính mình!");
        const message = await addContact(currentUser.userID, userID);
        Alert.alert("Kết bạn thành công", message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else if (!isUUID(data)) {
        setLoadingText("Đang thêm contact...");
        const userID = data;
        const currentUser = await getCurrentUser();
        if (!currentUser) throw new Error("Không tìm thấy thông tin người dùng hiện tại");
        const message = await addContact(currentUser.userID, userID);
        Alert.alert("Thêm contact thành công", message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        setLoadingText("Đang gửi thông tin đăng nhập web...");
        const sessionID = data;
        const user = await getCurrentUser();
        const accessToken = await getAccessToken();
        const refreshToken = await getRefreshToken();
        if (!sessionID || !user || !accessToken || !refreshToken) throw new Error("Thiếu thông tin đăng nhập hoặc sessionID");
        sendQRLogin({ sessionID, accessToken, refreshToken, user });
        Alert.alert("Đăng nhập web thành công", "Đã gửi thông tin đăng nhập cho web. Hãy kiểm tra trình duyệt.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Lỗi", err.message || "Không thể xử lý mã QR");
      setScanned(false);
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  // Loading state while checking permissions
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.permissionText}>Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Cần quyền truy cập camera để quét mã QR</Text>
        <TouchableOpacity 
          style={styles.requestButton} 
          onPress={requestPermission}
        >
          <Text style={styles.requestButtonText}>Cấp quyền camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
      
      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      )}
      
      {/* Guide box */}
      <View style={styles.guideBox}>
        <Text style={styles.guideText}>
          Quét mã QR để kết bạn hoặc đăng nhập web
        </Text>
      </View>
      
      {/* Scan frame */}
      <View style={styles.scanFrame} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  permissionText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  requestButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  guideBox: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  guideText: {
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 20,
  },
  scanFrame: {
    position: "absolute",
    top: "30%",
    left: "15%",
    right: "15%",
    height: 250,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
});