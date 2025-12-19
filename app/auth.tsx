import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { registerForPushNotificationsAsync } from "../hooks/notifications";

import {
  Alert,
  Image,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases from "react-native-purchases";

const API_URL = Constants.expoConfig.extra.apiUrl;

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔒 track whether *this* session is a Google login attempt
  const [googleLoginRequested, setGoogleLoginRequested] = useState(false);

  // -------------------------
  // Google OAuth config
  // -------------------------
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId:
      "974834514847-ia5odto5ftc4laovp6oc3q3ch44ghi8r.apps.googleusercontent.com",
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    // ✅ Only react to response if user actually tapped "Continue with Google"
    if (!googleLoginRequested) return;

    if (response?.type === "success") {
      const { authentication } = response;
      if (authentication?.accessToken) {
        loginWithGoogleOnBackend(authentication.accessToken);
      } else {
        Alert.alert("Error", "No access token returned from Google.");
        setGoogleLoginRequested(false);
      }
    } else if (response?.type === "error" || response?.type === "dismiss") {
      // cleanup on cancel / error
      setGoogleLoginRequested(false);
    }
  }, [response, googleLoginRequested]);

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
  // Email/password login
  // -------------------------
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // 1. Save user
        console.log("auth: ", JSON.stringify(data))
        await AsyncStorage.setItem("user", JSON.stringify(data));

        // 📌 Check for push_token, if not registerForPushNotification
        if (!data.push_token) {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await savePushTokenToBackend(data.id, token);
          }
        }

        // 2. LOGIN to RevenueCat 🔥
        try {
          const rcResult = await Purchases.logIn(String(data.id));
          console.log("RevenueCat logIn (email):", rcResult);
        } catch (e) {
          console.log("RevenueCat logIn error (email):", e);
        }

        // 3. Redirect
        router.replace("/(tabs)/home");
      } 
      else if (res.status === 403) {
        await AsyncStorage.setItem("pendingUser", JSON.stringify({ email: email }));
        const res = await fetch(`${API_URL}/auth/resend-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email }),
        });

        if (res.ok) {
        router.push({
        pathname: "/verify-email",
        params: { email: email },
      });
    }
      }
      
      else {
        Alert.alert("Login failed", data.detail || "Invalid credentials");

      }
    } catch (error) {
      console.error("❌ Network error:", error);
      Alert.alert("Network error", "Please try again later.");
    }
  };

  // -------------------------
  // Google login → backend `/login/google`
  // -------------------------
  const loginWithGoogleOnBackend = async (accessToken: string) => {
    try {
      const res = await fetch(`${API_URL}/login/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      const data = await res.json();

      // reset the flag once we’ve handled the response
      setGoogleLoginRequested(false);

      if (!res.ok) {
        console.error("Backend Google login error:", data);
        Alert.alert(
          "Error",
          data.detail || "Could not sign in with Google. Please try again."
        );
        return;
      }

      // 1. Save user
      await AsyncStorage.setItem("user", JSON.stringify(data));
      console.log("auth loginWithGoogleOnBackend: ", JSON.stringify(data))
      // 2. LOGIN to RevenueCat 🔥
      try {
        const rcResult = await Purchases.logIn(String(data.id));
        console.log("RevenueCat logIn (google):", rcResult);
      } catch (e) {
        console.log("RevenueCat logIn error (google):", e);
      }

      // 3. Redirect
      router.replace("/(tabs)/home");
    } catch (err) {
      console.error("Google login backend error", err);
      setGoogleLoginRequested(false);
      Alert.alert("Network error", "Could not reach server. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome Back 👋</Text>

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

        {/* Email/password login */}
        <TouchableOpacity
          onPress={handleLogin}
          style={[styles.button, { backgroundColor: "#fff" }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Log In</Text>
        </TouchableOpacity>

        {/* Google login */}
        <TouchableOpacity
          disabled={!request}
          onPress={() => {
            setGoogleLoginRequested(true);
            promptAsync();
          }}
          style={[
            styles.button,
            {
              backgroundColor: "#3c4043",
              flexDirection: "row",
              marginTop: 12,
              justifyContent: "center",
              opacity: request ? 1 : 0.6,
            },
          ]}
        >
          <Image
            source={{
              uri: "https://developers.google.com/identity/images/g-logo.png",
            }}
            style={{
              width: 20,
              height: 20,
              marginRight: 10,
              backgroundColor: "white",
              borderRadius: 10,
            }}
          />
          <Text style={[styles.buttonText, { color: "#fff" }]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/createaccount")}
          style={{ marginTop: 20 }}
        >
          <Text style={styles.linkText}>
            Don’t have an account?{" "}
            <Text style={{ color: "#fff", fontWeight: "600" }}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles: any = {
  safeArea: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#1f1f1f",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#9ca3af",
    marginBottom: 24,
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
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  linkText: {
    textAlign: "center",
    color: "#d1d5db",
    marginTop: 12,
    fontSize: 14,
  },
};
