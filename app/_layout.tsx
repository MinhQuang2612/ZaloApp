import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="register_otp" options={{ headerShown: false }} />
      <Stack.Screen name="create_account" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="profile_details" options={{ headerShown: false }} />
      <Stack.Screen name="change_password" options={{ headerShown: false }} />
      <Stack.Screen name="single_chat" options={{ headerShown: false }} />
      <Stack.Screen name="contacts" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{headerShown: false}}/>
      <Stack.Screen name="journal" options={{headerShown: false}}/>
      <Stack.Screen name="group_chat" options={{headerShown: false}}/>
      <Stack.Screen name="create_group" options={{headerShown: false}}/>
      <Stack.Screen name="add_contact" options={{headerShown: false}}/>
      <Stack.Screen name="user_profile" options={{headerShown: false}}/>
      <Stack.Screen name="group_detail" options={{headerShown: false}}/>
      <Stack.Screen name="qr_login" options={{headerShown: false}}/>
      <Stack.Screen name="my_qr_code" options={{headerShown: false}}/>
    </Stack>
  );
}