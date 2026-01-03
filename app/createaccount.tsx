import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { Alert, Image, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { registerForPushNotificationsAsync } from "../hooks/notifications";

const API_URL = Constants.expoConfig?.extra?.apiUrl;
const googleWebClientId = Constants.expoConfig?.extra?.googleWebClientId;

WebBrowser.maybeCompleteAuthSession();

export default function CreateAccount() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // -------------------------
  // iOS: expo-auth-session
  // -------------------------
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: "974834514847-ia5odto5ftc4laovp6oc3q3ch44ghi8r.apps.googleusercontent.com",
    androidClientId: "974834514847-1b5l0g5aik74ma961e17jehv925o9brn.apps.googleusercontent.com",
    scopes: ["profile", "email"],
  });

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

  // -------------------------
  // Android: native Google Sign-In
  // -------------------------
  useEffect(() => {
    if (Platform.OS === "android") {
      if (!googleWebClientId) {
        console.warn("Missing extra.googleWebClientId in app.json");
      }
      GoogleSignin.configure({
        webClientId: googleWebClientId, // ✅ must be WEB client id
        offlineAccess: false,
      });
    }
  }, []);

  // Handle iOS Google response -> send access_token
  useEffect(() => {
    if (Platform.OS !== "ios") return;

    if (response?.type === "success") {
      const { authentication } = response;
      if (!authentication?.accessToken) {
        Alert.alert("Error", "No access token returned from Google.");
        return;
      }
      signupWithGoogleIOS(authentication.accessToken);
    }
  }, [response]);

  // -------------------------
  // Email/Password signup (unchanged)
  // -------------------------
  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert("Missing info", "Please fill all fields.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Error", data.detail || "Signup failed");
        return;
      }

      await AsyncStorage.setItem("pendingUser", JSON.stringify({ email }));
      Alert.alert(
        "Verify your email",
        "We've sent a 6-digit code to your email. Enter it to complete signup."
      );

      router.push({ pathname: "/verify-email", params: { email } });
    } catch (error) {
      console.error("❌ Signup error", error);
      Alert.alert("Network error", "Please try again later.");
    }
  };

  // -------------------------
  // Google signup helpers
  // -------------------------
  const signupWithGoogleIOS = async (accessToken: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          Alert.alert("Account exists", "That Google account already exists. Please log in.");
          router.replace("/auth");
          return;
        }
        Alert.alert("Error", data.detail || "Could not sign up with Google.");
        return;
      }

      await AsyncStorage.setItem("user", JSON.stringify(data));
      Alert.alert("✅ Account created!", `Welcome ${data.first_name || data.email}!`);
      if (data.push_token == undefined) {
        const token = await registerForPushNotificationsAsync();
        console.log("Saving registering push notification")
        console.log("New token is: ", token)
        if (token) {
          await savePushTokenToBackend(data.id, token);
        }
      }
      router.replace("/userinfo");
    } catch (e) {
      console.error("Google signup error (iOS):", e);
      Alert.alert("Network error", "Could not reach server. Please try again.");
    }
  };

  const signupWithGoogleAndroid = async (idToken: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          Alert.alert("Account exists", "That Google account already exists. Please log in.");
          router.replace("/auth");
          return;
        }
        Alert.alert("Error", data.detail || "Could not sign up with Google.");
        return;
      }

      await AsyncStorage.setItem("user", JSON.stringify(data));
      Alert.alert("✅ Account created!", `Welcome ${data.first_name || data.email}!`);
      if (data.push_token == undefined) {
        const token = await registerForPushNotificationsAsync();
        console.log("Saving registering push notification")
        console.log("New token is: ", token)
        if (token) {
          await savePushTokenToBackend(data.id, token);
        }
      }
      router.replace("/userinfo");
    } catch (e) {
      console.error("Google signup error (Android):", e);
      Alert.alert("Network error", "Could not reach server. Please try again.");
    }
  };

  const signUpWithGoogleAndroidNative = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();

      const idToken = (result as any)?.data?.idToken ?? (result as any)?.idToken;
      if (!idToken) {
        Alert.alert("Error", "No ID token returned from Google.");
        return;
      }

      await signupWithGoogleAndroid(idToken);
    } catch (e: any) {
      console.log("Native Google sign-up error:", e);
      Alert.alert("Google Sign-Up failed", e?.message || "Please try again.");
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          placeholder="First Name"
          placeholderTextColor="#9ca3af"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
        />
        <TextInput
          placeholder="Last Name"
          placeholderTextColor="#9ca3af"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
        />
        <TextInput
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        {/* Email/password */}
        <TouchableOpacity
          onPress={handleSignup}
          style={[styles.button, { backgroundColor: "#fff", marginTop: 8 }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Sign Up</Text>
        </TouchableOpacity>

        {/* Google */}
        <TouchableOpacity
          disabled={Platform.OS === "ios" ? !request : false}
          onPress={() => {
            if (Platform.OS === "android") {
              signUpWithGoogleAndroidNative();
            } else {
              // iOS: keep browser flow
              promptAsync({ useProxy: false });
            }
          }}
          style={[
            styles.button,
            {
              backgroundColor: "#3c4043",
              flexDirection: "row",
              marginTop: 12,
              justifyContent: "center",
              opacity: Platform.OS === "ios" && !request ? 0.6 : 1,
            },
          ]}
        >
          <Image
            source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
            style={{
              width: 20,
              height: 20,
              marginRight: 10,
              backgroundColor: "white",
              borderRadius: 10,
            }}
          />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Already have account */}
        <TouchableOpacity onPress={() => router.push("/auth")} style={{ marginTop: 16 }}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkHighlight}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles: any = {
  safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#3f3f3f",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: "#fff",
    backgroundColor: "#2c2c2c",
  },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  buttonText: { fontWeight: "600", color: "#fff", fontSize: 16 },
  linkText: { textAlign: "center", color: "#d1d5db", fontSize: 14 },
  linkHighlight: { color: "#ffffff", fontWeight: "600" },
};
