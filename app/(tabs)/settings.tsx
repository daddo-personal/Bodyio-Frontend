import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Sharing from "expo-sharing";
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePickerModal from "react-native-modal-datetime-picker";

const API_URL = Constants.expoConfig.extra.apiUrl;
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

export default function SettingsScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isYearPickerVisible, setYearPickerVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);


  // ✅ Load user on screen focus
  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        try {
          const saved = await AsyncStorage.getItem("user");
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
        } catch (err) {
          console.error("Error loading user:", err);
        } finally {
          setLoading(false);
        }
      };

      loadUser();
    }, [])
  );


  const handleDownloadData = async () => {
    if (!user) return;
    setDownloading(true);
    try {
      // Fetch user's metrics for the selected year
      console.log("Selected year is ", selectedYear)
      const res = await fetch(`${API_URL}/metrics_download?user_id=${user.id}&year=${selectedYear}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})); // try parsing JSON, fallback to empty
        Alert.alert(errData.detail);
        return;
      }

      // Save CSV to local file (legacy API)
      const fileUri = `${FileSystem.documentDirectory}metrics_${selectedYear}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: "utf8" });

      // Open share dialog
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: `Your Metrics Data (${selectedYear})`,
        UTI: "public.comma-separated-values-text",
      });
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to download your data.");
    } finally {
      setDownloading(false);
    }
  };

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
        Alert.alert("✅ Profile Updated", "Your changes have been saved.");
        await AsyncStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        setEditing(false);
      } else {
        Alert.alert("Error", updated.detail || "Could not update profile.");
      }
    } catch (error) {
      console.error("Update error:", error);
      Alert.alert("Network error", "Please try again later.");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("user");
          router.replace("/auth");
        },
      },
    ]);
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

  const isPremium = user?.is_premium;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>⚙️ Settings</Text>

        {/* 💳 Subscription */}
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
                <Text style={{ color: "#d1d5db", marginBottom: 6, fontSize: 14 }}>
                  Scans this month
                </Text>

                {/* Background Bar */}
                <View
                  style={{
                    width: "100%",
                    height: 12,
                    backgroundColor: "#3f3f3f",
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  {/* Filled Portion */}
                  <View
                    style={{
                      width: `${Math.min((user.scan_count || 0) / 5 * 100, 100)}%`,
                      height: "100%",
                      backgroundColor:
                        (user.scan_count || 0) >= 5
                          ? "#dc2626" // red when close to limit
                          : "#16a34a", // green otherwise
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

          {/* ✅ Feature Comparison */}
          <View style={styles.featuresContainer}>
            <View style={styles.featuresColumn}>
              <Text style={styles.featuresHeader}>Free Plan</Text>
              <Text style={styles.bullet}>• 5 scans per month</Text>
              <Text style={styles.bullet}>• Weight, BMI, Fat% Metrics</Text>
              <Text style={styles.bullet}>• Weight & BMI Goals</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.featuresColumn}>
              <Text style={[styles.featuresHeader, { color: "#16a34a" }]}>
                Premium Plan
              </Text>
              <Text style={styles.bullet}>• Unlimited Scans</Text>
              <Text style={styles.bullet}>• All Metrics</Text>
              <Text style={styles.bullet}>• Downloadable Data</Text>
              <Text style={styles.bullet}>• Goals for all metrics</Text>
            </View>
          </View>

          {/* 🪙 Pricing + Upgrade */}
          {!isPremium && (
            <View style={{ alignItems: "center", marginTop: 20 }}>
              <Text style={styles.priceText}>$2.99 / month</Text>
              <Text style={styles.subPriceText}>or $15.99 / year</Text>

              <TouchableOpacity
                onPress={() => Alert.alert("Upgrade", "Redirecting to payment...")}
                style={[styles.button, { backgroundColor: "#fff", marginTop: 12 }]}
              >
                <Text style={[styles.buttonText, { color: "#000" }]}>
                  Upgrade to Premium
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 👤 Profile */}
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
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            editable={editing}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            autoCapitalize="none"
            secureTextEntry={true}
          />
          <TextInput
            value={height}
            onChangeText={setHeight}
            editable={editing}
            placeholder="Height (inches)"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            keyboardType="numeric"
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
              style={[styles.button, { backgroundColor: "#16a34a", marginTop: 20 }]}
            >
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Donwloadable data*/}
        {isPremium && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📥 Download Your Data</Text>

            {/* Tap to open year picker */}
            <TouchableOpacity
              onPress={() => setYearPickerVisible(true)}
              style={styles.input}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>{selectedYear}</Text>
            </TouchableOpacity>

            {/* Modal Year Picker */}
            <DateTimePickerModal
              isVisible={isYearPickerVisible}
              mode="date"
              date={new Date(parseInt(selectedYear), 0, 1)}
              onConfirm={(date) => {
                setYearPickerVisible(false);
                setSelectedYear(date.getFullYear().toString());
              }}
              onCancel={() => setYearPickerVisible(false)}
              maximumDate={new Date()} // cannot pick future years
              minimumDate={new Date(new Date().getFullYear() - 10, 0, 1)} // last 10 years
              display="spinner" // shows a spinner instead of calendar
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


        {/* 💬 Contact Support */}
        <TouchableOpacity
          onPress={() => router.push("/contact")}
          style={[styles.button, { backgroundColor: "#fff" }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Contact Support</Text>
        </TouchableOpacity>

        {/* 🚪 Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.button, { backgroundColor: "#fff" }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Log Out</Text>
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
    backgroundColor: "#1f1f1f",
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
  usage: {
    fontSize: 15,
    color: "#d1d5db",
    marginTop: 6,
  },
  priceText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  subPriceText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  featuresContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  featuresColumn: {
    flex: 1,
    paddingHorizontal: 6,
  },
  featuresHeader: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    color: "#fff",
  },
  divider: {
    width: 1,
    backgroundColor: "#3f3f3f",
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
    color: "#fff",
    fontSize: 16,
  },
};
