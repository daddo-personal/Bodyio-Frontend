import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

const API_URL = Constants.expoConfig.extra.apiUrl;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email) return Alert.alert("Missing info", "Enter your email.");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Always treat as success (backend returns ok even if not found)
      const data = await res.json().catch(() => ({}));
      console.log(data)
        if (!res.ok) {
            const msg = data?.detail?.message || data?.detail || "Could not send reset code.";
            return Alert.alert(msg);
        }

    //   if (data.status !== "ok") {
    //     return Alert.alert("Error", data.status || "Could not send reset code.");
    //   }

      Alert.alert("Check your email", "We sent a reset code if that email exists.");
      router.push({ pathname: "/reset-password", params: { email } });
    } catch (e) {
      Alert.alert("Network error", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1f1f1f", padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 }}>
        Forgot Password
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#9ca3af"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          backgroundColor: "#111",
          color: "#fff",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
        }}
      />

      <TouchableOpacity
        onPress={submit}
        disabled={loading}
        style={{
          backgroundColor: "#fff",
          padding: 14,
          borderRadius: 10,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700", textAlign: "center" }}>
          Send reset code
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
