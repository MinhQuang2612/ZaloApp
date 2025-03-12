import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons"; // Import icon

export default function Register() {
  const router = useRouter();
  const [isTermsAccepted, setTermsAccepted] = useState(false);
  const [isSocialAccepted, setSocialAccepted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("+84");

  const countryCodes = ["+84", "+1", "+44", "+61", "+65"];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.sub}>Đăng ký</Text>
      </View>

      <Text style={styles.title}>Nhập số điện thoại</Text>

      <View style={styles.phoneInputContainer}>
        <TouchableOpacity
          style={styles.countryCodeContainer}
          onPress={() => setDropdownVisible(!isDropdownVisible)}
        >
          <Text style={styles.countryCode}>{selectedCountryCode}</Text>
          <Ionicons
            name={isDropdownVisible ? "chevron-up" : "chevron-down"}
            size={16}
            color="#666"
          />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TextInput
          style={styles.phoneNumber}
          placeholder="Số điện thoại"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
        {phoneNumber.length > 0 && (
          <TouchableOpacity
            onPress={() => setPhoneNumber("")}
            style={styles.clearIcon}
          >
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      {isDropdownVisible && (
        <View style={styles.dropdown}>
          <FlatList
            data={countryCodes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedCountryCode(item);
                  setDropdownVisible(false);
                }}
              >
                <Text style={styles.dropdownText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          onPress={() => setTermsAccepted(!isTermsAccepted)}
          style={[
            styles.customCheckbox,
            isTermsAccepted && styles.checkboxChecked,
          ]}
        >
          {isTermsAccepted && (
            <Ionicons name="checkmark" size={18} color="white" />
          )}
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>
          Tôi đồng ý với các{" "}
          <Text style={styles.link}>điều khoản sử dụng Zalo</Text>
        </Text>
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          onPress={() => setSocialAccepted(!isSocialAccepted)}
          style={[
            styles.customCheckbox,
            isSocialAccepted && styles.checkboxChecked,
          ]}
        >
          {isSocialAccepted && (
            <Ionicons name="checkmark" size={18} color="white" />
          )}
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>
          Tôi đồng ý với{" "}
          <Text style={styles.link}>điều khoản Mạng xã hội của Zalo</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          isTermsAccepted && isSocialAccepted && phoneNumber
            ? styles.buttonActive
            : styles.buttonDisabled,
        ]}
        onPress={() => {
          if (!isTermsAccepted || !isSocialAccepted) {
            alert("Vui lòng đồng ý với các điều khoản!");
            return;
          }
          if (!phoneNumber) {
            alert("Vui lòng nhập số điện thoại!");
            return;
          }
          router.push({
            pathname: "/register_otp",
            params: { phone: phoneNumber },
          });
        }}
        disabled={!isTermsAccepted || !isSocialAccepted || !phoneNumber}
      >
        <Text
          style={[
            styles.buttonText,
            isTermsAccepted && isSocialAccepted && phoneNumber
              ? styles.buttonTextActive
              : styles.buttonTextDisabled,
          ]}
        >
          Tiếp tục
        </Text>
      </TouchableOpacity>

      <Text style={styles.registerText}>
        Bạn đã có tài khoản?{" "}
        <Text style={styles.registerLink} onPress={() => router.push("/login")}>
          Đăng nhập ngay
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginHorizontal: -20,
  },
  sub: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginTop: 20,
    marginBottom: 15,
    textAlign: "center",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  countryCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  divider: {
    width: 1.5,
    height: "100%",
    backgroundColor: "#ccc",
    marginHorizontal: 10,
  },
  phoneNumber: {
    flex: 1,
    fontSize: 16,
  },
  clearIcon: {
    marginLeft: 10,
  },
  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginTop: 5,
    paddingVertical: 5,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  dropdownText: {
    fontSize: 16,
    color: "#000",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  customCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#000",
  },
  link: {
    color: "#007AFF",
    fontWeight: "bold",
  },
  button: {
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 20,
    width: "80%",
    alignSelf: "center",
  },
  buttonActive: {
    backgroundColor: "#007AFF",
  },
  buttonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonTextActive: {
    color: "#fff",
  },
  buttonTextDisabled: {
    color: "#666",
  },
  registerText: {
    color: "#000",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  registerLink: {
    color: "#007AFF",
    fontWeight: "bold",
  },
});
