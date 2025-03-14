import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const Footer = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.item} onPress={() => router.push("/home")}>
        <FontAwesome5 name="facebook-messenger" size={24} color="#007AFF" />
        <Text style={styles.label}>Tin nhắn</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/contacts")}>
        <FontAwesome5 name="address-book" size={24} color="#666" />
        <Text style={styles.label}>Danh bạ</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/explore")}>
        <FontAwesome5 name="th-large" size={24} color="#666" />
        <Text style={styles.label}>Khám phá</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/journal")}>
        <FontAwesome5 name="clock" size={24} color="#666" />
        <Text style={styles.label}>Nhật ký</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/profile")}>
        <FontAwesome5 name="user" size={24} color="#666" />
        <Text style={styles.label}>Cá nhân</Text>
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
  },
  item: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default Footer;
