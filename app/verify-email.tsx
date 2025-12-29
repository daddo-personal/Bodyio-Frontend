import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { registerForPushNotificationsAsync } from "../hooks/notifications";


const API_URL = Constants.expoConfig.extra.apiUrl;

export default function VerifyEmailScreen() {
    const router = useRouter();
    const { email } = useLocalSearchParams() as { email?: string };

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    const [pendingUser, setPendingUser] = useState<any>(null);

    // Load the pending user data (created during signup)
    useEffect(() => {
        async function loadUser() {
            const saved = await AsyncStorage.getItem("pendingUser");
            if (saved) {
                setPendingUser(JSON.parse(saved));
            }
        }
        loadUser();
    }, []);

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


    // ---------------------------
    // SUBMIT VERIFICATION CODE
    // ---------------------------
    const handleVerify = async () => {
        if (!code || code.length !== 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit code.");
            return;
        }

        if (!pendingUser) {
            Alert.alert("Error", "No pending user found.");
            return;
        }

        try {
            setLoading(true);
            console.log("code: ", code)
            const res = await fetch(`${API_URL}/auth/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: pendingUser.email,
                    code,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                Alert.alert("Error", data.detail || "Verification failed");
                return;
            }

            // -----------------
            // SUCCESS
            // -----------------
            await AsyncStorage.removeItem("pendingUser");
            await AsyncStorage.setItem("user", JSON.stringify(data.user));
            const token = await registerForPushNotificationsAsync();
            if (token) {
                await savePushTokenToBackend(data.user.id, token);
            }
            Alert.alert("✅ Account created", `Welcome ${data.user.first_name}!`);
            router.replace("/userinfo");

        } catch (err) {
            Alert.alert("Network Error", "Could not verify code. Try again.");
        } finally {
            setLoading(false);
        }
    };

    // ---------------------------
    // RESEND CODE
    // ---------------------------
    const resendCode = async () => {
        if (!pendingUser) return;

        try {
            setResendLoading(true);
            const res = await fetch(`${API_URL}/auth/resend-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: pendingUser.email}),
            });

            const data = await res.json();

            if (!res.ok) {
                Alert.alert("Error", data.detail || "Could not resend code");
                return;
            }

            Alert.alert("📨 Code Sent", "Check your email for a new code.");
        } catch (err) {
            Alert.alert("Network Error", "Could not resend code.");
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Verify Your Email</Text>

            <Text style={styles.subtitle}>
                Enter the 6-digit code sent to:
            </Text>

            <Text style={styles.emailText}>{email}</Text>

            {/* Code Input */}
            <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#9ca3af"
                style={styles.input}
            />

            {/* Verify Button */}
            <TouchableOpacity
                onPress={handleVerify}
                disabled={loading}
                style={[styles.button, { backgroundColor: "#fff" }]}
            >
                <Text style={[styles.buttonText, { color: "#000" }]}>
                    {loading ? "Verifying..." : "Verify Email"}
                </Text>
            </TouchableOpacity>

            {/* Resend Code */}
            <TouchableOpacity
                onPress={resendCode}
                disabled={resendLoading}
                style={{
                    marginTop: 20,
                }}
            >
                <Text style={styles.resendText}>
                    {resendLoading ? "Resending..." : "Resend Code"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

// ----------------------
// STYLES
// ----------------------
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1f1f1f",
        padding: 24,
        justifyContent: "center",
    },
    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 10,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#d1d5db",
        textAlign: "center",
        marginBottom: 4,
    },
    emailText: {
        color: "#fff",
        textAlign: "center",
        marginBottom: 20,
        fontWeight: "600",
    },
    input: {
        borderWidth: 1,
        borderColor: "#3f3f3f",
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
        fontSize: 18,
        textAlign: "center",
        color: "#fff",
        backgroundColor: "#2c2c2c",
        letterSpacing: 4,
    },
    button: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    buttonText: {
        fontWeight: "600",
        fontSize: 17,
    },
    resendText: {
        color: "#60a5fa",
        fontSize: 15,
        textAlign: "center",
    },
});
