// app/index.tsx
import { useRouter, useRootNavigationState } from "expo-router";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function IndexRedirect() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return; // ✅ Wait for router to be ready

    const init = async () => {
      try {
        const seen = await AsyncStorage.getItem("seenOnboarding");

        // 2️⃣ Check if user is logged in
        const savedUser = await AsyncStorage.getItem("user");

        if (!seen) {
          // 👉 first time user — show onboarding
          router.replace("/onboarding");
        } else if (savedUser) {
          // 👉 already logged in — go to home dashboard
          router.replace("/(tabs)/home");
        } else {
          // 👉 seen onboarding but not logged in — go to auth screen
          router.replace("/auth");
        }
      } catch (err) {
        console.error("Init error:", err);
        router.replace("/auth"); // fallback
      }
    };

    init();
  }, [rootNavigationState]);

  return null;
}
