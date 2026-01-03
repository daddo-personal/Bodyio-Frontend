// app/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

const IOS_KEY = Constants.expoConfig?.extra?.revenuecatIOSApiKey;
const ANDROID_KEY = Constants.expoConfig?.extra?.revenuecatAndroidApiKey;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    async function init() {
      // -------------------------
      // Notifications (Android channel)
      // -------------------------
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }
      } catch (e) {
        console.log("❌ Notifications channel error:", e);
      }

      // -------------------------
      // RevenueCat init
      // -------------------------
      try {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);

        const apiKey = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;

        if (!apiKey) {
          console.log(
            "❌ RevenueCat missing API key for platform:",
            Platform.OS,
            "Check app.json extra fields."
          );
          return;
        }

        console.log("Initializing RevenueCat…");
        console.log("RevenueCat → Platform:", Platform.OS);

        // ✅ Configure anonymously at startup (most reliable)
        await Purchases.configure({ apiKey });

        const uid = await Purchases.getAppUserID();
        console.log("✅ RevenueCat configured. SDK AppUserID:", uid);

        // (Optional) If you want to auto-login when user exists at startup:
        const saved = await AsyncStorage.getItem("user");
        const user = saved ? JSON.parse(saved) : null;
        const userId = user?.id ? String(user.id) : null;

        if (userId) {
          console.log("RevenueCat → Logging in user:", userId);
          const res = await Purchases.logIn(userId);
          console.log("RevenueCat → logIn result:", {
            customerInfoAppUserId: res?.customerInfo?.originalAppUserId,
            created: res?.created,
          });
        }
      } catch (err) {
        console.log("❌ RevenueCat init error:", err);
      }
    }

    init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#1f1f1f" }}>
          <StatusBar style="light" backgroundColor="#1f1f1f" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#1f1f1f" },
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
