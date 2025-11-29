import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Image, SafeAreaView, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig.extra.apiUrl;

WebBrowser.maybeCompleteAuthSession();

export default function CreateAccount() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: "974834514847-ia5odto5ftc4laovp6oc3q3ch44ghi8r.apps.googleusercontent.com",
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetchUserInfo(authentication.accessToken);
      }
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      await AsyncStorage.setItem("user", JSON.stringify(user));
      Alert.alert("✅ Signed in", `Welcome ${user.name}`);
    } catch (err) {
      console.error("Error fetching user info", err);
      Alert.alert("Error", "Could not fetch Google user info.");
    }
  };

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert("Missing info", "Please fill all fields.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        await AsyncStorage.setItem("user", JSON.stringify(data));
        Alert.alert("✅ Account created", `Welcome ${data.first_name}!`);
        router.replace("/userinfo");
      } else {
        Alert.alert("Error", data.detail || "Signup failed");
      }
    } catch (error) {
      console.error("❌ Signup error", error);
      Alert.alert("Network error", "Please try again later.");
    }
  };

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

        {/* ✅ Sign Up */}
        <TouchableOpacity
          onPress={handleSignup}
          style={[styles.button, { backgroundColor: "#fff", marginTop: 8 }]}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>Sign Up</Text>
        </TouchableOpacity>

        {/* ✅ Google Sign-In Button (dark gray variant) */}
        <TouchableOpacity
          disabled={!request}
          onPress={() => promptAsync()}
          style={[styles.button, { backgroundColor: "#3c4043", flexDirection: "row", marginTop: 12, justifyContent: "center" }]}
        >
          <Image
            source={{
              uri: "https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg",
            }}
            style={{ width: 20, height: 20, marginRight: 10, backgroundColor: "white", borderRadius: 10 }}
          />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* ✅ Already have account */}
        <TouchableOpacity onPress={() => router.push("/auth")} style={{ marginTop: 16 }}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkHighlight}>Log in</Text>
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
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
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
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "600",
    color: "#fff",
    fontSize: 16,
  },
  linkText: {
    textAlign: "center",
    color: "#d1d5db",
    fontSize: 14,
  },
  linkHighlight: {
    color: "#ffffff",
    fontWeight: "600",
  },
};
