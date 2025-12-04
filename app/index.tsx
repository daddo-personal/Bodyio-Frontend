// app/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRootNavigationState, useRouter } from "expo-router";
import { useEffect } from "react";

export default function IndexRedirect() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return; // ✅ Wait for router to be ready

    const init = async () => {
      try {
        // 2️⃣ Check if user is logged in
        const savedUser = await AsyncStorage.getItem("user");

        if (savedUser) {
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
