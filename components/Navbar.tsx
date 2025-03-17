import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useRef, RefObject } from "react";
import React from "react";

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

  // Hàm mở dropdown
  const openDropdown = () => {
    if (addButtonRef.current) {
      addButtonRef.current.measure(
        (fx: number, fy: number, width: number, height: number, px: number, py: number) => {
          setDropdownPosition({ top: py + height + 5, right: screenWidth - px - width });
          setShowDropdown(true);
        }
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Thanh tìm kiếm */}
      {showSearch ? (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={25} color="#fff" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm"
            placeholderTextColor="#ccc"
          />
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
            <TouchableOpacity style={styles.dropdownItem}>
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
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 20,
    flex: 1,
    //paddingVertical: 8,
    paddingHorizontal: 10,
  },
  searchInput: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 10,
    flex: 1,
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
  },
  icon: {
    marginLeft: 15,
    marginRight: 10,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  dropdown: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    width: 200,
    elevation: 5,
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
