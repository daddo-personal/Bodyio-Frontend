import * as FileSystem from "expo-file-system/legacy";
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
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import Purchases from "react-native-purchases";
import useRevenueCat from "../../hooks/useRevenueCat";
import { registerForPushNotificationsAsync } from "../../hooks/notifications";
import * as Notifications from "expo-notifications";
import { Linking } from "react-native";

const PRIVACY_POLICY_URL = "https://privacy.bodyio.org/privacy";
const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
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
  const [pushToken, setPushToken] = useState("");
  const [password, setPassword] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [isYearPickerVisible, setYearPickerVisible] = useState(false);

  // RevenueCat offerings hook
  const { offerings, loading: rcLoading } = useRevenueCat();

  async function savePushTokenToBackend(userId: number, pushToken: string) {
    try {
      await fetch(`${API_URL}/users/${userId}/push-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_token: pushToken }),
      });
      console.log("Saved push token for user", userId);
    } catch (e) {
      console.log("Failed to save push token:", e);
    }
  }

  async function openLink(url: string) {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Link error", "Could not open link.");
      return;
    }
    await Linking.openURL(url);
  }


  async function refreshUserFromBackend(userId: number) {
    try {
      setLoading(true);

      // 1) Ask backend to verify premium (this is what flips is_premium server-side)
      const verifyUrl = `${API_URL}/users/${userId}/${Platform.OS}/verify_premium`;
      await fetch(verifyUrl).catch(() => null);

      // 2) Pull fresh user
      const res = await fetch(`${API_URL}/users/${userId}`);
      if (!res.ok) return;

      const updated = await res.json();

      // 3) Update UI state + AsyncStorage
      setUser(updated);
      setFirstName(updated.first_name || "");
      setLastName(updated.last_name || "");
      setEmail(updated.email || "");
      setPushToken(updated.push_token || "");

      const h = Number(updated.height);
      if (!Number.isNaN(h) && h > 0) {
        const ft = Math.floor(h / 12);
        const inch = h % 12;
        setHeightFeet(String(ft));
        setHeightInches(String(inch));
      } else {
        setHeightFeet("");
        setHeightInches("");
      }

      setWeight(updated.weight?.toString() || "");
      await AsyncStorage.setItem("user", JSON.stringify(updated));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user?.id) return;

    // First confirm
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            // Second confirm with typed text
            router.push({
              pathname: "/deleteaccount",
              params: { userId: String(user.id) },
            });
          },
        },
      ]
    );
  }

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
          console.log("Saved is: ", saved);
          if (!saved) {
            Alert.alert("Not logged in", "Please log in first.");
            router.replace("/auth");
            return;
          }

          const parsed = JSON.parse(saved);

          // 🔹 1) Call verify_premium for this user + platform
          try {
            const verifyUrl = `${API_URL}/users/${parsed.id}/${Platform.OS}/verify_premium`;
            console.log("Calling verify_premium:", verifyUrl);

            const resVerify = await fetch(verifyUrl);
            console.log("verify_premium status:", resVerify.status);

            let verifyBody: any = null;
            try {
              verifyBody = await resVerify.json();
            } catch {
              // no-op if body is empty / not JSON
            }
            console.log("verify_premium response body:", verifyBody);
          } catch (err) {
            console.log("verify_premium error:", err);
          }

          // 🔹 2) Fetch fresh user from backend
          const res = await fetch(`${API_URL}/users/${parsed.id}`);
          const { status: existingStatus } = await Notifications.getPermissionsAsync();

          if (res.ok) {
            const data = await res.json();
            setUser(data);
            setFirstName(data.first_name || "");
            setLastName(data.last_name || "");
            setEmail(data.email || "");
            setPushToken(data.push_token || "");

            if (!pushToken) {
              if (existingStatus === "granted") {
                const token = await registerForPushNotificationsAsync();
                if (token) await savePushTokenToBackend(data.id, token);
              }
            }

            const h = Number(data.height);
            if (!Number.isNaN(h) && h > 0) {
              const ft = Math.floor(h / 12);
              const inch = h % 12;
              setHeightFeet(String(ft));
              setHeightInches(String(inch));
            } else {
              setHeightFeet("");
              setHeightInches("");
            }

            setWeight(data.weight?.toString() || "");

            await AsyncStorage.setItem("user", JSON.stringify(data));
          } else {
            // Fallback to saved user if /users/{id} fails
            setUser(parsed);
            setFirstName(parsed.first_name || "");
            setLastName(parsed.last_name || "");
            setEmail(parsed.email || "");

            const h = Number(parsed.height);
            if (!Number.isNaN(h) && h > 0) {
              const ft = Math.floor(h / 12);
              const inch = h % 12;
              setHeightFeet(String(ft));
              setHeightInches(String(inch));
            } else {
              setHeightFeet("");
              setHeightInches("");
            }

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
      const csvText = await res.text();

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

  async function handleRestorePurchases() {
    try {
      setLoading(true); // or create a separate restoring state if you prefer

      // 1) Restore via RevenueCat / StoreKit
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);

      // 2) Optional: re-verify / refresh backend premium status
      if (user?.id) {
        try {
          const verifyUrl = `${API_URL}/users/${user.id}/${Platform.OS}/verify_premium`;
          await fetch(verifyUrl);

          const res = await fetch(`${API_URL}/users/${user.id}`);
          if (res.ok) {
            const updated = await res.json();
            setUser(updated);
            await AsyncStorage.setItem("user", JSON.stringify(updated));
          }
        } catch (e) {
          console.log("Backend refresh after restore failed:", e);
        }
      }

      Alert.alert("Restored", "Your subscription has been restored.");
    } catch (e: any) {
      console.log("restorePurchases error:", e);
      Alert.alert("Restore Failed", e?.message || "Could not restore purchases.");
    } finally {
      setLoading(false);
    }
  }

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
      await Purchases.purchasePackage(pkg);

      Alert.alert("Success!", "Your Premium subscription is now active.", [
        {
          text: "OK",
          onPress: async () => {
            // optional: optimistic UI immediately
            setUser((prev: any) => (prev ? { ...prev, is_premium: true } : prev));

            // then confirm with backend + refresh all UI
            const id = user?.id;
            if (id) await refreshUserFromBackend(id);
          },
        },
      ]);
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
      const feet = parseInt(heightFeet, 10);
      const inches = parseInt(heightInches, 10);

      if (Number.isNaN(feet) || feet <= 0) {
        Alert.alert("Height error", "Enter a valid height (feet).");
        return;
      }
      if (Number.isNaN(inches) || inches < 0 || inches > 11) {
        Alert.alert("Height error", "Inches must be between 0 and 11.");
        return;
      }

      const totalHeightInches = feet * 12 + inches;

      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password: password,
          height: totalHeightInches,
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
                        ((user?.scan_count ?? 0) / 5) * 100,
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
                  {(user?.scan_count ?? 0)} / 5
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
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                    marginBottom: 10,
                  }}
                >
                  Premium Features
                </Text>

                <Text style={styles.bullet}>• Unlimited Scans</Text>
                <Text style={styles.bullet}>• All Body Metrics</Text>
                <Text style={styles.bullet}>• CSV Data Downloads</Text>
                <Text style={styles.bullet}>
                  • Goals & Insights for all metrics
                </Text>

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
                        {isMonthly
                          ? "Choose Monthly Plan"
                          : "Choose Yearly Plan"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {Platform.OS === "ios" && (
            <View style={{ marginBottom: 20 }}>
              <TouchableOpacity
                onPress={handleRestorePurchases}
                style={{
                  backgroundColor: "#1f1f1f",
                  borderColor: "#3f3f3f",
                  borderWidth: 1.5,
                  padding: 18,
                  borderRadius: 14,
                }}
              >
                <View
                  style={{
                    marginTop: 4,
                    backgroundColor: "#fff",
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>
                    Restore Purchases
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}


          <View
            style={{
              marginTop: 8,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: "#3f3f3f",
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 12, lineHeight: 16 }}>
              Subscription automatically renews unless canceled at least 24 hours before the
              end of the current period. Manage or cancel anytime in your account settings.
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <TouchableOpacity onPress={() => openLink(TERMS_OF_USE_URL)} style={{ paddingVertical: 8 }}>
                <Text style={{ color: "#fff", fontSize: 13, textDecorationLine: "underline" }}>
                  Terms of Use (EULA)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openLink(PRIVACY_POLICY_URL)} style={{ paddingVertical: 8 }}>
                <Text style={{ color: "#fff", fontSize: 13, textDecorationLine: "underline" }}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>

        {/* PROFILE INFO */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 Profile Info</Text>

          <Text style={styles.label}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            editable={editing}
            placeholder="First Name"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            editable={editing}
            placeholder="Last Name"
            placeholderTextColor="#9ca3af"
            style={styles.input}
          />

          <Text style={styles.label}>Email</Text>
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

          <Text style={styles.label}>Height</Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <TextInput
              value={heightFeet}
              onChangeText={setHeightFeet}
              editable={editing}
              placeholder="Feet"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              style={[styles.input, { width: "48%" }]}
            />
            <TextInput
              value={heightInches}
              onChangeText={setHeightInches}
              editable={editing}
              placeholder="Inches"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              style={[styles.input, { width: "48%" }]}
            />
          </View>

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
          onPress={() => {
            Alert.alert("Log Out", "Are you sure you want to log out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                  await AsyncStorage.removeItem("user");
                  await Purchases.logOut().catch(() => { });
                  router.replace("/auth");
                },
              },
            ]);
          }}
          style={[styles.button, { backgroundColor: "#fff" }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Log Out</Text>
        </TouchableOpacity>

        {/* DELETE ACCOUNT */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={[
            styles.button,
            { backgroundColor: "#ef4444", width: 200 }, // match width style
          ]}
        >
          <Text style={[styles.buttonText, { color: "#fff" }]}>Delete Account</Text>
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
  label: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 4,
  },
};
