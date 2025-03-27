import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, Dimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useRef, RefObject } from "react";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Hook đa nền tảng

interface NavbarProps {
  title?: string;
  showSearch?: boolean;
  showQR?: boolean;
  showAdd?: boolean;
  addIconType?: "add" | "person-add-outline";
}

const Navbar: React.FC<NavbarProps> = ({ title, showSearch, showQR, showAdd, addIconType = "add" }) => {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 50, right: 15 });
  const addButtonRef: RefObject<React.ElementRef<typeof TouchableOpacity>> = useRef(null);
  const screenWidth = Dimensions.get("window").width;
  const insets = useSafeAreaInsets(); // Lấy giá trị vùng an toàn (trên Android, insets.top thường là 0)

  // Hàm mở dropdown
  const openDropdown = () => {
    if (addButtonRef.current) {
      addButtonRef.current.measure(
        (fx: number, fy: number, width: number, height: number, px: number, py: number) => {
          // Tính toán vị trí dropdown chính xác hơn
          // py là vị trí Y của nút "+", height là chiều cao của nút
          // Cộng thêm insets.top để đảm bảo dropdown không bị che bởi notch hoặc status bar
          const adjustedTop = py + height  + 20;
          setDropdownPosition({ top: adjustedTop, right: screenWidth - px - width });
          setShowDropdown(true);
        }
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          // Trên iOS: paddingTop = insets.top để nằm sát dưới Dynamic Island
          // Trên Android: paddingTop = 3 (giá trị mặc định, không bị ảnh hưởng bởi insets)
          paddingTop: Platform.OS === "ios" ? insets.top : 3,
          paddingBottom: 8, // Đảm bảo chiều cao navbar đủ lớn
          zIndex: 1000, // Đặt zIndex cao cho Navbar
        },
      ]}
    >
      {/* Thanh tìm kiếm */}
      {showSearch ? (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={25} color="#fff" />
          <TextInput style={styles.searchInput} placeholder="Tìm kiếm" placeholderTextColor="#ccc" />
        </View>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}

      {/* Các icon bên phải */}
      <View style={styles.icons}>
        {showQR && (
          <TouchableOpacity>
            <Ionicons name="qr-code-outline" size={24} color="#fff" style={styles.icon} />
          </TouchableOpacity>
        )}

        {showAdd && (
          <TouchableOpacity ref={addButtonRef} onPress={openDropdown}>
            <Ionicons name={addIconType} size={28} color="#fff" style={{ marginRight: 5 }} />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown menu */}
      {showDropdown && (
        <Pressable style={styles.overlay} onPress={() => setShowDropdown(false)}>
          <View style={[styles.dropdown, { top: dropdownPosition.top, right: dropdownPosition.right }]}>
            <TouchableOpacity style={styles.dropdownItem}>
              <Ionicons name="person-add-outline" size={20} color="#000" />
              <Text style={styles.dropdownText}>Thêm bạn</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem}
                onPress={() => {
                setShowDropdown(false);
                router.push("/create_group"); // Navigate to the group creation screen
            }}
              >
  <Ionicons name="people-outline" size={20} color="#000" />
  <Text style={styles.dropdownText}>Tạo nhóm</Text>
</TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem}>
              <Ionicons name="cloud-outline" size={20} color="#000" />
              <Text style={styles.dropdownText}>Cloud của tôi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem}>
              <Ionicons name="calendar-outline" size={20} color="#000" />
              <Text style={styles.dropdownText}>Lịch Zalo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem}>
              <Ionicons name="videocam-outline" size={20} color="#000" />
              <Text style={styles.dropdownText}>Tạo cuộc gọi nhóm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#005BB5",
    borderRadius: 20,
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    height: 50,
    marginTop: 10,
  },
  searchInput: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
    paddingVertical: 0,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  icons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  icon: {
    marginLeft: 15,
    marginRight: 10,
    marginHorizontal: 8, // Đều khoảng cách giữa các icon
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 2000,
  },
  dropdown: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    width: 200,
    elevation: 10,
    shadowColor: "#000", // Thêm bóng cho iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 0.5, // Thêm viền nhẹ
    borderColor: "#ccc", // Màu viền nhẹ để tăng độ tương phản
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  dropdownText: {
    fontSize: 16,
    marginLeft: 10,
    color: "#000",
  },
});

export default Navbar;