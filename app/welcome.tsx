import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Platform } from "react-native";
import Swiper from "react-native-swiper";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Hook đa nền tảng


export default function Welcome() {
  const router = useRouter();
  const [language, setLanguage] = useState("Tiếng Việt");
  const [showDropdown, setShowDropdown] = useState(false);
  const insets = useSafeAreaInsets(); // Lấy giá trị vùng an toàn (trên Android, insets.top thường là 0)

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    setShowDropdown(false);
  };

  return (
    <View style={[
            styles.container,
            {
              // Trên iOS: paddingTop = insets.top để nằm sát dưới Dynamic Island
              // Trên Android: paddingTop = 3 (giá trị mặc định, không bị ảnh hưởng bởi insets)
              paddingTop: Platform.OS === "ios" ? insets.top : 3,
              paddingBottom: 8, // Đảm bảo chiều cao navbar đủ lớn
            },
          ]}>
      <View style={[
      styles.languageContainer,
      {
        top: Platform.OS === "ios" ? insets.top + 5 : 20, // Đẩy xuống dưới Dynamic Island
      },
    ]}>
        <TouchableOpacity style={styles.languageButton} onPress={() => setShowDropdown(!showDropdown)}>
          <Text style={styles.languageText}>{language} ⌵</Text>
        </TouchableOpacity>

        {showDropdown && (
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => changeLanguage("Tiếng Việt")}>
              <Text style={styles.dropdownText}>🇻🇳 Tiếng Việt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => changeLanguage("English")}>
              <Text style={styles.dropdownText}>🇺🇸 English (US)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Image source={require("../assets/images/logo.png")} style={styles.logo} />

      <Swiper style={styles.wrapper} showsButtons={false} dotStyle={styles.dot} activeDotStyle={styles.activeDot} autoplay={true} 
  autoplayTimeout={2} >
        <View style={styles.slide}>   
          <Image source={require("../assets/images/nhat_ky_ban_be.png")} style={styles.illustration} />
          <Text style={styles.title}>Nhật ký bạn bè</Text>
          <Text style={styles.subtitle}>Nơi cập nhật hoạt động mới nhất của những người bạn quan tâm</Text>
        </View>

        <View style={styles.slide}>
          <Image source={require("../assets/images/gui_anh_nhanh_chong.png")} style={styles.illustration} />
          <Text style={styles.title}>Gửi ảnh nhanh chóng</Text>
          <Text style={styles.subtitle}>Trao đổi hình ảnh chất lượng cao với bạn bè và người thân thật nhanh và dễ dàng</Text>
        </View>

        <View style={styles.slide}>
          <Image source={require("../assets/images/chat_nhom_tien_ich.png")} style={styles.illustration} />
          <Text style={styles.title}>Chat nhóm tiện ích</Text>
          <Text style={styles.subtitle}>Nơi cùng nhau trao đổi, giữ liên lạc với gia đình, bạn bè, đồng nghiệp...</Text>
        </View>

        <View style={styles.slide}>
          <Image source={require("../assets/images/goi_video_on_dinh.png")} style={styles.illustration} />
          <Text style={styles.title}>Gọi video ổn định</Text>
          <Text style={styles.subtitle}>Trò chuyện thật đã với chất lượng video ổn định mọi lúc, mọi nơi</Text>
        </View>
      </Swiper>

      <TouchableOpacity style={styles.buttonPrimary} onPress={() => router.push("/login")}>
        <Text style={styles.buttonText}>Đăng nhập</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.push("/register_otp")}>
        <Text style={styles.buttonTextSecondary}>Tạo tài khoản mới</Text>
      </TouchableOpacity>
    </View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingBottom: 30,
  },
  languageContainer: {
    position: "absolute",
    top: 30,
    right: 20,
  },
  languageButton: {
    backgroundColor: "#E0E0E0",
    paddingVertical: 5,
    paddingHorizontal: 19,
    borderRadius: 15,
    width: 120,
  },
  languageText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
  },
  dropdown: {
    position: "absolute",
    top: 35,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
    width: 120,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  dropdownText: {
    fontSize: 14,
  },
  logo: {
    width: 110,
    height: 50,
    marginTop: 90,
    marginBottom: 20,
  },
  wrapper: {
    height: 300,
    marginTop: 110,
  },
  slide: {
    justifyContent: "center",
    alignItems: "center",
    width: width,
  },
  illustration: {
    width: 200,
    height: 150,
    marginBottom: 15,
    resizeMode: "contain",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 25,
  },
  dot: {
    backgroundColor: "#D3D3D3",
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#007AFF",
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  buttonPrimary: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    width: "60%",
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonSecondary: {
    backgroundColor: "#E0E0E0",
    paddingVertical: 10,
    width: "60%",
    borderRadius: 25,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  buttonTextSecondary: {
    color: "#000",
    fontSize: 15,
    fontWeight: "bold",
  },
});
