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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const API_URL = Constants.expoConfig.extra.apiUrl;

export default function UploadScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const toastOpacity = useState(new Animated.Value(0))[0];
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [front, setFront] = useState<string | null>(null);
  const [side, setSide] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);

  const [validated, setValidated] = useState<{ [key: string]: boolean }>({
    front: false,
    side: false,
    back: false,
  });
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setDate(new Date());
    }, [])
  );

  useEffect(() => {
    async function checkOnboarding() {
      const seen = await AsyncStorage.getItem("seenOnboarding");

      if (seen !== "true") {
        await AsyncStorage.setItem("seenOnboarding", "true");
        router.push("/onboarding");
      }
    }

    checkOnboarding();
  }, []);

  useEffect(() => {
    async function loadUnitPreference() {
      const saved = await AsyncStorage.getItem("weight_unit");
      if (saved === "kg" || saved === "lbs") {
        setUnit(saved);
      }
    }
    loadUnitPreference();
  }, []);

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

  const UnitToggle = ({ unit, toggleUnit }) => {
    return (
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
        }}
      >

        {/* Sliding Circle */}
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

        {/* LBS label */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Text
            style={{
              color: unit === "lbs" ? "#fff" : "#bbb",
              fontWeight: "700",
            }}
          >
            lbs
          </Text>
        </View>

        {/* KG label */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Text
            style={{
              color: unit === "kg" ? "#fff" : "#bbb",
              fontWeight: "700",
            }}
          >
            kg
          </Text>
        </View>
      </TouchableOpacity>
    );
  };


  const toggleUnit = async () => {
    if (weight) {
      let converted = "";

      if (unit === "lbs") {
        // lbs → kg
        converted = (parseFloat(weight) / 2.20462).toFixed(1);
        setUnit("kg");
        setWeight(converted);
        await AsyncStorage.setItem("weight_unit", "kg");
      } else {
        // kg → lbs
        converted = (parseFloat(weight) * 2.20462).toFixed(1);
        setUnit("lbs");
        setWeight(converted);
        await AsyncStorage.setItem("weight_unit", "lbs");
      }
    } else {
      // no weight typed yet → just toggle unit
      const newUnit = unit === "lbs" ? "kg" : "lbs";
      setUnit(newUnit);
      await AsyncStorage.setItem("weight_unit", newUnit);
    }
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

  useEffect(() => {
    const loadUser = async () => {
      const saved = await AsyncStorage.getItem("user");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setUser(parsed);
      setUserId(parsed.id.toString());
      setHeight(parsed.height);
    };
    loadUser();
  }, []);

  const handleConfirm = (selectedDate: Date) => {
    setDate(selectedDate);
    setShowPicker(false);
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Photo library access is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const valid = await validateSinglePose(label, uri);
      if (valid) setter(uri);
    }
  };

  const takePhoto = (setter: (v: string) => void, label: string) => {
    router.push({
      pathname: "/camera",
      params: { label }, // front | side | back
    });
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

    // Validate only photos that the user actually provided
    const photosToValidate = { front, side, back };
    const invalidUploaded = Object.keys(photosToValidate).some(
      (key) => photosToValidate[key] && !validated[key]
    );

    if (invalidUploaded) {
      Alert.alert("Validation Required", "Please validate all uploaded photos.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      let finalWeight = weight;

      if (unit === "kg") {
        finalWeight = (parseFloat(weight) * 2.20462).toFixed(1); // convert to lbs
      }

      formData.append("user_id", userId);
      formData.append("height", height);
      formData.append("weight", finalWeight);
      formData.append("taken_at", date.toISOString());

      // Only append photos if user uploaded them
      if (front) {
        formData.append("photo_front", {
          uri: front,
          name: "front.jpg",
          type: "image/jpeg",
        } as any);
      }

      if (side) {
        formData.append("photo_side", {
          uri: side,
          name: "side.jpg",
          type: "image/jpeg",
        } as any);
      }

      if (back) {
        formData.append("photo_back", {
          uri: back,
          name: "back.jpg",
          type: "image/jpeg",
        } as any);
      }

      const res = await fetch(`${API_URL}/metrics`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail);
      }

      showToast("✅ Metric uploaded successfully!");
      await AsyncStorage.setItem("highlight_recent", "true");

      // Reset UI
      setWeight("");
      setUnit(await AsyncStorage.getItem("weight_unit") || "lbs");
      setDate(new Date());
      setFront(null);
      setSide(null);
      setBack(null);
      setValidated({ front: false, side: false, back: false });
      setUploading({});

      setTimeout(() => {
        router.push("/(tabs)/dashboard");
      }, 600);
    } catch (err) {
      Alert.alert(err.message);
      router.push("/(tabs)/settings");
    } finally {
      setLoading(false);
    }
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

  const renderPhotoInput = (
    label: string,
    uri: string | null,
    setter: (v: string | null) => void
  ) => {
    const key = label.toLowerCase() as "front" | "side" | "back";

    return (
      <View style={{ marginBottom: 20, alignItems: "center" }}>
        <Text style={styles.label}>{label} Photo</Text>

        {uri ? (
          <Image source={{ uri }} style={styles.preview} />
        ) : (
          <Text style={styles.placeholder}>No photo uploaded</Text>
        )}

        {/* ✅ validation check */}
        {validated[key] && uri && (
          <View style={styles.checkmark}>
            <Text style={{ color: "#fff", fontSize: 16 }}>✅</Text>
          </View>
        )}

        {/* Add / Retake */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#fff" }]}
          onPress={() => chooseImageSource(setter as any, key)}
        >
          <Text style={[styles.buttonText, { color: "#000" }]}>
            {uri ? "Retake" : "Add"} {label} Photo
          </Text>
        </TouchableOpacity>

        {/* 🧹 CLEAR BUTTON (only if photo exists) */}
        {uri && (
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Remove photo?",
                `Clear your ${label.toLowerCase()} photo?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear", style: "destructive", onPress: () => clearPhoto(key) },
                ]
              )
            }
            style={{
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#f87171", fontWeight: "600" }}>
              Clear {label} Photo
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 🆕 TOOLTIP BUTTON — REOPEN ONBOARDING */}
      <TouchableOpacity
        onPress={() => router.push("/onboarding")}   // ← ADDED
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 50,
          height: 32,
          width: 32,
          borderRadius: 16,
          backgroundColor: "#3b3b3b",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>?</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Upload New Metric</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Date</Text>
          <View style={[styles.input, { justifyContent: "center" }]}>
            <Text style={{ color: "#fff", textAlign: "center" }}>
              {date.toDateString()}
            </Text>
          </View>

          <Text style={styles.label}>Weight ({unit})</Text>

          {/* Unit toggle directly under label */}
          <View style={{ marginBottom: 12 }}>
            <UnitToggle unit={unit} toggleUnit={toggleUnit} />
          </View>

          {/* Weight input under toggle */}
          <TextInput
            style={[styles.input, { textAlign: "center" }]}
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
          />

          {renderPhotoInput("Front", front, setFront)}
          {renderPhotoInput("Side", side, setSide)}
          {renderPhotoInput("Back", back, setBack)}
        </View>

        <TouchableOpacity style={[styles.saveButton]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Metric</Text>}
        </TouchableOpacity>
      </ScrollView>

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
  card: { backgroundColor: "#2c2c2c", borderRadius: 12, padding: 16, marginBottom: 20, alignItems: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  label: { color: "#d1d5db", marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#1f1f1f",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,          // 👈 enforce consistent height
    borderRadius: 8,
    width: "100%",
    marginBottom: 20,
    textAlign: "left",   // 👈 prevents visual drift
  }, button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8, alignItems: "center", width: 200 },
  buttonText: { fontWeight: "600", fontSize: 16 },
  preview: { width: 160, height: 200, borderRadius: 8, marginBottom: 8 },
  placeholder: { color: "#9ca3af", marginBottom: 8 },
  checkmark: { position: "absolute", top: 8, right: 8, backgroundColor: "#16a34a", borderRadius: 12, padding: 2 },
  saveButton: { backgroundColor: "#fff", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 10 },
  saveButtonText: { color: "#000", fontWeight: "600", fontSize: 16 },
});
