import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HomeScreen() {
  const router = useRouter();

  const handleGetStarted = async () => {
    try {
      const seen = await AsyncStorage.getItem("seenOnboarding");

      if (seen === "true") router.push("/upload");
      else router.push("/onboarding");
    } catch (error) {
      console.error("Error checking onboarding:", error);
      Alert.alert("Error", "Something went wrong. Try again.");
    }
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: "#1f1f1f",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    }}>
      
      {/* Heading */}
      <Text style={{
        fontSize: 26,
        fontWeight: "800",
        color: "#fff",
        marginBottom: 8,
        textAlign: "center",
      }}>
        Welcome to Body.io 🚀
      </Text>

      {/* Subtext */}
      <Text style={{
        textAlign: "center",
        color: "#d1d5db",
        fontSize: 16,
        marginBottom: 32,
        lineHeight: 22,
      }}>
        Track your fat %, muscle %, BMI, and more — all from just 3 photos.  
        Set goals and monitor your progress over time!
      </Text>

      {/* Upload Metrics Button */}
      <TouchableOpacity
        onPress={handleGetStarted}
        style={{
          backgroundColor: "#ffffffff",
          paddingVertical: 16,
          paddingHorizontal: 36,
          borderRadius: 12,
          marginBottom: 16,
          width: "80%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
          📸 Upload Metrics
        </Text>
      </TouchableOpacity>

      {/* Set Goals Button */}
      <TouchableOpacity
        onPress={() => router.push("/goals")}
        style={{
          backgroundColor: "#fff",
          paddingVertical: 16,
          paddingHorizontal: 36,
          borderRadius: 12,
          width: "80%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
          🎯 Set Goals
        </Text>
      </TouchableOpacity>

      {/* Optional: Small tip text */}
      <Text style={{
        color: "#9ca3af",
        fontSize: 14,
        marginTop: 24,
        textAlign: "center",
      }}>
        Tip: Upload scans regularly to see accurate trends and predictions!
      </Text>
    </View>
  );
}
