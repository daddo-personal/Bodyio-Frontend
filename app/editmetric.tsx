import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
    ActivityIndicator,
    StyleSheet,
    Animated,
    Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";   // ⭐ ADD THIS
import DateTimePickerModal from "react-native-modal-datetime-picker";

const API_URL = Constants.expoConfig.extra.apiUrl;

export default function EditMetricScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const metric = params.metric ? JSON.parse(params.metric as string) : null;
    const initialDate = metric?.taken_at ? new Date(metric.taken_at) : new Date();
    const [takenAt, setTakenAt] = useState(initialDate);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

    const [toastMessage, setToastMessage] = useState("");
    const toastOpacity = useState(new Animated.Value(0))[0];
    const [userId, setUserId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [weight, setWeight] = useState(metric?.weight?.toString() || "");

    const [user, setUser] = useState<any>(null);
    const [isPremium, setIsPremium] = useState(false);

    const [front, setFront] = useState<string | null>(metric?.photo_front || null);
    const [side, setSide] = useState<string | null>(metric?.photo_side || null);
    const [back, setBack] = useState<string | null>(metric?.photo_back || null);

    const [validated, setValidated] = useState<{ [key: string]: boolean }>({
        front: !!metric?.photo_front,
        side: !!metric?.photo_side,
        back: !!metric?.photo_back,
    });
    const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const saved = await AsyncStorage.getItem("user");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setUserId(parsed.id.toString());
                    setUserName(parsed.first_name || "User");
                    setIsPremium(parsed.is_premium || false);
                } else {
                    Alert.alert("Not logged in", "Please log in first.");
                    router.replace("/auth");
                }

            } catch (err) {
                console.error("Failed to load user from storage", err);
            }
        };
        loadUser();
    }, []);

    const handleConfirm = (selectedDate: Date) => {
        setDate(selectedDate);
        setShowPicker(false);
    };

    const showToast = (message: string, duration = 1500) => {
        setToastMessage(message);
        Animated.timing(toastOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
        }).start(() => {
            setTimeout(() => {
                Animated.timing(toastOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.ease),
                }).start();
            }, duration);
        });
    };

    const validateSinglePose = async (label: string, uri: string) => {
        try {
            const formData = new FormData();
            formData.append("photo", { uri, name: `${label}.jpg`, type: "image/jpeg" } as any);

            const res = await fetch(`${API_URL}/validate_pose`, { method: "POST", body: formData });
            const data = await res.json();

            if (!res.ok) {
                Alert.alert(
                    "Pose Invalid",
                    typeof data.detail === "string"
                        ? data.detail
                        : data.detail?.join("\n") || `Your ${label} photo didn’t pass validation.`
                );
                setValidated((prev) => ({ ...prev, [label]: false }));
                return false;
            }

            setValidated((prev) => ({ ...prev, [label]: true }));
            return true;
        } catch (err) {
            console.error("Pose validation failed", err);
            Alert.alert("Error", "Failed to validate image. Please try again.");
            return false;
        }
    };

    const pickImage = async (setter: (v: string) => void, label: string) => {
        if (!isPremium) {
            Alert.alert("Premium Only", "Photo uploads are available for premium users only.");
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission required", "Photo library access is required.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const valid = await validateSinglePose(label, uri);
            if (valid) setter(uri);
        }
    };

    const takePhoto = async (setter: (v: string) => void, label: string) => {
        if (!isPremium) {
            Alert.alert("Premium Only", "Photo uploads are available for premium users only.");
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission required", "Camera access is required.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const valid = await validateSinglePose(label, uri);
            if (valid) setter(uri);
        }
    };

    const chooseImageSource = (setter: (v: string) => void, label: string) => {
        Alert.alert("Select Option", `Choose your ${label} photo:`, [
            { text: "Take Photo", onPress: () => takePhoto(setter, label) },
            { text: "Choose from Gallery", onPress: () => pickImage(setter, label) },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    const handleSave = async () => {
        if (!weight) {
            Alert.alert("Missing Fields", "Please enter a valid weight.");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("weight", weight);
            formData.append("taken_at", takenAt.toISOString());

            if (isPremium && front) formData.append("photo_front", { uri: front, name: "front.jpg", type: "image/jpeg" } as any);
            if (isPremium && side) formData.append("photo_side", { uri: side, name: "side.jpg", type: "image/jpeg" } as any);
            if (isPremium && back) formData.append("photo_back", { uri: back, name: "back.jpg", type: "image/jpeg" } as any);

            const res = await fetch(`${API_URL}/metrics/${metric.id}`, { method: "PUT", body: formData });
            if (!res.ok) throw new Error("Failed to update metric");

            showToast("✅ Metric updated successfully!");
            setTimeout(() => router.replace("/(tabs)/history"), 800);
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to save metric.");
        } finally {
            setLoading(false);
        }
    };

    const renderPhotoInput = (label: string, uri: string | null, setter: (v: string) => void) => (
        <View style={{ marginBottom: 20, alignItems: "center" }}>
            <Text style={styles.label}>{label} Photo (optional)</Text>
            {uri ? <Image source={{ uri }} style={styles.preview} /> : <Text style={styles.placeholder}>No photo uploaded</Text>}
            {validated[label.toLowerCase()] && uri && (
                <View style={styles.checkmark}>
                    <Text style={{ color: "#fff", fontSize: 16 }}>✅</Text>
                </View>
            )}
            <TouchableOpacity
                style={[
                    styles.button,
                    { backgroundColor: isPremium ? "#fff" : "#6b7280" },
                ]}
                onPress={() => chooseImageSource(setter, label.toLowerCase())}
                disabled={!isPremium || uploading[label.toLowerCase()]}
            >
                {uploading[label.toLowerCase()] ? (
                    <ActivityIndicator color="#000" />
                ) : (
                    <Text style={[styles.buttonText, { color: isPremium ? "#000" : "#ccc" }]}>
                        {uri ? "Retake" : "Add"} {label} Photo
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>

                {/* 🔙 Ionicons Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Edit Metric</Text>

                <View style={styles.card}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setDatePickerVisibility(true)}>
                        <Text style={{ color: "#fff", textAlign: "center" }}>{takenAt.toDateString()}</Text>
                    </TouchableOpacity>
                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        date={takenAt}
                        onConfirm={(d) => {
                            setTakenAt(d);
                            setDatePickerVisibility(false);
                        }}
                        onCancel={() => setDatePickerVisibility(false)}
                    />
                    <Text style={styles.label}>Weight (lbs)</Text>
                    <TextInput
                        style={styles.input}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                    />

                    {isPremium ? (
                        <>
                            {renderPhotoInput("Front", front, setFront)}
                            {renderPhotoInput("Side", side, setSide)}
                            {renderPhotoInput("Back", back, setBack)}
                        </>
                    ) : (
                        <TouchableOpacity onPress={() => router.push("/(tabs)/settings")}>
                            <Text style={{ color: "#f87171", textAlign: "center", marginTop: 10 }}>
                                Upgrade to premium to re-scan photos
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.saveButton]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Toast */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    bottom: 50,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    opacity: toastOpacity,
                }}
            >
                <View
                    style={{
                        backgroundColor: "#16a34a",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>{toastMessage}</Text>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
    container: { padding: 20, flexGrow: 1 },

    // ⭐ Back Button Style
    backButton: {
        marginBottom: 10,
        width: 40,
    },

    card: {
        backgroundColor: "#2c2c2c",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        alignItems: "center",
    },
    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 20,
    },
    label: { color: "#d1d5db", marginBottom: 6, fontWeight: "600" },
    input: {
        backgroundColor: "#1f1f1f",
        color: "#fff",
        padding: 12,
        borderRadius: 8,
        width: "100%",
        marginBottom: 20,
        textAlign: "center",
    },
    button: {
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginTop: 8,
        alignItems: "center",
        width: 200,
    },
    buttonText: { fontWeight: "600", fontSize: 16 },
    preview: {
        width: 160,
        height: 200,
        borderRadius: 8,
        marginBottom: 8,
    },
    placeholder: { color: "#9ca3af", marginBottom: 8 },
    checkmark: {
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "#16a34a",
        borderRadius: 12,
        padding: 2,
    },
    saveButton: {
        backgroundColor: "#fff",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 10,
    },
    saveButtonText: {
        color: "#000",
        fontWeight: "600",
        fontSize: 16,
    },
});
