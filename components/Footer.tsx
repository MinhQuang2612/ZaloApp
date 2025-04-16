import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";

const Footer = () => {
  const router = useRouter();
  const pathname = usePathname(); // Lấy đường dẫn hiện tại

  // Hàm kiểm tra nếu tab đang active
  const isActive = (path: string) => pathname === path;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.item} onPress={() => router.push("/home")}>
        <FontAwesome5 name="facebook-messenger" size={24} color={isActive("/home") ? "#007AFF" : "#666"} />
        <Text style={[styles.label, isActive("/home") && styles.activeText]}>Tin nhắn</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/contacts")}>
        <FontAwesome5 name="address-book" size={24} color={isActive("/contacts") ? "#007AFF" : "#666"} />
        <Text style={[styles.label, isActive("/contacts") && styles.activeText]}>Danh bạ</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/explore")}>
        <FontAwesome5 name="th-large" size={24} color={isActive("/explore") ? "#007AFF" : "#666"} />
        <Text style={[styles.label, isActive("/explore") && styles.activeText]}>Khám phá</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/journal")}>
        <FontAwesome5 name="clock" size={24} color={isActive("/journal") ? "#007AFF" : "#666"} />
        <Text style={[styles.label, isActive("/journal") && styles.activeText]}>Nhật ký</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/profile")}>
        <FontAwesome5 name="user" size={24} color={isActive("/profile") ? "#007AFF" : "#666"} />
        <Text style={[styles.label, isActive("/profile") && styles.activeText]}>Cá nhân</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    marginBottom: 20,
  },
  item: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: "#666",
  },
  activeText: {
    color: "#007AFF", // Màu xanh khi active
    fontWeight: "bold",
  },
});

export default Footer;
