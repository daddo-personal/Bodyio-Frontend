// app/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const API_URL = Constants.expoConfig.extra.revenuecatApiKey;

export default function RootLayout() {
  useEffect(() => {
    async function initRevenueCat() {
      try {
        console.log("Initializing RevenueCat…");

        // Check if a user is logged in
        const saved = await AsyncStorage.getItem("user");
        const user = saved ? JSON.parse(saved) : null;

        const userId = user?.id ? String(user.id) : null;

        console.log("RevenueCat → Using appUserID:", userId);

        await Purchases.configure({
          apiKey: API_URL,
          appUserID: userId,       // ← IMPORTANT
        });

        if (Platform.OS === "ios") {
          const uid = await Purchases.getAppUserID();
          console.log("RevenueCat → Actual SDK AppUserID:", uid);
        }

        console.log("✅ RevenueCat initialization complete");
      } catch (err) {
        console.log("❌ RevenueCat init error:", err);
      }
    }

    initRevenueCat();
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
