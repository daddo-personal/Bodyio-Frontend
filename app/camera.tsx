// app/camera.tsx
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

export default function CameraScreen() {
  const router = useRouter();
  const { label } = useLocalSearchParams();

  // ----- HOOKS MUST BE FIRST -----
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(10); // 👈 user-configurable timer
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTaking, setIsTaking] = useState(false);

  // ----- ANIMATION HOOK -----
  const toggleAnim = useRef(new Animated.Value(1)).current;

  const toggleTimer = () => {
    // 🚫 Block toggling while countdown is running or photo is being taken
    if (isTaking || countdown !== null) return;

    const newState = !timerEnabled;
    setTimerEnabled(newState);

    Animated.timing(toggleAnim, {
      toValue: newState ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const pillBackground = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3f3f46", "#16a34a"],
  });

  const knobPosition = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 38],
  });

  // ----- AUDIO -----
  const audioFiles: { [key: number]: any } = {
    10: require("../assets/audio/10.mp3"),
    9: require("../assets/audio/9.mp3"),
    8: require("../assets/audio/8.mp3"),
    7: require("../assets/audio/7.mp3"),
    6: require("../assets/audio/6.mp3"),
    5: require("../assets/audio/5.mp3"),
    4: require("../assets/audio/4.mp3"),
    3: require("../assets/audio/3.mp3"),
    2: require("../assets/audio/2.mp3"),
    1: require("../assets/audio/1.mp3"),
  };

  const playCountdownSound = async (num: number) => {
    try {
      const file = audioFiles[num];
      if (!file) return;

      const { sound } = await Audio.Sound.createAsync(file, {
        shouldPlay: true,
      });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch {}
  };

  // ----- COUNTDOWN -----
  const startCountdown = () => {
    if (isTaking) return;

    const totalSeconds = timerSeconds || 0;

    // If somehow timer is 0, just take photo immediately
    if (totalSeconds <= 0) {
      takePhoto();
      return;
    }

    setIsTaking(true);
    setCountdown(totalSeconds);

    let seconds = totalSeconds;
    playCountdownSound(seconds);

    const interval = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);

      if (seconds > 0) {
        playCountdownSound(seconds);
      }

      if (seconds === 0) {
        clearInterval(interval);
        takePhoto();
      }
    }, 1000);
  };

  // ----- TAKE PHOTO -----
  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });

      await AsyncStorage.setItem("camera_return_photo", photo.uri);
      await AsyncStorage.setItem("camera_return_label", String(label));

      router.back();
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsTaking(false);
      setCountdown(null);
    }
  };

  // ----------------------------------------------------
  // UI RENDER (NO EARLY RETURNS BEFORE HOOKS!)
  // ----------------------------------------------------

  if (!permission)
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#fff" }}>Loading...</Text>
      </View>
    );

  if (!permission.granted)
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#fff" }}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text style={{ color: "#4ade80", marginTop: 10 }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );

  const timerDisabled = isTaking || countdown !== null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      {/* COUNTDOWN OVERLAY */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* TIMER TOGGLE + OPTIONS */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          onPress={toggleTimer}
          activeOpacity={0.7}
          disabled={timerDisabled}
        >
          <Animated.View
            style={[styles.togglePill, { backgroundColor: pillBackground }]}
          >
            <Animated.View
              style={[
                styles.toggleKnob,
                { transform: [{ translateX: knobPosition }] },
              ]}
            />
          </Animated.View>
        </TouchableOpacity>

        <Text style={styles.toggleLabel}>
          {timerEnabled ? `Timer ${timerSeconds}s` : "Timer OFF"}
        </Text>

        {/* Timer preset buttons */}
        <View style={styles.timerOptionsRow}>
          {[3, 5, 10].map((sec) => (
            <TouchableOpacity
              key={sec}
              disabled={timerDisabled}
              onPress={() => setTimerSeconds(sec)}
              style={[
                styles.timerOption,
                timerSeconds === sec && styles.timerOptionActive,
                timerDisabled && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  styles.timerOptionText,
                  timerSeconds === sec && styles.timerOptionTextActive,
                ]}
              >
                {sec}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* CAPTURE BUTTON */}
      <View style={styles.captureContainer}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            isTaking && timerEnabled && { opacity: 0.4 },
          ]}
          onPress={() => (timerEnabled ? startCountdown() : takePhoto())}
          disabled={isTaking && timerEnabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownText: {
    fontSize: 120,
    fontWeight: "900",
    color: "#fff",
  },
  toggleContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    alignItems: "center",
  },
  togglePill: {
    width: 70,
    height: 32,
    borderRadius: 20,
    padding: 2,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 28,
    height: 28,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  toggleLabel: {
    color: "#fff",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  timerOptionsRow: {
    flexDirection: "row",
    marginTop: 8,
    backgroundColor: "#18181b",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  timerOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginHorizontal: 2,
  },
  timerOptionActive: {
    backgroundColor: "#16a34a",
  },
  timerOptionText: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "500",
  },
  timerOptionTextActive: {
    color: "#000",
    fontWeight: "700",
  },
  captureContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
  },
  captureButton: {
    width: 75,
    height: 75,
    borderRadius: 40,
    backgroundColor: "#fff",
    borderWidth: 5,
    borderColor: "#aaa",
  },
});
