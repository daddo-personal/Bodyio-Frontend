// app/camera.tsx
import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";

export default function CameraScreen() {
  const router = useRouter();
  const { label } = useLocalSearchParams(); // front | side | back

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTaking, setIsTaking] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted)
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#fff" }}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text style={{ color: "#4ade80", marginTop: 10 }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );

  // -------- AUDIO PLAYER ----------
  const playCountdownSound = async (num: number) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        audioFiles[num],
        { shouldPlay: true }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (err) {
      console.warn("Audio play error:", err);
    }
  };

  // Map numbers to require() paths
  const audioFiles: Record<number, any> = {
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

  // -------- COUNTDOWN ----------
  const startCountdown = () => {
    if (isTaking) return; // don't allow restarting countdown

    setIsTaking(true);
    setCountdown(10);
    let seconds = 10;

    playCountdownSound(seconds);

    const interval = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);

      if (seconds > 0) playCountdownSound(seconds);

      if (seconds === 0) {
        clearInterval(interval);
        takePhoto();
      }
    }, 1000);
  };

  // -------- TAKE PHOTO ----------
  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });

      await AsyncStorage.setItem("camera_return_photo", photo.uri);
      await AsyncStorage.setItem("camera_return_label", label);

      router.back();
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsTaking(false);
      setCountdown(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back" // ONLY back camera
      />

      {/* Countdown overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      {/* Capture button */}
      <View style={styles.captureContainer}>
        <TouchableOpacity
          style={[styles.captureButton, isTaking && { opacity: 0.4 }]}
          onPress={startCountdown}
          disabled={isTaking} // disable while counting down
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownText: {
    color: "#fff",
    fontSize: 120,
    fontWeight: "900",
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
  centered: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});
