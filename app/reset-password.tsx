import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const API_URL = Constants.expoConfig.extra.apiUrl;

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = (params.email as string) || "";

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !code || !newPassword) {
      return Alert.alert("Missing info", "Enter code and new password.");
    }
    if (newPassword.length < 6) {
      return Alert.alert("Weak password", "Use at least 6 characters.");
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return Alert.alert("Error", data.detail || "Could not reset password.");
      }

      Alert.alert("Success", "Password updated. Please log in.");
      router.replace("/auth");
    } catch {
      Alert.alert("Network error", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1f1f1f", padding: 16 }}>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 50 }}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 }}>
        Reset Password
      </Text>

      <Text style={{ color: "#9ca3af", marginBottom: 10 }}>
        Email: {email}
      </Text>

      <TextInput
        placeholder="6-digit code"
        placeholderTextColor="#9ca3af"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        style={{
          backgroundColor: "#111",
          color: "#fff",
          padding: 12,
          borderRadius: 10,
          marginBottom: 12,
        }}
      />

      <TextInput
        placeholder="New password"
        placeholderTextColor="#9ca3af"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
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
          Update password
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
