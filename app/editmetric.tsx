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
import { Ionicons } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useFocusEffect } from "@react-navigation/native";

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

    const [weight, setWeight] = useState(metric?.weight?.toString() || "");
    const [unit, setUnit] = useState<"lbs" | "kg">("lbs");

    const [userId, setUserId] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState(false);

    const [front, setFront] = useState<string | null>(metric?.photo_front || null);
    const [side, setSide] = useState<string | null>(metric?.photo_side || null);
    const [back, setBack] = useState<string | null>(metric?.photo_back || null);

    const [validated, setValidated] = useState({
        front: !!metric?.photo_front,
        side: !!metric?.photo_side,
        back: !!metric?.photo_back,
    });

    const [uploading, setUploading] = useState({});
    const [loading, setLoading] = useState(false);

    // ----------------------------------------------------
    // LOAD USER + WEIGHT UNIT PREFERENCE
    // ----------------------------------------------------
    useEffect(() => {
        async function loadUser() {
            const saved = await AsyncStorage.getItem("user");
            if (!saved) {
                router.replace("/auth");
                return;
            }
            const parsed = JSON.parse(saved);
            setUserId(parsed.id.toString());
            setIsPremium(parsed.is_premium || false);
        }
        loadUser();
    }, []);

    useEffect(() => {
        async function loadUnit() {
            const saved = await AsyncStorage.getItem("weight_unit");
            if (saved === "kg" || saved === "lbs") {
                setUnit(saved);

                // Convert displayed weight from lbs (backend) → kg for UI toggle
                if (saved === "kg" && metric?.weight) {
                    const converted = (metric.weight / 2.20462).toFixed(1);
                    setWeight(converted);
                }
            }
        }
        loadUnit();
    }, []);

    // ----------------------------------------------------
    // CUSTOM CAMERA RETURN HANDLER (same as upload.tsx)
    // ----------------------------------------------------
    useFocusEffect(
        React.useCallback(() => {
            async function loadCameraResult() {
                const returnedPhoto = await AsyncStorage.getItem("camera_return_photo");
                const returnedLabel = await AsyncStorage.getItem("camera_return_label");

                if (returnedPhoto && returnedLabel) {
                    const valid = await validateSinglePose(returnedLabel, returnedPhoto);

                    if (valid) {
                        if (returnedLabel === "front") setFront(returnedPhoto);
                        if (returnedLabel === "side") setSide(returnedPhoto);
                        if (returnedLabel === "back") setBack(returnedPhoto);
                    }

                    await AsyncStorage.removeItem("camera_return_photo");
                    await AsyncStorage.removeItem("camera_return_label");
                }
            }

            loadCameraResult();
        }, [])
    );

    // ----------------------------------------------------
    // UNIT TOGGLE (same as upload.tsx)
    // ----------------------------------------------------
    const toggleUnit = async () => {
        if (weight) {
            if (unit === "lbs") {
                const converted = (parseFloat(weight) / 2.20462).toFixed(1);
                setWeight(converted);
                setUnit("kg");
                await AsyncStorage.setItem("weight_unit", "kg");
            } else {
                const converted = (parseFloat(weight) * 2.20462).toFixed(1);
                setWeight(converted);
                setUnit("lbs");
                await AsyncStorage.setItem("weight_unit", "lbs");
            }
        } else {
            const newUnit = unit === "lbs" ? "kg" : "lbs";
            setUnit(newUnit);
            await AsyncStorage.setItem("weight_unit", newUnit);
        }
    };

    const UnitToggle = ({ unit, toggleUnit }) => (
        <TouchableOpacity
            onPress={toggleUnit}
            activeOpacity={0.9}
            style={{
                width: 80,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#3b3b3b",
                padding: 3,
                flexDirection: "row",
                alignItems: "center",
                position: "relative",
                marginBottom: 12,
            }}
        >
            <View
                style={{
                    position: "absolute",
                    width: 34,
                    height: 32,
                    borderRadius: 17,
                    backgroundColor: "#fff",
                    left: unit === "lbs" ? 2 : 44,
                    top: 1,
                    zIndex: 5,
                }}
            />

            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: unit === "lbs" ? "#fff" : "#bbb", fontWeight: "700" }}>
                    lbs
                </Text>
            </View>

            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: unit === "kg" ? "#fff" : "#bbb", fontWeight: "700" }}>
                    kg
                </Text>
            </View>
        </TouchableOpacity>
    );

    // ----------------------------------------------------
    // POSE VALIDATION
    // ----------------------------------------------------
    const validateSinglePose = async (label, uri) => {
        setUploading((prev) => ({ ...prev, [label]: true }));
        try {
            const formData = new FormData();
            formData.append("photo", { uri, name: `${label}.jpg`, type: "image/jpeg" });

            const res = await fetch(`${API_URL}/validate_pose`, { method: "POST", body: formData });
            const data = await res.json();

            if (!res.ok) {
                Alert.alert("Pose Invalid", data.detail?.join?.("\n") || data.detail || "Invalid pose");
                setValidated((prev) => ({ ...prev, [label]: false }));
                return false;
            }

            setValidated((prev) => ({ ...prev, [label]: true }));
            return true;
        } catch {
            Alert.alert("Error", "Could not validate pose");
            return false;
        } finally {
            setUploading((prev) => ({ ...prev, [label]: false }));
        }
    };

    // ----------------------------------------------------
    // CHOOSE IMAGE SOURCE (uses custom camera)
    // ----------------------------------------------------
    const pickImage = async (setter, label) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const valid = await validateSinglePose(label, uri);
            if (valid) setter(uri);
        }
    };

    const takePhoto = (setter, label) => {
        router.push({
            pathname: "/camera",
            params: { label },
        });
    };

    const chooseImageSource = (setter, label) => {
        Alert.alert("Select Option", `Choose your ${label} photo:`, [
            { text: "Take Photo", onPress: () => takePhoto(setter, label) },
            { text: "Choose from Gallery", onPress: () => pickImage(setter, label) },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    // ----------------------------------------------------
    // SAVE EDITED METRIC
    // ----------------------------------------------------
    const handleSave = async () => {
        if (!weight) {
            Alert.alert("Missing Fields", "Enter a weight.");
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();

            let finalWeight = weight;
            if (unit === "kg") {
                finalWeight = (parseFloat(weight) * 2.20462).toFixed(1);
            }

            formData.append("weight", finalWeight);
            formData.append("taken_at", takenAt.toISOString());

            if (front) formData.append("photo_front", { uri: front, name: "front.jpg", type: "image/jpeg" });
            if (side) formData.append("photo_side", { uri: side, name: "side.jpg", type: "image/jpeg" });
            if (back) formData.append("photo_back", { uri: back, name: "back.jpg", type: "image/jpeg" });

            const res = await fetch(`${API_URL}/metrics/${metric.id}`, {
                method: "PUT",
                body: formData,
            });

            if (!res.ok) throw new Error();

            showToast("✅ Metric updated!");
            setTimeout(() => router.replace("/(tabs)/history"), 800);
        } catch {
            Alert.alert("Error", "Failed to update metric.");
        } finally {
            setLoading(false);
        }
    };

    // ----------------------------------------------------
    // TOAST
    // ----------------------------------------------------
    const showToast = (msg) => {
        setToastMessage(msg);
        Animated.timing(toastOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start(() =>
            setTimeout(() => {
                Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
            }, 1400)
        );
    };

    const clearPhoto = (label: "front" | "side" | "back") => {
        if (label === "front") setFront(null);
        if (label === "side") setSide(null);
        if (label === "back") setBack(null);

        setValidated((prev) => ({
            ...prev,
            [label]: false,
        }));
    };

    // ----------------------------------------------------
    // PHOTO INPUT RENDERER
    // ----------------------------------------------------
    const renderPhotoInput = (
        label: string,
        uri: string | null,
        setter: (v: string) => void
    ) => {
        const key = label.toLowerCase() as "front" | "side" | "back";
        const isUploading = !!uploading[key]; // ✅ ADD

        return (
            <View style={{ marginBottom: 20, alignItems: "center" }}>
                <Text style={styles.label}>{label} Photo</Text>

                {/* ✅ PREVIEW + OVERLAY SPINNER */}
                {uri ? (
                    <View style={{ position: "relative" }}>
                        <Image source={{ uri }} style={styles.preview} />

                        {isUploading && (
                            <View style={styles.photoSpinnerOverlay}>
                                <ActivityIndicator size="large" color="#fff" />
                                <Text style={styles.photoSpinnerText}>Processing…</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <Text style={styles.placeholder}>No photo uploaded</Text>
                )}

                {validated[key] && uri && (
                    <View style={styles.checkmark}>
                        <Text style={{ color: "#fff", fontSize: 16 }}>✅</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#fff", opacity: isUploading ? 0.6 : 1 }]}
                    onPress={() => !isUploading && chooseImageSource(setter, key)}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={[styles.buttonText, { color: "#000" }]}>
                            {uri ? "Retake" : "Add"} {label} Photo
                        </Text>
                    )}
                </TouchableOpacity>

                {uri && (
                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert("Remove photo?", `Clear your ${key} photo?`, [
                                { text: "Cancel", style: "cancel" },
                                { text: "Clear", style: "destructive", onPress: () => clearPhoto(key) },
                            ])
                        }
                        style={{ marginTop: 6, opacity: isUploading ? 0.6 : 1 }}
                        disabled={isUploading}
                    >
                        <Text style={{ color: "#f87171", fontWeight: "600" }}>Clear {label} Photo</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.title}>Edit Metric</Text>

                <View style={styles.card}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setDatePickerVisibility(true)}>
                        <Text style={{ color: "#fff", textAlign: "center" }}>
                            {takenAt.toDateString()}
                        </Text>
                    </TouchableOpacity>

                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        date={takenAt}
                        minimumDate={new Date(2025, 0, 1)}   // ⬅️ Prevent selecting dates before 2025
                        onConfirm={(d) => {
                            setTakenAt(d);
                            setDatePickerVisibility(false);
                        }}
                        onCancel={() => setDatePickerVisibility(false)}
                    />

                    {/* UNIT TOGGLE + WEIGHT INPUT */}
                    <Text style={styles.label}>Weight ({unit})</Text>
                    <UnitToggle unit={unit} toggleUnit={toggleUnit} />

                    <TextInput
                        style={[styles.input, { textAlign: "center" }]}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                    />

                    <>
                        {renderPhotoInput("Front", front, setFront)}
                        {renderPhotoInput("Side", side, setSide)}
                        {renderPhotoInput("Back", back, setBack)}
                    </>

                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
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
                    opacity: toastOpacity,
                    alignItems: "center",
                }}
            >
                <View
                    style={{
                        backgroundColor: "#16a34a",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 20,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>{toastMessage}</Text>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

// ----------------------------------------------------
// STYLES — MATCH upload.tsx
// ----------------------------------------------------
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#1f1f1f" },
    container: { padding: 20, flexGrow: 1 },

    backButton: {
        width: 40,
        marginBottom: 10,
    },

    title: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 20,
    },

    card: {
        backgroundColor: "#2c2c2c",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        alignItems: "center",
    },

    label: { color: "#d1d5db", marginBottom: 6, fontWeight: "600" },

    input: {
        backgroundColor: "#1f1f1f",
        color: "#fff",
        paddingHorizontal: 12,
        paddingVertical: 10,
        height: 44,
        borderRadius: 8,
        width: "100%",
        marginBottom: 20,
    },

    preview: { width: 160, height: 200, borderRadius: 8, marginBottom: 8 },
    placeholder: { color: "#9ca3af", marginBottom: 8 },

    checkmark: {
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "#16a34a",
        borderRadius: 12,
        padding: 2,
    },

    button: {
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginTop: 8,
        alignItems: "center",
        width: 200,
    },

    buttonText: {
        fontWeight: "600",
        fontSize: 16,
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
    photoSpinnerOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 8,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
    },

    photoSpinnerText: {
        marginTop: 10,
        color: "#fff",
        fontWeight: "800",
    },
});
