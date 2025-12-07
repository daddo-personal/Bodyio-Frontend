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

const API_URL = Constants.expoConfig.extra.apiUrl;

export default function UploadScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const toastOpacity = useState(new Animated.Value(0))[0];

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
      formData.append("user_id", userId);
      formData.append("height", height);
      formData.append("weight", weight);
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

      if (!res.ok) throw new Error("Failed to upload metric");

      showToast("✅ Metric uploaded successfully!");

      // Reset UI
      setWeight("");
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
      console.error(err);
      Alert.alert("Error", "Failed to save metric.");
    } finally {
      setLoading(false);
    }
  };


  const renderPhotoInput = (label: string, uri: string | null, setter: (v: string) => void) => (
    <View style={{ marginBottom: 20, alignItems: "center" }}>
      <Text style={styles.label}>{label} Photo</Text>
      {uri ? <Image source={{ uri }} style={styles.preview} /> : <Text style={styles.placeholder}>No photo uploaded</Text>}
      {validated[label.toLowerCase()] && uri && (
        <View style={styles.checkmark}>
          <Text style={{ color: "#fff", fontSize: 16 }}>✅</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#fff" }]}
        onPress={() => chooseImageSource(setter, label.toLowerCase())}
        disabled={uploading[label.toLowerCase()]}
      >
        {uploading[label.toLowerCase()] ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={[styles.buttonText, { color: "#000" }]}>{uri ? "Retake" : "Add"} {label} Photo</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Upload New Metric</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
            <Text style={{ color: "#fff", textAlign: "center" }}>{date.toDateString()}</Text>
          </TouchableOpacity>
          <DateTimePickerModal
            isVisible={showPicker}
            mode="date"
            date={date}
            onConfirm={handleConfirm}
            onCancel={() => setShowPicker(false)}
            maximumDate={new Date()}
          />

          <Text style={styles.label}>Weight (lbs)</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" />

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
  input: { backgroundColor: "#1f1f1f", color: "#fff", padding: 12, borderRadius: 8, width: "100%", marginBottom: 20, textAlign: "center" },
  button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8, alignItems: "center", width: 200 },
  buttonText: { fontWeight: "600", fontSize: 16 },
  preview: { width: 160, height: 200, borderRadius: 8, marginBottom: 8 },
  placeholder: { color: "#9ca3af", marginBottom: 8 },
  checkmark: { position: "absolute", top: 8, right: 8, backgroundColor: "#16a34a", borderRadius: 12, padding: 2 },
  saveButton: { backgroundColor: "#fff", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 10 },
  saveButtonText: { color: "#000", fontWeight: "600", fontSize: 16 },
});
