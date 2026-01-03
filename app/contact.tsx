import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig.extra.apiUrl;
const MAX_CHARS = 500;

export default function ContactScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [selectedType, setSelectedType] = useState<"bug" | "feedback">("feedback");

  // 🔹 Load user info
  useEffect(() => {
    const loadUser = async () => {
      try {
        const saved = await AsyncStorage.getItem("user");
        if (saved) {
          const parsed = JSON.parse(saved);
          const fullName =
            parsed.first_name && parsed.last_name
              ? `${parsed.first_name} ${parsed.last_name}`
              : parsed.first_name || parsed.last_name || "";
          setName(fullName);
          setUserEmail(parsed.email || "");
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    };
    loadUser();
  }, []);

  // 🔹 Submit feedback
  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert("Missing Message", "Please enter a message before sending.");
      return;
    }

    if (message.length > MAX_CHARS) {
      Alert.alert("Message Too Long", `Please stay under ${MAX_CHARS} characters.`);
      return;
    }

    if (!userEmail) {
      Alert.alert("Missing Email", "We couldn’t find your email. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Anonymous",
          email: userEmail,
          message,
          type: selectedType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert("✅ Thank You!", "Your message has been sent successfully!");
        setMessage("");
      } else {
        Alert.alert("Error", data.detail || "Failed to send feedback.");
      }
    } catch (err) {
      console.error("Feedback error:", err);
      Alert.alert("Network Error", "Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* 🔙 Ionicons Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>📩 Contact Support</Text>
        <Text style={styles.subtitle}>
          Found a bug or want to share feedback? Let us know!
        </Text>

        {/* 🔹 Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === "feedback" && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType("feedback")}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="bulb-outline"
                size={16}
                color={selectedType === "feedback" ? "#000" : "#9ca3af"}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.typeText,
                  selectedType === "feedback" && styles.typeTextActive,
                ]}
              >
                Feedback
              </Text>
            </View>
          </TouchableOpacity>


          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === "bug" && styles.typeButtonActive,
            ]}
            onPress={() => setSelectedType("bug")}
          >
            <Text
              style={[
                styles.typeText,
                selectedType === "bug" && styles.typeTextActive,
              ]}
            >
              🐞 Bug
            </Text>
          </TouchableOpacity>
        </View>

        {/* Message with character limit */}
        <TextInput
          placeholder={`Describe your ${selectedType}`}
          placeholderTextColor="#9ca3af"
          value={message}
          onChangeText={(text) => {
            if (text.length <= MAX_CHARS) {
              setMessage(text);
            }
          }}
          style={[styles.input, { height: 120, textAlignVertical: "top" }]}
          multiline
        />

        {/* Character Counter */}
        <Text
          style={[
            styles.charCount,
            message.length > MAX_CHARS * 0.8 && { color: "#facc15" }, // Yellow warning
            message.length === MAX_CHARS && { color: "#ef4444" }, // Red danger
          ]}
        >
          {message.length}/{MAX_CHARS}
        </Text>

        {userEmail ? (
          <View style={styles.emailContainer}>
            <Text style={styles.emailText}>📧 From: {userEmail}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[
            styles.button,
            { backgroundColor: loading ? "#6b7280" : "#ffffffff" },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#000000ff" />
          ) : (
            <Text style={[styles.buttonText, { color: "#000" }]}>Send Message</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#1f1f1f",
  },

  // 🔙 Back Arrow Styles
  backButton: {
    width: "100%",
    marginBottom: 10,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#9ca3af",
    marginBottom: 20,
    textAlign: "center",
  },
  typeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: "#3f3f3f",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 5,
  },
  typeButtonActive: {
    backgroundColor: "#ffffffff",
    borderColor: "#ffffffff",
  },
  typeText: { color: "#9ca3af", fontWeight: "500" },
  typeTextActive: { color: "#000", fontWeight: "600" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#3f3f3f",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    backgroundColor: "#2c2c2c",
    marginBottom: 8,
  },
  charCount: {
    width: "100%",
    textAlign: "right",
    color: "#9ca3af",
    marginBottom: 16,
    fontSize: 12,
  },
  emailContainer: {
    width: "100%",
    marginBottom: 20,
    backgroundColor: "#2c2c2c",
    borderRadius: 8,
    padding: 12,
  },
  emailText: { color: "#9ca3af", fontSize: 14 },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
