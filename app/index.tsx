import { useEffect } from "react";
import { useRouter } from "expo-router";
import { getAccessToken } from "../services/auth";
import { View, ActivityIndicator } from "react-native";

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}