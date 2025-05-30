import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { getCurrentUser } from "../services/auth";
import QRCode from "react-native-qrcode-svg";

export default function MyQRCodeScreen() {
  const [userID, setUserID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Không tìm thấy thông tin người dùng");
        setUserID(user.userID);
      } catch (err: any) {
        Alert.alert("Lỗi", err.message || "Không thể lấy thông tin user");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ color: "#007AFF", marginTop: 10 }}>Đang tải mã QR...</Text>
      </View>
    );
  }

  if (!userID) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>Không tìm thấy userID</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mã QR của tôi</Text>
      <View style={styles.qrBox}>
        <QRCode value={`user:${userID}`} size={220} />
      </View>
      <Text style={styles.userID}>ID: {userID}</Text>
      <Text style={styles.guide}>Bạn bè có thể quét mã này để kết bạn với bạn</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 30,
  },
  qrBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    marginBottom: 20,
  },
  userID: {
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
  },
  guide: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },
}); 