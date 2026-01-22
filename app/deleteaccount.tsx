import React, { useState } from "react";
import { Alert, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.apiUrl;

export default function ConfirmDelete() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    // Optional extra confirm (recommended)
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to permanently delete your account? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_URL}/users/${userId}`, {
                method: "DELETE",
              });

              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                Alert.alert(
                  "Delete failed",
                  body?.detail || "Could not delete account."
                );
                return;
              }

              await AsyncStorage.removeItem("user");
              await Purchases.logOut().catch(() => {});
              Alert.alert("Account Deleted", "Your account has been deleted.");

              router.replace("/auth");
            } catch (e) {
              console.log("delete account error:", e);
              Alert.alert("Error", "Could not delete account.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1f1f1f" }}>
      <View style={{ padding: 24 }}>
        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          Delete Account
        </Text>

        <Text style={{ color: "#9ca3af", marginBottom: 16, lineHeight: 18 }}>
          This will permanently delete your account and all associated data.
          This action cannot be undone.
        </Text>

        <TouchableOpacity
          onPress={doDelete}
          disabled={loading}
          style={{
            backgroundColor: "#ef4444",
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            marginBottom: 12,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {loading ? "Deleting..." : "Delete Account"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={loading}
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
