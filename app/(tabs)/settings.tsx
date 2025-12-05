import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import Purchases from "react-native-purchases";
import useRevenueCat from "../../hooks/useRevenueCat";

const API_URL = Constants.expoConfig.extra.apiUrl;

export default function SettingsScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [isYearPickerVisible, setYearPickerVisible] = useState(false);

  // RevenueCat offerings hook
  const { offerings, loading: rcLoading } = useRevenueCat();

  // -------------------------------------------
  // Load user + customerInfo on screen focus
  // -------------------------------------------
  useFocusEffect(
    useCallback(() => {
      async function loadCustomer() {
        try {
          const info = await Purchases.getCustomerInfo();
          setCustomerInfo(info);
        } catch (e) {
          console.log("RevenueCat customer info error:", e);
        }
      }

      async function loadUser() {
        try {
          const saved = await AsyncStorage.getItem("user");
          console.log("Saved is: ", saved)
          if (!saved) {
            Alert.alert("Not logged in", "Please log in first.");
            router.replace("/auth");
            return;
          }

          const parsed = JSON.parse(saved);
          const res = await fetch(`${API_URL}/users/${parsed.id}`);

          if (res.ok) {
            const data = await res.json();
            setUser(data);
            setFirstName(data.first_name || "");
            setLastName(data.last_name || "");
            setEmail(data.email || "");
            setHeight(data.height?.toString() || "");
            setWeight(data.weight?.toString() || "");

            await AsyncStorage.setItem("user", JSON.stringify(data));
          } else {
            setUser(parsed);
            setFirstName(parsed.first_name || "");
            setLastName(parsed.last_name || "");
            setEmail(parsed.email || "");
            setHeight(parsed.height?.toString() || "");
            setWeight(parsed.weight?.toString() || "");
          }
        } catch (e) {
          console.error("User load error:", e);
        } finally {
          setLoading(false);
        }
      }

      loadCustomer();
      loadUser();
    }, [router])
  );


  const handleDownloadData = async () => {
    if (!user) return;
    setDownloading(true);

    try {
      console.log("Selected year is", selectedYear);

      // 1. Fetch CSV from backend
      const res = await fetch(
        `${API_URL}/metrics_download?user_id=${user.id}&year=${selectedYear}`
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert(err.detail || "Failed to download data.");
        return;
      }

      // 2. Get raw CSV text
      const csvText = await res.text();   // <-- THIS FIXES IT

      // 3. Save CSV locally
      const fileUri = `${FileSystem.documentDirectory}metrics_${selectedYear}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvText, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 4. Share CSV
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: `Your Metrics Data (${selectedYear})`,
        UTI: "public.comma-separated-values-text",
      });

    } catch (err) {
      console.error("CSV download error:", err);
      Alert.alert("Error", "Failed to download your data.");
    } finally {
      setDownloading(false);
    }
  };

  // -------------------------------------------
  // Ensure RevenueCat appUserID matches backend user.id
  // -------------------------------------------
  useEffect(() => {
    async function ensureRevenueCatUser() {
      if (!user?.id) return;

      try {
        const expectedId = String(user.id);
        const currentId = await Purchases.getAppUserID();
        console.log("RC current appUserID:", currentId, "expected:", expectedId);

        if (currentId !== expectedId) {
          const result = await Purchases.logIn(expectedId);
          console.log("RevenueCat logIn result (settings):", result);

          // refresh customer info after logIn
          const info = await Purchases.getCustomerInfo();
          setCustomerInfo(info);
          console.log("RC customerInfo after logIn:", info);
        }
      } catch (e) {
        console.log("RevenueCat logIn / ensure user error:", e);
      }
    }

    ensureRevenueCatUser();
  }, [user?.id]);

  // -------------------------------------------
  // Self-heal premium from RevenueCat backend (/verify_premium)
  // -------------------------------------------
  useEffect(() => {
    async function syncPremiumFromBackend() {
      if (!user?.id) return;

      try {
        const res = await fetch(`${API_URL}/users/${user.id}/verify_premium`);
        if (!res.ok) {
          console.log("verify_premium failed:", res.status);
          return;
        }
        const data = await res.json();
        console.log("verify_premium response:", data);

        // If backend updated is_premium, refetch user
        const userRes = await fetch(`${API_URL}/users/${user.id}`);
        if (userRes.ok) {
          const updatedUser = await userRes.json();
          setUser(updatedUser);
          await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
          console.log("User after verify_premium sync:", updatedUser);
        }
      } catch (e) {
        console.log("Error syncing premium from backend:", e);
      }
    }

    syncPremiumFromBackend();
  }, [user?.id]);

  // -------------------------------------------
  // Real-time subscription refresh listener
  // -------------------------------------------
  useEffect(() => {
    const listener = Purchases.addCustomerInfoUpdateListener(async (info) => {
      console.log("🔄 RevenueCat customer updated:", info);
      setCustomerInfo(info);

      if (user?.id) {
        try {
          const res = await fetch(`${API_URL}/users/${user.id}`);
          if (res.ok) {
            const updated = await res.json();
            setUser(updated);
            //await AsyncStorage.setItem("user", JSON.stringify(updated));
            console.log("🔥 User refreshed after purchase", updated);
          }
        } catch (err) {
          console.log("❌ Could not refresh user after purchase", err);
        }
      }
    });

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [user]);

  // -------------------------------------------
  // Purchase handler
  // -------------------------------------------
  async function purchasePackage(pkg) {
    try {
      const result = await Purchases.purchasePackage(pkg);
      console.log("🎉 Purchase success:", result);
      Alert.alert("Success!", "Your Premium subscription is now active.");
    } catch (err: any) {
      if (err.userCancelled) return;
      console.log("❌ Purchase error:", err);
      Alert.alert("Purchase Failed", err.message || "Unknown error occurred.");
    }
  }

  // -------------------------------------------
  // Save profile
  // -------------------------------------------
  const handleSave = async () => {
    if (!firstName || !lastName || !email) {
      Alert.alert("Missing info", "Please fill all required fields.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password: password,
          height: parseFloat(height),
          weight: parseFloat(weight),
        }),
      });

      const updated = await res.json();

      if (res.ok) {
        Alert.alert("Profile Updated", "Your changes have been saved.");
        await AsyncStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        setEditing(false);
      } else {
        Alert.alert("Error", updated.detail || "Could not update profile.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Network error", "Please try again later.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  // Backend premium status
  const isPremium = user?.is_premium;
  console.log("isPremium (backend):", isPremium);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>⚙️ Settings</Text>

        {/* SUBSCRIPTION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💳 Your Plan</Text>

          <View
            style={[
              styles.planCard,
              { borderColor: isPremium ? "#16a34a" : "#9ca3af" },
            ]}
          >
            <Text
              style={[
                styles.planTitle,
                { color: isPremium ? "#16a34a" : "#d1d5db" },
              ]}
            >
              {isPremium ? "⭐ Premium User" : "🆓 Free User"}
            </Text>

            {!isPremium && (
              <View style={{ width: "100%", marginTop: 10 }}>
                <Text style={{ color: "#d1d5db", marginBottom: 6 }}>
                  Scans this month
                </Text>

                <View
                  style={{
                    width: "100%",
                    height: 12,
                    backgroundColor: "#3f3f3f",
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(
                        ((user.scan_count || 0) / 5) * 100,
                        100
                      )}%`,
                      height: "100%",
                      backgroundColor: "#16a34a",
                    }}
                  />
                </View>

                <Text
                  style={{
                    color: "#9ca3af",
                    marginTop: 6,
                    fontSize: 13,
                    textAlign: "right",
                  }}
                >
                  {(user.scan_count || 0)} / 5
                </Text>
              </View>
            )}
          </View>

          {/* PRICING OPTIONS */}
          {!isPremium && (
            <View style={{ marginTop: 24, width: "100%" }}>

              {/* Shared features list */}
              <View
                style={{
                  backgroundColor: "#1f1f1f",
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#3f3f3f",
                  marginBottom: 20,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 }}>
                  Premium Features
                </Text>

                <Text style={styles.bullet}>• Unlimited Scans</Text>
                <Text style={styles.bullet}>• All Body Metrics</Text>
                <Text style={styles.bullet}>• CSV Data Downloads</Text>
                <Text style={styles.bullet}>• Goals & Insights for all metrics</Text>
              </View>

              {offerings?.availablePackages?.map((pkg) => {
                const p = pkg.product;
                const isMonthly = pkg.packageType === "MONTHLY";
                const isAnnual = pkg.packageType === "ANNUAL";

                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    onPress={() => purchasePackage(pkg)}
                    style={{
                      backgroundColor: isAnnual ? "#252c1f" : "#1f1f1f",
                      borderColor: isAnnual ? "#16a34a" : "#3f3f3f",
                      borderWidth: 1.5,
                      padding: 18,
                      borderRadius: 14,
                      marginBottom: 20,
                    }}
                  >
                    {/* BEST VALUE badge */}
                    {isAnnual && (
                      <View
                        style={{
                          position: "absolute",
                          top: -12,
                          right: -12,
                          backgroundColor: "#16a34a",
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          BEST VALUE
                        </Text>
                      </View>
                    )}

                    {/* Title */}
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: "#fff",
                        marginBottom: 4,
                      }}
                    >
                      {isMonthly ? "Monthly Premium" : "Yearly Premium"}
                    </Text>

                    {/* Price */}
                    <Text
                      style={{
                        fontSize: 16,
                        color: "#d1d5db",
                        marginBottom: 12,
                      }}
                    >
                      {p.priceString} {isMonthly ? "/ month" : "/ year"}
                    </Text>

                    {/* Extra yearly savings text */}
                    {isAnnual && (
                      <Text
                        style={{
                          color: "#16a34a",
                          marginBottom: 12,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        Save 50% compared to monthly
                      </Text>
                    )}

                    {/* Button */}
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: "#fff",
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#000",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {isMonthly ? "Choose Monthly Plan" : "Choose Yearly Plan"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </View>

        {/* PROFILE INFO */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 Profile Info</Text>

          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            editable={editing}
            placeholder="First Name"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />

          <TextInput
            value={lastName}
            onChangeText={setLastName}
            editable={editing}
            placeholder="Last Name"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />

          <TextInput
            value={email}
            onChangeText={setEmail}
            editable={editing}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            editable={editing}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry={true}
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            value={height}
            onChangeText={setHeight}
            editable={editing}
            placeholder="Height (inches)"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            style={styles.input}
          />

          {!editing ? (
            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={[styles.button, { backgroundColor: "#fff", marginTop: 20 }]}
            >
              <Text style={[styles.buttonText, { color: "#000" }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.button,
                { backgroundColor: "#16a34a", marginTop: 20 },
              ]}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PREMIUM DATA DOWNLOAD */}
        {isPremium && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📥 Download Your Data</Text>

            <TouchableOpacity
              onPress={() => setYearPickerVisible(true)}
              style={styles.input}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>
                {selectedYear}
              </Text>
            </TouchableOpacity>

            <DateTimePickerModal
              isVisible={isYearPickerVisible}
              mode="date"
              date={new Date(parseInt(selectedYear), 0, 1)}
              onConfirm={(date) => {
                setSelectedYear(date.getFullYear().toString());
                setYearPickerVisible(false);
              }}
              onCancel={() => setYearPickerVisible(false)}
              display="spinner"
            />

            <TouchableOpacity
              onPress={handleDownloadData}
              style={[styles.button, { backgroundColor: "#16a34a" }]}
              disabled={downloading}
            >
              <Text style={styles.buttonText}>
                {downloading ? "Downloading..." : "Download CSV"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CONTACT */}
        <TouchableOpacity
          onPress={() => router.push("/contact")}
          style={[styles.button, { backgroundColor: "#fff" }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>
            Contact Support
          </Text>
        </TouchableOpacity>

        {/* LOG OUT */}
        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.removeItem("user");
            router.replace("/auth");
          }}
          style={[styles.button, { backgroundColor: "#fff" }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    backgroundColor: "#1f1f1f",
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    color: "#fff",
  },
  card: {
    backgroundColor: "#2c2c2c",
    padding: 20,
    borderRadius: 16,
    width: "100%",
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#fff",
  },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  bullet: {
    fontSize: 14,
    color: "#d1d5db",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#3f3f3f",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: "#fff",
    backgroundColor: "#1f1f1f",
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    alignSelf: "center",
    width: 200,
    marginTop: 8,
  },
  buttonText: {
    fontWeight: "600",
    color: "#000",
    fontSize: 16,
  },
};
