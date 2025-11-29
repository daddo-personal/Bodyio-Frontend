// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Paint top safe area */}
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1f1f1f" }}>
        <StatusBar style="light" backgroundColor="#1f1f1f" />
        <Stack
          screenOptions={{
            headerShown: false,
            // Paint all stack scenes
            contentStyle: { backgroundColor: "#1f1f1f" },
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
